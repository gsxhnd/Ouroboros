use ouroboros_core::{db::Database, tree::Tree};
use std::sync::Arc;

use crate::config::Config;

#[derive(Clone)]
pub(crate) struct AppState {
    pub conn: Database,
    pub cfg: Config,
}

impl AppState {
    pub(crate) async fn new(cfg: Config) -> Self {
        let url = format!(
            "sqlite:{}/{}?mode=rwc",
            cfg.common.data_path, ".ouroboros/data.db"
        );

        let conn = ouroboros_core::db::Database::new(url.as_str()).await;
        AppState { conn, cfg }
    }
}
