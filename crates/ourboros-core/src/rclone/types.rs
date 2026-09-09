use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RcloneMode {
    Spawned,
    Attached,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcloneStatus {
    pub running: bool,
    pub mode: Option<RcloneMode>,
    pub version: Option<String>,
    pub binary: String,
    pub rc_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RcloneSettings {
    pub bin: String,
    pub rc_url: Option<String>,
    pub config: Option<std::path::PathBuf>,
}

impl Default for RcloneSettings {
    fn default() -> Self {
        Self {
            bin: "rclone".to_string(),
            rc_url: None,
            config: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RcResponse {
    pub status: u16,
    pub body: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct RcloneVersion {
    pub version: String,
}
