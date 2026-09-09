use std::net::SocketAddr;
use std::process::Stdio;
use std::time::Duration;

use rand::distributions::Alphanumeric;
use rand::Rng;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::time::sleep;
use url::Url;

use crate::error::{CoreError, CoreResult};

use super::client::{RcAuth, RcClient};
use super::types::RcloneSettings;

pub struct SpawnedDaemon {
    pub child: Child,
    pub rc_url: String,
    pub auth: RcAuth,
}

pub fn generate_rc_auth() -> RcAuth {
    RcAuth {
        user: random_token(16),
        pass: random_token(32),
    }
}

pub fn parse_attach_url(raw: &str) -> CoreResult<(String, Option<RcAuth>)> {
    let parsed = Url::parse(raw)
        .map_err(|error| CoreError::InvalidRequest(format!("invalid rclone RC URL: {error}")))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(CoreError::InvalidRequest(
            "rclone RC URL must be http or https".into(),
        ));
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| CoreError::InvalidRequest("rclone RC URL is missing a host".into()))?;
    if !is_loopback_host(host) {
        return Err(CoreError::InvalidRequest(
            "rclone RC must listen on a loopback address".into(),
        ));
    }

    let auth = if !parsed.username().is_empty() {
        Some(RcAuth {
            user: parsed.username().to_string(),
            pass: parsed.password().unwrap_or_default().to_string(),
        })
    } else {
        None
    };

    let mut sanitized = parsed;
    let _ = sanitized.set_username("");
    let _ = sanitized.set_password(None);
    Ok((
        sanitized.to_string().trim_end_matches('/').to_string(),
        auth,
    ))
}

pub fn is_loopback_host(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "localhost" | "::1" | "[::1]")
}

pub async fn spawn_daemon(
    settings: &RcloneSettings,
    client: &RcClient,
) -> CoreResult<SpawnedDaemon> {
    let port = pick_local_port().await?;
    let rc_addr = format!("127.0.0.1:{port}");
    let rc_url = format!("http://{rc_addr}");
    let auth = generate_rc_auth();

    let mut command = Command::new(&settings.bin);
    command
        .arg("rcd")
        .arg("--rc-addr")
        .arg(&rc_addr)
        .arg("--rc-job-expire-duration")
        .arg("24h")
        .env("RCLONE_RC_USER", &auth.user)
        .env("RCLONE_RC_PASS", &auth.pass)
        .kill_on_drop(true)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(config) = &settings.config {
        command.arg("--config").arg(config);
    }

    tracing::info!(bin = %settings.bin, rc_addr = %rc_addr, "starting rclone rcd");

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            CoreError::BinaryNotFound(settings.bin.clone())
        } else {
            CoreError::Io(error)
        }
    })?;

    pipe_output(child.stderr.take(), "rclone.stderr");
    pipe_output(child.stdout.take(), "rclone.stdout");

    wait_until_ready(client, &rc_url, Some(&auth)).await?;

    Ok(SpawnedDaemon {
        child,
        rc_url,
        auth,
    })
}

async fn pick_local_port() -> CoreResult<u16> {
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

async fn wait_until_ready(
    client: &RcClient,
    rc_url: &str,
    auth: Option<&RcAuth>,
) -> CoreResult<()> {
    for _ in 0..50 {
        if client.version(rc_url, auth).await.is_ok() {
            return Ok(());
        }
        sleep(Duration::from_millis(100)).await;
    }

    Err(CoreError::ReadyTimeout)
}

pub async fn wait_until_attached(
    client: &RcClient,
    rc_url: &str,
    auth: Option<&RcAuth>,
) -> CoreResult<()> {
    wait_until_ready(client, rc_url, auth).await
}

fn pipe_output(
    pipe: Option<impl tokio::io::AsyncRead + Unpin + Send + 'static>,
    target: &'static str,
) {
    let Some(pipe) = pipe else {
        return;
    };
    tokio::spawn(async move {
        let mut lines = BufReader::new(pipe).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            tracing::debug!(target, "{line}");
        }
    });
}

fn random_token(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{is_loopback_host, parse_attach_url};

    #[test]
    fn parse_attach_url_should_require_loopback_and_strip_userinfo() {
        let (url, auth) = parse_attach_url("http://user:secret@127.0.0.1:5572").unwrap();
        assert_eq!(url, "http://127.0.0.1:5572");
        assert_eq!(auth.unwrap().user, "user");
        assert!(parse_attach_url("http://192.168.1.10:5572").is_err());
        assert!(is_loopback_host("localhost"));
    }
}
