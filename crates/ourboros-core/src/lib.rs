use std::path::PathBuf;

pub mod config;
pub mod error;
pub mod library;
pub mod storage;

pub use config::LibraryConfig;
pub use error::{CoreError, CoreResult};
pub use library::{Library, LibraryInfo, LibraryManager};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const META_DIR: &str = ".ourboros";
pub const DATABASE_FILE: &str = "database.db";
pub const CONFIG_FILE: &str = "config.toml";
pub const THUMBNAILS_DIR: &str = "thumbnails";

#[derive(Debug, Clone)]
pub struct LibraryPaths {
    pub root: PathBuf,
    pub meta: PathBuf,
    pub database: PathBuf,
    pub config: PathBuf,
    pub thumbnails: PathBuf,
}

impl LibraryPaths {
    pub fn new(root: PathBuf) -> Self {
        let meta = root.join(META_DIR);
        Self {
            database: meta.join(DATABASE_FILE),
            config: meta.join(CONFIG_FILE),
            thumbnails: meta.join(THUMBNAILS_DIR),
            meta,
            root,
        }
    }
}
