use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use zip::ZipArchive;

use crate::error::{CoreError, CoreResult};

use super::client::RcClient;
use super::discovery::{inspect, managed_binary_path};
use super::types::{DownloadSnapshot, DownloadStatus, RcloneRelease, RcloneSourceKind};

const DOWNLOADS_BASE: &str = "https://downloads.rclone.org";

#[derive(Clone)]
pub struct DownloadManager {
    client: RcClient,
    inner: Arc<RwLock<Vec<DownloadTask>>>,
}

struct DownloadTask {
    snapshot: DownloadSnapshot,
    cancel: CancellationToken,
}

impl DownloadManager {
    pub fn new(client: RcClient) -> Self {
        Self {
            client,
            inner: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn snapshot(&self, id: &str) -> CoreResult<DownloadSnapshot> {
        self.inner
            .read()
            .await
            .iter()
            .find(|task| task.snapshot.id == id)
            .map(|task| task.snapshot.clone())
            .ok_or_else(|| CoreError::NotFound(format!("download {id}")))
    }

    pub async fn start(
        &self,
        version: &str,
        versions_dir: PathBuf,
        on_progress: impl Fn(DownloadSnapshot) + Send + Sync + 'static,
    ) -> CoreResult<DownloadSnapshot> {
        let version = normalize_version(version);
        let id = format!("dl-{version}-{}", now_millis());
        let cancel = CancellationToken::new();
        let snapshot = DownloadSnapshot {
            id: id.clone(),
            version: version.clone(),
            status: DownloadStatus::Queued,
            bytes: 0,
            total_bytes: None,
            error: None,
        };
        {
            let mut inner = self.inner.write().await;
            inner.push(DownloadTask {
                snapshot: snapshot.clone(),
                cancel: cancel.clone(),
            });
        }

        let manager = self.clone();
        let client = self.client.clone();
        let progress: Arc<dyn Fn(DownloadSnapshot) + Send + Sync> = Arc::new(on_progress);
        tokio::spawn(async move {
            let result = run_download(
                &client,
                &manager,
                &id,
                &version,
                &versions_dir,
                cancel,
                progress.clone(),
            )
            .await;
            if let Err(error) = result {
                manager
                    .update(&id, |snapshot| {
                        snapshot.status = DownloadStatus::Failed;
                        snapshot.error = Some(error.to_string());
                    })
                    .await;
                if let Ok(snapshot) = manager.snapshot(&id).await {
                    progress(snapshot);
                }
            }
        });

        Ok(snapshot)
    }

    pub async fn cancel(&self, id: &str) -> CoreResult<DownloadSnapshot> {
        let mut inner = self.inner.write().await;
        let task = inner
            .iter_mut()
            .find(|task| task.snapshot.id == id)
            .ok_or_else(|| CoreError::NotFound(format!("download {id}")))?;
        task.cancel.cancel();
        if !matches!(
            task.snapshot.status,
            DownloadStatus::Completed | DownloadStatus::Failed | DownloadStatus::Cancelled
        ) {
            task.snapshot.status = DownloadStatus::Cancelled;
            task.snapshot.error = Some("download cancelled".into());
        }
        Ok(task.snapshot.clone())
    }

    async fn update(&self, id: &str, mutate: impl FnOnce(&mut DownloadSnapshot)) {
        let mut inner = self.inner.write().await;
        if let Some(task) = inner.iter_mut().find(|task| task.snapshot.id == id) {
            mutate(&mut task.snapshot);
        }
    }
}

pub async fn current_release(client: &RcClient) -> CoreResult<RcloneRelease> {
    let text = client
        .http()
        .get(format!("{DOWNLOADS_BASE}/version.txt"))
        .send()
        .await
        .map_err(|error| CoreError::Transport(error.to_string()))?
        .error_for_status()
        .map_err(|error| CoreError::Transport(error.to_string()))?
        .text()
        .await
        .map_err(|error| CoreError::Transport(error.to_string()))?;
    let version = super::discovery::parse_version_output(&text)
        .ok_or_else(|| CoreError::Transport("could not parse rclone version.txt".into()))?;
    release_for_platform(&version)
}

pub fn release_for_platform(version: &str) -> CoreResult<RcloneRelease> {
    let version = normalize_version(version);
    let filename = archive_name(&version)?;
    Ok(RcloneRelease {
        version: version.clone(),
        filename: filename.clone(),
        url: format!("{DOWNLOADS_BASE}/{version}/{filename}"),
    })
}

pub fn parse_sha256sums(manifest: &str, filename: &str) -> CoreResult<String> {
    for line in manifest.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.split_whitespace();
        let Some(hash) = parts.next() else {
            continue;
        };
        let Some(name) = parts.next() else {
            continue;
        };
        let name = name.trim_start_matches('*');
        if name == filename {
            return Ok(hash.to_ascii_lowercase());
        }
    }
    Err(CoreError::NotFound(format!("SHA-256 entry for {filename}")))
}

async fn run_download(
    client: &RcClient,
    manager: &DownloadManager,
    id: &str,
    version: &str,
    versions_dir: &Path,
    cancel: CancellationToken,
    on_progress: Arc<dyn Fn(DownloadSnapshot) + Send + Sync>,
) -> CoreResult<PathBuf> {
    let release = release_for_platform(version)?;
    emit(manager, id, on_progress.as_ref(), |snapshot| {
        snapshot.status = DownloadStatus::Downloading;
    })
    .await;

    let response = client
        .http()
        .get(&release.url)
        .send()
        .await
        .map_err(|error| CoreError::Transport(error.to_string()))?
        .error_for_status()
        .map_err(|error| CoreError::Transport(error.to_string()))?;
    let total = response.content_length();
    emit(manager, id, on_progress.as_ref(), |snapshot| {
        snapshot.total_bytes = total;
    })
    .await;

    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancel.is_cancelled() {
            return Err(CoreError::InvalidRequest("download cancelled".into()));
        }
        let chunk = chunk.map_err(|error| CoreError::Transport(error.to_string()))?;
        bytes.extend_from_slice(&chunk);
        emit(manager, id, on_progress.as_ref(), |snapshot| {
            snapshot.bytes = bytes.len() as u64;
            snapshot.status = DownloadStatus::Downloading;
        })
        .await;
    }

