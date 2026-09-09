use std::path::PathBuf;
use std::process::Stdio;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

use crate::error::{CoreError, CoreResult};
use crate::paths::FileLocator;

use super::types::RcloneSettings;

pub struct SpawnedMount {
    pub child: Child,
    pub stderr_rx: mpsc::Receiver<String>,
}

pub async fn spawn_mount(
    settings: &RcloneSettings,
    source: &FileLocator,
    mount_point: &PathBuf,
    extra_args: &[&str],
) -> CoreResult<SpawnedMount> {
    std::fs::create_dir_all(mount_point)?;

    let mut command = Command::new(&settings.bin);
    command
        .arg("mount")
        .arg(source.combined_fs())
        .arg(mount_point)
        .kill_on_drop(true)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(config) = &settings.config {
        command.arg("--config").arg(config);
    }
    for arg in extra_args {
        command.arg(arg);
    }

    tracing::info!(
        bin = %settings.bin,
        source = %source.display(),
        mount_point = %mount_point.display(),
        "starting rclone mount"
    );

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            CoreError::BinaryNotFound(settings.bin.clone())
        } else {
            CoreError::Io(error)
        }
    })?;

    let (tx, rx) = mpsc::channel(64);
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "rclone.mount", "{line}");
                if tx.send(line).await.is_err() {
                    break;
                }
            }
        });
    }
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "rclone.mount", "{line}");
            }
        });
    }

    Ok(SpawnedMount {
        child,
        stderr_rx: rx,
    })
}
