use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::LibraryConfig;
use crate::error::{CoreError, CoreResult};
use crate::storage::Database;
use crate::LibraryPaths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryInfo {
    pub name: String,
    pub path: PathBuf,
    pub version: String,
    pub created_at: String,
    pub is_open: bool,
}

pub struct Library {
    pub info: LibraryInfo,
    pub config: LibraryConfig,
    pub paths: LibraryPaths,
    pub db: Database,
}

pub struct LibraryManager {
    current: Option<Library>,
}

impl LibraryManager {
    pub fn new() -> Self {
        Self { current: None }
    }

    pub fn is_open(&self) -> bool {
        self.current.is_some()
    }

    pub fn info(&self) -> Option<LibraryInfo> {
        self.current.as_ref().map(|lib| lib.info.clone())
    }

    pub async fn create(&mut self, root: &Path, name: &str) -> CoreResult<LibraryInfo> {
        if self.current.is_some() {
            return Err(CoreError::AlreadyOpen);
        }

        let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        let paths = LibraryPaths::new(root.clone());

        if paths.meta.exists() {
            return Err(CoreError::AlreadyExists(root.display().to_string()));
        }

        fs::create_dir_all(&root)?;
        fs::create_dir_all(&paths.meta)?;
        fs::create_dir_all(&paths.thumbnails)?;

        let config = LibraryConfig::new(name);
        fs::write(&paths.config, config.to_toml()?)?;

        let db = Database::open(&paths.database).await?;
        let library = Library {
            info: library_info(&root, &config, true),
            config,
            paths,
            db,
        };

        let info = library.info.clone();
        self.current = Some(library);
        Ok(info)
    }

    pub async fn open(&mut self, root: &Path) -> CoreResult<LibraryInfo> {
        if self.current.is_some() {
            return Err(CoreError::AlreadyOpen);
        }

        let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        let paths = LibraryPaths::new(root.clone());

        if !paths.meta.is_dir() {
            return Err(CoreError::NotFound(root.display().to_string()));
        }

        let config_content = fs::read_to_string(&paths.config)?;
        let config = LibraryConfig::load(&config_content)?;
        let db = Database::open(&paths.database).await?;

        let library = Library {
            info: library_info(&root, &config, true),
            config,
            paths,
            db,
        };

        let info = library.info.clone();
        self.current = Some(library);
        Ok(info)
    }

    pub fn close(&mut self) -> CoreResult<()> {
        if self.current.is_none() {
            return Err(CoreError::NotOpen);
        }
        self.current = None;
        Ok(())
    }
}

impl Default for LibraryManager {
    fn default() -> Self {
        Self::new()
    }
}

fn library_info(root: &Path, config: &LibraryConfig, is_open: bool) -> LibraryInfo {
    LibraryInfo {
        name: config.library.name.clone(),
        path: root.to_path_buf(),
        version: config.library.version.clone(),
        created_at: config.library.created_at.to_rfc3339(),
        is_open,
    }
}