    emit(manager, id, on_progress.as_ref(), |snapshot| {
        snapshot.status = DownloadStatus::Verifying;
    })
    .await;

    let manifest = client
        .http()
        .get(format!("{DOWNLOADS_BASE}/{version}/SHA256SUMS"))
        .send()
        .await
        .map_err(|error| CoreError::Transport(error.to_string()))?
        .error_for_status()
        .map_err(|error| CoreError::Transport(error.to_string()))?
        .text()
        .await
        .map_err(|error| CoreError::Transport(error.to_string()))?;
    let expected = parse_sha256sums(&manifest, &release.filename)?;
    let actual = sha256_hex(&bytes);
    if actual != expected {
        return Err(CoreError::InvalidRequest(format!(
            "SHA-256 mismatch for {}",
            release.filename
        )));
    }

    emit(manager, id, on_progress.as_ref(), |snapshot| {
        snapshot.status = DownloadStatus::Extracting;
    })
    .await;

    let dest_dir = versions_dir.join(version);
    std::fs::create_dir_all(&dest_dir)?;
    let dest = managed_binary_path(versions_dir, version);
    extract_rclone_binary(&bytes, &dest)?;

    let candidate = inspect(&dest, RcloneSourceKind::Managed, true).await;
    if !candidate.valid {
        let _ = std::fs::remove_file(&dest);
        return Err(CoreError::InvalidRequest(candidate.error.unwrap_or_else(
            || "downloaded rclone failed version check".into(),
        )));
    }

    emit(manager, id, on_progress.as_ref(), |snapshot| {
        snapshot.status = DownloadStatus::Completed;
        snapshot.error = None;
    })
    .await;
    Ok(dest)
}

async fn emit(
    manager: &DownloadManager,
    id: &str,
    on_progress: &(dyn Fn(DownloadSnapshot) + Send + Sync),
    mutate: impl FnOnce(&mut DownloadSnapshot),
) {
    manager.update(id, mutate).await;
    if let Ok(snapshot) = manager.snapshot(id).await {
        on_progress(snapshot);
    }
}

fn extract_rclone_binary(zip_bytes: &[u8], dest: &Path) -> CoreResult<()> {
    let mut archive = ZipArchive::new(Cursor::new(zip_bytes))
        .map_err(|error| CoreError::InvalidRequest(format!("invalid rclone zip: {error}")))?;
    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| CoreError::InvalidRequest(format!("invalid rclone zip: {error}")))?;
        let name = file.name().replace('\\', "/");
        if name.contains("__MACOSX") {
            continue;
        }
        let file_name = name.rsplit('/').next().unwrap_or(&name);
        if file_name != "rclone" && file_name != "rclone.exe" {
            continue;
        }
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = std::fs::File::create(dest)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(CoreError::Io)?;
        out.write_all(&buffer)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(dest, std::fs::Permissions::from_mode(0o755))?;
        }
        return Ok(());
    }
    Err(CoreError::NotFound(
        "rclone binary inside downloaded archive".into(),
    ))
}

fn archive_name(version: &str) -> CoreResult<String> {
    let os_arch = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "osx-arm64",
        ("macos", "x86_64") => "osx-amd64",
        ("linux", "aarch64") => "linux-arm64",
        ("linux", "x86_64") => "linux-amd64",
        ("windows", "aarch64") => "windows-arm64",
        ("windows", "x86_64") => "windows-amd64",
        (os, arch) => {
            return Err(CoreError::InvalidRequest(format!(
                "unsupported platform {os}/{arch}"
            )))
        }
    };
    Ok(format!("rclone-{version}-{os_arch}.zip"))
}

pub fn normalize_version(version: &str) -> String {
    let trimmed = version.trim().trim_start_matches("rclone").trim();
    if trimmed.starts_with('v') {
        trimmed.to_string()
    } else {
        format!("v{trimmed}")
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{parse_sha256sums, sha256_hex};

    #[test]
    fn parse_sha256sums_should_match_filename() {
        let manifest =
            "abc123  rclone-v1.74.0-osx-arm64.zip\ndef456 *rclone-v1.74.0-linux-amd64.zip\n";
        assert_eq!(
            parse_sha256sums(manifest, "rclone-v1.74.0-osx-arm64.zip").unwrap(),
            "abc123"
        );
        assert_eq!(
            parse_sha256sums(manifest, "rclone-v1.74.0-linux-amd64.zip").unwrap(),
            "def456"
        );
        assert!(parse_sha256sums(manifest, "missing.zip").is_err());
    }

    #[test]
    fn sha256_hex_should_hash_bytes() {
        assert_eq!(
            sha256_hex(b"hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }
}
