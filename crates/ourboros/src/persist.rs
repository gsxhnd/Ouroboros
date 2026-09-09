use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use ourboros_core::{CoreError, CoreResult};
use serde::Serialize;

pub fn atomic_write(path: &Path, bytes: &[u8]) -> CoreResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| CoreError::InvalidPath(format!("path has no parent: {}", path.display())))?;
    fs::create_dir_all(parent)?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");
    let tmp = parent.join(format!(".{file_name}.{}.tmp", std::process::id()));
    let write_result = (|| {
        let mut file = File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok::<(), CoreError>(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&tmp);
        return Err(error);
    }
    if cfg!(windows) && path.exists() {
        fs::remove_file(path)?;
    }
    fs::rename(&tmp, path).map_err(|error| {
        let _ = fs::remove_file(&tmp);
        CoreError::Io(error)
    })
}

pub fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> CoreResult<()> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| CoreError::CorruptStore {
        message: format!("failed to serialize {}: {error}", path.display()),
    })?;
    atomic_write(path, &bytes)
}

pub fn read_json_bytes(path: &Path) -> CoreResult<Vec<u8>> {
    fs::read(path).map_err(CoreError::from)
}

pub fn default_data_dir() -> std::path::PathBuf {
    if let Ok(raw) = std::env::var("OURBOROS_DATA_DIR") {
        return std::path::PathBuf::from(raw);
    }
    directories::ProjectDirs::from("dev", "Ourboros", "Ourboros")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from(".").join("ourboros-data"))
}
