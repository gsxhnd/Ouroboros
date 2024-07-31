use ouroboros_core::db::Database;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub(crate) conn: Database,
}

impl AppState {
    pub(crate) async fn new(cfg: Config) -> Self {
        let conn = ouroboros_core::db::Database::new("sqlite:todos.db?mode=rwc").await;
        AppState { conn }
    }
}

