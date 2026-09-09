pub mod error;
pub mod rclone;

pub use error::{CoreError, CoreResult};
pub use rclone::{RcResponse, RcloneMode, RcloneSettings, RcloneStatus, RcloneSupervisor};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
}
