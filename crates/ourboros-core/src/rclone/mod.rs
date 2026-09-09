mod client;
mod command;
mod discovery;
mod download;
mod mount;
mod process;
mod supervisor;
mod types;

pub use client::{RcAuth, RcClient};
pub use command::{validate_command, validate_proxy_command};
pub use discovery::{managed_binary_path, read_version, scan};
pub use download::{
    current_release, normalize_version, parse_sha256sums, release_for_platform, DownloadManager,
};
pub use mount::{spawn_mount, SpawnedMount};
pub use process::{is_loopback_host, parse_attach_url};
pub use supervisor::RcloneSupervisor;
pub use types::{
    DownloadSnapshot, DownloadStatus, RcResponse, RcloneCandidate, RcloneMode, RcloneRelease,
    RcloneSettings, RcloneSourceKind, RcloneStatus, RcloneVersion,
};
