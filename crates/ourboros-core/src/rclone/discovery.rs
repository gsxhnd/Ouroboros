use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::error::{CoreError, CoreResult};

use super::types::{RcloneCandidate, RcloneSourceKind};

pub async fn scan(custom: Option<&Path>, managed_dir: Option<&Path>) -> Vec<RcloneCandidate> {
    let mut candidates = Vec::new();

    if let Some(path) = custom {
        candidates.push(inspect(path, RcloneSourceKind::Custom, false).await);
    }

    if let Some(managed_dir) = managed_dir {
        candidates.extend(scan_managed(managed_dir).await);
    }

    for path in find_system_binaries() {
        if candidates.iter().any(|item| Path::new(&item.path) == path) {
            continue;
        }
        candidates.push(inspect(&path, RcloneSourceKind::System, false).await);
    }

    candidates
}

pub async fn inspect(path: &Path, source: RcloneSourceKind, managed: bool) -> RcloneCandidate {
    match read_version(path).await {
        Ok(version) => RcloneCandidate {
            source,
            path: path.display().to_string(),
            version: Some(version),
            valid: true,
            managed,
            error: None,
        },
        Err(error) => RcloneCandidate {
            source,
            path: path.display().to_string(),
            version: None,
            valid: false,
            managed,
            error: Some(error.to_string()),
        },
    }
}

pub async fn read_version(path: &Path) -> CoreResult<String> {
    let mut command = Command::new(path);
    command
        .arg("version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = timeout(Duration::from_secs(5), command.output())
        .await
        .map_err(|_| CoreError::ReadyTimeout)?
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                CoreError::BinaryNotFound(path.display().to_string())
            } else {
                CoreError::Io(error)
            }
        })?;

    if !output.status.success() {
        return Err(CoreError::InvalidRequest(format!(
            "rclone version failed for {}",
            path.display()
        )));
    }

    parse_version_output(&String::from_utf8_lossy(&output.stdout))
        .ok_or_else(|| CoreError::InvalidRequest("unrecognized rclone version output".into()))
}

pub fn parse_version_output(stdout: &str) -> Option<String> {
    let line = stdout.lines().next()?.trim();
    let version = line.split_whitespace().find(|part| {
        part.starts_with('v') || part.chars().next().is_some_and(|ch| ch.is_ascii_digit())
    })?;
    if version.starts_with('v') {
        Some(version.to_string())
    } else {
        Some(format!("v{version}"))
    }
}

pub fn managed_binary_path(versions_dir: &Path, version: &str) -> PathBuf {
    let exe = if cfg!(windows) {
        "rclone.exe"
    } else {
        "rclone"
    };
    versions_dir.join(version).join(exe)
}

async fn scan_managed(managed_dir: &Path) -> Vec<RcloneCandidate> {
    let mut found = Vec::new();
    let Ok(entries) = std::fs::read_dir(managed_dir) else {
        return found;
    };
    for entry in entries.flatten() {
        if !entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
            continue;
        }
        let version = entry.file_name();
        let path = managed_binary_path(managed_dir, &version.to_string_lossy());
        if path.is_file() {
            found.push(inspect(&path, RcloneSourceKind::Managed, true).await);
        }
    }
    found.sort_by(|a, b| b.path.cmp(&a.path));
    found
}

fn find_system_binaries() -> Vec<PathBuf> {
    let mut found = Vec::new();
    let names = if cfg!(windows) {
        vec!["rclone.exe", "rclone"]
    } else {
        vec!["rclone"]
    };
    let Some(path_var) = std::env::var_os("PATH") else {
        return found;
    };
    for dir in std::env::split_paths(&path_var) {
        for name in &names {
            let candidate = dir.join(name);
            if candidate.is_file() && !found.iter().any(|existing| existing == &candidate) {
                found.push(candidate);
            }
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::parse_version_output;

    #[test]
    fn parse_version_output_should_read_first_line() {
        let output = "rclone v1.74.0\n- os/version: darwin 25.6.0\n";
        assert_eq!(parse_version_output(output).as_deref(), Some("v1.74.0"));
    }
}
