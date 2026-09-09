use std::path::PathBuf;
use std::sync::Arc;

use axum::http::HeaderValue;
use ourboros_core::{home_dir, DownloadManager, RcloneSettings, RcloneSupervisor, VERSION};
use tokio::sync::broadcast;

use crate::events::{self, AppEvent};
use crate::jobs::JobStore;
use crate::mounts::MountSupervisor;
use crate::persist::default_data_dir;
use crate::settings::{apply_settings_to_rclone, SettingsStore};
use crate::workspace::WorkspaceStore;

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub data_dir: Option<PathBuf>,
    pub bind_host: String,
    pub bind_port: u16,
    pub web_dir: Option<PathBuf>,
    pub rclone_bin: Option<String>,
    pub rclone_url: Option<String>,
    pub rclone_config: Option<PathBuf>,
    pub rclone_user: Option<String>,
    pub rclone_pass: Option<String>,
    pub no_auto_rclone: bool,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            data_dir: None,
            bind_host: "127.0.0.1".into(),
            bind_port: 8080,
            web_dir: None,
            rclone_bin: None,
            rclone_url: None,
            rclone_config: None,
            rclone_user: None,
            rclone_pass: None,
            no_auto_rclone: false,
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub version: String,
    pub home_dir: Option<PathBuf>,
    pub data_dir: PathBuf,
    pub cors_origins: Vec<HeaderValue>,
    pub rclone: Arc<RcloneSupervisor>,
    pub workspace: Arc<WorkspaceStore>,
    pub settings: Arc<SettingsStore>,
    pub jobs: Arc<JobStore>,
    pub mounts: Arc<MountSupervisor>,
    pub downloads: Arc<DownloadManager>,
    pub events: broadcast::Sender<AppEvent>,
    pub cli_bin_override: bool,
    pub cli_config_override: bool,
}

impl AppState {
    pub fn new(config: RuntimeConfig) -> anyhow::Result<Self> {
        let data_dir = config.data_dir.clone().unwrap_or_else(default_data_dir);
        std::fs::create_dir_all(&data_dir)?;

        let settings = SettingsStore::load_or_create(data_dir.join("settings.json"))?;
        let settings_doc = settings.get();
        let workspace_path = match &settings_doc.workspace_path {
            Some(path) if path.is_absolute() => path.clone(),
            Some(path) => data_dir.join(path),
            None => data_dir.join("workspace.json"),
        };
        let workspace = WorkspaceStore::load_or_create(workspace_path)?;

        let mut rclone_settings = RcloneSettings {
            bin: settings_doc
                .rclone_bin
                .clone()
                .unwrap_or_else(|| "rclone".into()),
            rc_url: config.rclone_url.clone(),
            rc_user: config.rclone_user.clone(),
            rc_pass: config.rclone_pass.clone(),
            config: settings_doc.rclone_config.clone(),
        };
        apply_settings_to_rclone(&settings_doc, &mut rclone_settings);
        let cli_bin_override = config.rclone_bin.is_some();
        let cli_config_override = config.rclone_config.is_some();
        if let Some(bin) = config.rclone_bin {
            rclone_settings.bin = bin;
        }
        if let Some(rclone_config) = config.rclone_config {
            rclone_settings.config = Some(rclone_config);
        }

        let rclone = Arc::new(RcloneSupervisor::new(rclone_settings));
        let (events, _) = events::channel();
        let jobs = Arc::new(JobStore::new(events.clone()));
        let mounts = Arc::new(MountSupervisor::new(events.clone()));
        let downloads = Arc::new(DownloadManager::new(rclone.client().clone()));

        Ok(Self {
            version: VERSION.to_string(),
            home_dir: home_dir(),
            data_dir,
            cors_origins: cors_origins(&config.bind_host, config.bind_port),
            rclone,
            workspace: Arc::new(workspace),
            settings: Arc::new(settings),
            jobs,
            mounts,
            downloads,
            events,
            cli_bin_override,
            cli_config_override,
        })
    }

    pub fn versions_dir(&self) -> PathBuf {
        self.data_dir.join("rclone").join("versions")
    }
}

pub fn cors_origins(host: &str, port: u16) -> Vec<HeaderValue> {
    let mut origins = vec![
        "http://127.0.0.1:1420".to_string(),
        "http://localhost:1420".to_string(),
        format!("http://127.0.0.1:{port}"),
        format!("http://localhost:{port}"),
    ];
    if host != "127.0.0.1" && host != "localhost" && host != "::1" {
        origins.push(format!("http://{host}:{port}"));
    }
    origins
        .into_iter()
        .filter_map(|origin| origin.parse().ok())
        .collect()
}
