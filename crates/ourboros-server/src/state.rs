use std::sync::Arc;

use ourboros_core::{LibraryManager, VERSION};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub library_manager: Arc<RwLock<LibraryManager>>,
    pub version: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            library_manager: Arc::new(RwLock::new(LibraryManager::new())),
            version: VERSION.to_string(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
