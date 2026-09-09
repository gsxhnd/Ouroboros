use ourboros_core::DownloadSnapshot;
use serde::Serialize;
use tokio::sync::broadcast;

use crate::jobs::JobSnapshot;
use crate::mounts::MountSnapshot;

#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "lowercase")]
pub enum AppEvent {
    Job(JobSnapshot),
    Mount(MountSnapshot),
    Download(DownloadSnapshot),
}

impl AppEvent {
    pub fn name(&self) -> &'static str {
        match self {
            Self::Job(_) => "job",
            Self::Mount(_) => "mount",
            Self::Download(_) => "download",
        }
    }
}

pub fn channel() -> (broadcast::Sender<AppEvent>, broadcast::Receiver<AppEvent>) {
    broadcast::channel(256)
}
