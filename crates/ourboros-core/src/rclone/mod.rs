mod client;
mod command;
mod process;
mod types;

use serde_json::Value;
use tokio::process::Child;
use tokio::sync::RwLock;

use crate::error::{CoreError, CoreResult};

pub use types::{RcResponse, RcloneMode, RcloneSettings, RcloneStatus, RcloneVersion};

use client::RcClient;

struct Session {
    mode: RcloneMode,
    rc_url: String,
    version: String,
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

    pub async fn ensure_running(&self) -> CoreResult<RcloneStatus> {
        if self.status().await.running {
            return self.ping().await;
        }

        self.start().await
    }

    pub async fn start(&self) -> CoreResult<RcloneStatus> {
        {
            let inner = self.inner.read().await;
            if inner.session.is_some() {
                return Err(CoreError::AlreadyRunning);
            }
        }

        let settings = self.inner.read().await.settings.clone();

        let (mode, rc_url, child) = if let Some(rc_url) = settings.rc_url.clone() {
            process::wait_until_attached(&self.client, &rc_url).await?;
            (RcloneMode::Attached, rc_url, None)
        } else {
            let spawned = process::spawn_daemon(&settings, &self.client).await?;
            (
                RcloneMode::Spawned,
                spawned.rc_url,
                Some(spawned.child),
            )
        };

        let version = self.client.version(&rc_url).await?.version;

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
                version: version.clone(),
                child,
            });
        }

        tracing::info!(%rc_url, %version, ?mode, "rclone rc is ready");
        Ok(self.status().await)
    }

    pub async fn stop(&self) -> CoreResult<RcloneStatus> {
        let mut inner = self.inner.write().await;
        let Some(mut session) = inner.session.take() else {
            return Err(CoreError::NotRunning);
        };

        if let Some(mut child) = session.child.take() {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }

        Ok(self.status_locked(&inner))
    }

    pub async fn ping(&self) -> CoreResult<RcloneStatus> {
        let rc_url = {
            let inner = self.inner.read().await;
            inner
                .session
                .as_ref()
                .map(|session| session.rc_url.clone())
                .ok_or(CoreError::NotRunning)?
        };

        let version = self.client.version(&rc_url).await?;
        {
            let mut inner = self.inner.write().await;
            if let Some(session) = inner.session.as_mut() {
                session.version = version.version;
            }
        }

        Ok(self.status().await)
    }

    pub async fn call(&self, command: &str, body: Value) -> CoreResult<RcResponse> {
        let rc_url = {
            let inner = self.inner.read().await;
            inner
                .session
                .as_ref()
                .map(|session| session.rc_url.clone())
                .ok_or(CoreError::NotRunning)?
        };

        self.client.call(&rc_url, command, body).await
    }

    pub async fn status(&self) -> RcloneStatus {
        let inner = self.inner.read().await;
        self.status_locked(&inner)
    }

    fn status_locked(&self, inner: &Inner) -> RcloneStatus {
        match &inner.session {
            Some(session) => RcloneStatus {
                running: true,
                mode: Some(session.mode),
                version: Some(session.version.clone()),
                binary: inner.settings.bin.clone(),
                rc_url: Some(session.rc_url.clone()),
            },
            None => RcloneStatus {
                running: false,
                mode: None,
                version: None,
                binary: inner.settings.bin.clone(),
                rc_url: inner.settings.rc_url.clone(),
            },
        }
    }
}
