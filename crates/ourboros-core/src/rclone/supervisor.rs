use serde_json::Value;
use tokio::process::Child;
use tokio::sync::RwLock;

use crate::error::{CoreError, CoreResult};

use super::client::{RcAuth, RcClient};
use super::command::validate_proxy_command;
use super::process::{self, parse_attach_url};
use super::types::{RcResponse, RcloneMode, RcloneSettings, RcloneStatus};

struct Session {
    mode: RcloneMode,
    rc_url: String,
    auth: Option<RcAuth>,
    version: String,
    binary: String,
    child: Option<Child>,
}

struct Inner {
    settings: RcloneSettings,
    session: Option<Session>,
}

pub struct RcloneSupervisor {
    client: RcClient,
    inner: RwLock<Inner>,
}

impl RcloneSupervisor {
    pub fn new(settings: RcloneSettings) -> Self {
        Self {
            client: RcClient::new(),
            inner: RwLock::new(Inner {
                settings,
                session: None,
            }),
        }
    }

    pub fn client(&self) -> &RcClient {
        &self.client
    }

    pub async fn settings(&self) -> RcloneSettings {
        self.inner.read().await.settings.clone()
    }

    pub async fn update_settings(&self, mutate: impl FnOnce(&mut RcloneSettings)) {
        let mut inner = self.inner.write().await;
        mutate(&mut inner.settings);
    }

    pub async fn ensure_running(&self) -> CoreResult<RcloneStatus> {
        self.reap().await;
        if self.status().await.running {
            return self.ping().await;
        }
        self.start().await
    }

    pub async fn start(&self) -> CoreResult<RcloneStatus> {
        self.reap().await;
        {
            let inner = self.inner.read().await;
            if inner.session.is_some() {
                return Err(CoreError::AlreadyRunning);
            }
        }

        let settings = self.inner.read().await.settings.clone();
        let (mode, rc_url, auth, child, binary) = if let Some(rc_url) = settings.rc_url.clone() {
            let (url, url_auth) = parse_attach_url(&rc_url)?;
            let auth =
                url_auth.or_else(
                    || match (settings.rc_user.clone(), settings.rc_pass.clone()) {
                        (Some(user), Some(pass)) => Some(RcAuth { user, pass }),
                        _ => None,
                    },
                );
            process::wait_until_attached(&self.client, &url, auth.as_ref()).await?;
            (RcloneMode::Attached, url, auth, None, settings.bin.clone())
        } else {
            let spawned = process::spawn_daemon(&settings, &self.client).await?;
            (
                RcloneMode::Spawned,
                spawned.rc_url,
                Some(spawned.auth),
                Some(spawned.child),
                settings.bin.clone(),
            )
        };

        let version = self.client.version(&rc_url, auth.as_ref()).await?.version;

        {
            let mut inner = self.inner.write().await;
            if inner.session.is_some() {
                if let Some(mut child) = child {
                    let _ = child.start_kill();
                    let _ = child.wait().await;
                }
                return Err(CoreError::AlreadyRunning);
            }
            inner.session = Some(Session {
                mode,
                rc_url: rc_url.clone(),
                auth,
                version: version.clone(),
                binary,
                child,
            });
        }

        tracing::info!(%version, ?mode, "rclone rc is ready");
        Ok(self.status().await)
    }

    pub async fn stop(&self) -> CoreResult<RcloneStatus> {
        let mut inner = self.inner.write().await;
        let Some(mut session) = inner.session.take() else {
            return Err(CoreError::NotRunning);
        };

        if session.mode == RcloneMode::Spawned {
            if let Some(auth) = &session.auth {
                let _ = self
                    .client
                    .call(
                        &session.rc_url,
                        Some(auth),
                        "core/quit",
                        serde_json::json!({}),
                    )
                    .await;
            }
            if let Some(mut child) = session.child.take() {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                let _ = child.start_kill();
                let _ = child.wait().await;
            }
        }

        Ok(self.status_locked(&inner))
    }

    pub async fn ping(&self) -> CoreResult<RcloneStatus> {
        self.reap().await;
        let (rc_url, auth) = {
            let inner = self.inner.read().await;
            let session = inner.session.as_ref().ok_or(CoreError::NotRunning)?;
            (session.rc_url.clone(), session.auth.clone())
        };

        let version = self.client.version(&rc_url, auth.as_ref()).await?;
        {
            let mut inner = self.inner.write().await;
            if let Some(session) = inner.session.as_mut() {
                session.version = version.version;
            }
        }

        Ok(self.status().await)
    }

    pub async fn call_allowed(&self, command: &str, body: Value) -> CoreResult<RcResponse> {
        validate_proxy_command(command)?;
        self.call_internal(command, body).await
    }

    pub async fn call_internal(&self, command: &str, body: Value) -> CoreResult<RcResponse> {
        self.reap().await;
        let (rc_url, auth) = {
            let inner = self.inner.read().await;
            let session = inner.session.as_ref().ok_or(CoreError::NotRunning)?;
            (session.rc_url.clone(), session.auth.clone())
        };
        self.client
            .call(&rc_url, auth.as_ref(), command, body)
            .await
    }

    pub async fn list_remotes(&self) -> CoreResult<Vec<String>> {
        let response = self
            .call_internal("config/listremotes", serde_json::json!({}))
            .await?;
        if !response.is_success() {
            return Err(CoreError::Transport(upstream_message(&response.body)));
        }
        Ok(response
            .body
            .get("remotes")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default())
    }

    pub async fn status(&self) -> RcloneStatus {
        self.reap().await;
        let inner = self.inner.read().await;
        self.status_locked(&inner)
    }

    pub async fn selected_bin(&self) -> String {
        let inner = self.inner.read().await;
        inner
            .session
            .as_ref()
            .map(|session| session.binary.clone())
            .unwrap_or_else(|| inner.settings.bin.clone())
    }

    fn status_locked(&self, inner: &Inner) -> RcloneStatus {
        match &inner.session {
            Some(session) => RcloneStatus {
                running: true,
                mode: Some(session.mode),
                version: Some(session.version.clone()),
                binary: session.binary.clone(),
            },
            None => RcloneStatus {
                running: false,
                mode: None,
                version: None,
                binary: inner.settings.bin.clone(),
            },
        }
    }

    async fn reap(&self) {
        let mut inner = self.inner.write().await;
        let exited = if let Some(session) = inner.session.as_mut() {
            if let Some(child) = session.child.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        tracing::warn!(?status, "rclone process exited unexpectedly");
                        true
                    }
                    Ok(None) => false,
                    Err(error) => {
                        tracing::warn!(%error, "failed to poll rclone process");
                        true
                    }
                }
            } else {
                false
            }
        } else {
            false
        };
        if exited {
            inner.session = None;
        }
    }
}

fn upstream_message(body: &Value) -> String {
    body.get("error")
        .and_then(Value::as_str)
        .unwrap_or("rclone rc returned an error")
        .to_string()
}
