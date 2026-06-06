use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibrarySection {
    pub name: String,
    pub version: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchConfig {
    pub enabled: bool,
    pub ignored_patterns: Vec<String>,
    pub debounce_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailConfig {
    pub small: u32,
    pub medium: u32,
    pub large: u32,
    pub format: String,
    pub quality: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryConfig {
    pub library: LibrarySection,
    pub watch: WatchConfig,
    pub thumbnail: ThumbnailConfig,
}

impl LibraryConfig {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            library: LibrarySection {
                name: name.into(),
                version: "1.0.0".to_string(),
                created_at: Utc::now(),
            },
            watch: WatchConfig {
                enabled: true,
                ignored_patterns: vec![
                    ".DS_Store".to_string(),
                    "Thumbs.db".to_string(),
                    ".git".to_string(),
                ],
                debounce_ms: 500,
            },
            thumbnail: ThumbnailConfig {
                small: 200,
                medium: 400,
                large: 800,
                format: "webp".to_string(),
                quality: 80,
            },
        }
    }

    pub fn load(content: &str) -> Result<Self, toml::de::Error> {
        toml::from_str(content)
    }

    pub fn to_toml(&self) -> Result<String, toml::ser::Error> {
        toml::to_string_pretty(self)
    }
}
