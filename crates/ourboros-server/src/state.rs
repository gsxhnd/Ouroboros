use std::sync::{Arc, Mutex};

use ourboros_core::{LibraryManager, VERSION};

#[derive(Clone)]
pub struct AppState {
    pub library_manager: Arc<Mutex<LibraryManager>>,
    pub version: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            library_manager: Arc::new(Mutex::new(LibraryManager::new())),
            version: VERSION.to_string(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
