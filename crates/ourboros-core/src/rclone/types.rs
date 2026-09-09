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
}

#[derive(Clone)]
pub struct RcloneSettings {
    pub bin: String,
    pub rc_url: Option<String>,
    pub rc_user: Option<String>,
    pub rc_pass: Option<String>,
    pub config: Option<std::path::PathBuf>,
}

impl std::fmt::Debug for RcloneSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RcloneSettings")
            .field("bin", &self.bin)
            .field("rc_url", &self.rc_url.as_ref().map(|_| "<redacted-host>"))
            .field("rc_user", &self.rc_user.as_ref().map(|_| "***"))
            .field("rc_pass", &self.rc_pass.as_ref().map(|_| "***"))
            .field("config", &self.config)
            .finish()
    }
}

impl Default for RcloneSettings {
    fn default() -> Self {
        Self {
            bin: "rclone".to_string(),
            rc_url: None,
            rc_user: None,
            rc_pass: None,
            config: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RcResponse {
    pub status: u16,
    pub body: serde_json::Value,
}

impl RcResponse {
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }
}

#[derive(Debug, Deserialize)]
pub struct RcloneVersion {
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RcloneSourceKind {
    Custom,
    Managed,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcloneCandidate {
    pub source: RcloneSourceKind,
    pub path: String,
    pub version: Option<String>,
    pub valid: bool,
    pub managed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcloneRelease {
    pub version: String,
    pub filename: String,
    pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Verifying,
    Extracting,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSnapshot {
    pub id: String,
    pub version: String,
    pub status: DownloadStatus,
    pub bytes: u64,
    pub total_bytes: Option<u64>,
    pub error: Option<String>,
}
