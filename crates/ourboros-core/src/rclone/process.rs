use std::net::SocketAddr;
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::time::sleep;

use crate::error::{CoreError, CoreResult};

use super::client::RcClient;
use super::types::RcloneSettings;

pub struct SpawnedDaemon {
    pub child: Child,
    pub rc_url: String,
}

pub async fn spawn_daemon(settings: &RcloneSettings, client: &RcClient) -> CoreResult<SpawnedDaemon> {
    let port = pick_local_port().await?;
    let rc_addr = format!("127.0.0.1:{port}");
    let rc_url = format!("http://{rc_addr}");

    let mut command = Command::new(&settings.bin);
    command
        .arg("rcd")
        .arg("--rc-addr")
        .arg(&rc_addr)
        .arg("--rc-no-auth")
        .kill_on_drop(true)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(config) = &settings.config {
        command.arg("--config").arg(config);
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            CoreError::BinaryNotFound(settings.bin.clone())
        } else {
            CoreError::Io(error)
        }
    })?;

    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "rclone", "{line}");
            }
        });
    }

    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "rclone", "{line}");
            }
        });
    }

    wait_until_ready(client, &rc_url).await?;

    Ok(SpawnedDaemon { child, rc_url })
}

async fn pick_local_port() -> CoreResult<u16> {
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

async fn wait_until_ready(client: &RcClient, rc_url: &str) -> CoreResult<()> {
    for _ in 0..50 {
        if client.version(rc_url).await.is_ok() {
            return Ok(());
        }
        sleep(Duration::from_millis(100)).await;
    }

    Err(CoreError::ReadyTimeout)
}

pub async fn wait_until_attached(client: &RcClient, rc_url: &str) -> CoreResult<()> {
    wait_until_ready(client, rc_url).await
}
