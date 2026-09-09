use std::path::PathBuf;
use std::sync::Arc;

use ourboros_core::{home_dir, RcloneSettings, RcloneSupervisor, VERSION};

#[derive(Clone)]
pub struct AppState {
    pub rclone: Arc<RcloneSupervisor>,
    pub version: String,
    pub home_dir: Option<PathBuf>,
}

impl AppState {
    pub fn new(settings: RcloneSettings) -> Self {
        Self {
            rclone: Arc::new(RcloneSupervisor::new(settings)),
            version: VERSION.to_string(),
            home_dir: home_dir(),
        }
    }
}
