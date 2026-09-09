pub mod error;
pub mod paths;
pub mod rclone;

pub use error::{CoreError, CoreResult};
pub use paths::{FileLocator, PathKind};
pub use rclone::{
    current_release, managed_binary_path, normalize_version, parse_attach_url, read_version,
    release_for_platform, scan, spawn_mount, validate_proxy_command, DownloadManager,
    DownloadSnapshot, DownloadStatus, RcResponse, RcloneCandidate, RcloneMode, RcloneRelease,
    RcloneSettings, RcloneSourceKind, RcloneStatus, RcloneSupervisor, SpawnedMount,
};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
}
