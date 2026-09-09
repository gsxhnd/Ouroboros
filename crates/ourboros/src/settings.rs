use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use ourboros_core::{CoreError, CoreResult, RcloneSettings, RcloneSourceKind};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Mutex;

use crate::persist::{atomic_write_json, read_json_bytes};

pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsDocument {
    pub schema_version: u32,
    pub rclone_source: RcloneSourceKind,
    #[serde(default)]
    pub rclone_bin: Option<String>,
    #[serde(default)]
    pub rclone_config: Option<PathBuf>,
    #[serde(default = "default_true")]
    pub auto_start: bool,
    #[serde(default)]
    pub workspace_path: Option<PathBuf>,
    pub updated_at: DateTime<Utc>,
}

fn default_true() -> bool {
    true
}

impl SettingsDocument {
    pub fn default_new() -> Self {
        Self {
            schema_version: SETTINGS_SCHEMA_VERSION,
            rclone_source: RcloneSourceKind::System,
            rclone_bin: None,
            rclone_config: None,
            auto_start: true,
            workspace_path: None,
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SettingsPatch {
    pub rclone_source: Option<RcloneSourceKind>,
    pub rclone_bin: Option<Option<String>>,
    pub rclone_config: Option<Option<PathBuf>>,
    pub auto_start: Option<bool>,
    pub workspace_path: Option<Option<PathBuf>>,
}

pub struct SettingsStore {
    path: PathBuf,
    inner: Mutex<SettingsDocument>,
}

impl SettingsStore {
    pub fn load_or_create(path: PathBuf) -> CoreResult<Self> {
        let document = if path.exists() {
            load_settings(&path)?
        } else {
            let document = SettingsDocument::default_new();
            atomic_write_json(&path, &document)?;
            document
        };
        Ok(Self {
            path,
            inner: Mutex::new(document),
        })
    }

    pub fn get(&self) -> SettingsDocument {
        self.inner
            .lock()
            .unwrap_or_else(|err| err.into_inner())
            .clone()
    }

    pub fn patch(&self, patch: SettingsPatch) -> CoreResult<SettingsDocument> {
        let mut guard = self.inner.lock().unwrap_or_else(|err| err.into_inner());
        if let Some(source) = patch.rclone_source {
            guard.rclone_source = source;
        }
        if let Some(bin) = patch.rclone_bin {
            guard.rclone_bin = bin;
        }
        if let Some(config) = patch.rclone_config {
            guard.rclone_config = config;
        }
        if let Some(auto_start) = patch.auto_start {
            guard.auto_start = auto_start;
        }
        if let Some(workspace_path) = patch.workspace_path {
            guard.workspace_path = workspace_path;
        }
        guard.updated_at = Utc::now();
        atomic_write_json(&self.path, &*guard)?;
        Ok(guard.clone())
    }
}

pub fn apply_settings_to_rclone(settings: &SettingsDocument, rclone: &mut RcloneSettings) {
    if let Some(bin) = &settings.rclone_bin {
        rclone.bin = bin.clone();
    }
    if rclone.config.is_none() {
        rclone.config = settings.rclone_config.clone();
    }
}

fn load_settings(path: &Path) -> CoreResult<SettingsDocument> {
    let bytes = read_json_bytes(path)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| CoreError::CorruptStore {
        message: format!("{}: {error}", path.display()),
    })?;
    migrate_settings(value)
}

fn migrate_settings(value: Value) -> CoreResult<SettingsDocument> {
    let version = value
        .get("schema_version")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u32;
    let migrated = match version {
        0 => {
            let mut object = match value {
                Value::Object(map) => map,
                _ => {
                    return Err(CoreError::CorruptStore {
                        message: "settings document is not an object".into(),
                    })
                }
            };
            object
                .entry("schema_version")
                .or_insert_with(|| json!(SETTINGS_SCHEMA_VERSION));
            object
                .entry("rclone_source")
                .or_insert_with(|| json!("system"));
            object.entry("auto_start").or_insert_with(|| json!(true));
            object
                .entry("updated_at")
                .or_insert_with(|| json!(Utc::now()));
            Value::Object(object)
        }
        SETTINGS_SCHEMA_VERSION => value,
        other => {
            return Err(CoreError::UnsupportedSchema {
                document: "settings".into(),
                version: other,
            })
        }
    };
    serde_json::from_value(migrated).map_err(|error| CoreError::CorruptStore {
        message: format!("settings: {error}"),
    })
}
