use owl_db::database;
use tracing::debug;

#[derive(Debug, Clone)]
pub struct AppState {
    pub db: database::Database,
}

impl AppState {
    pub async fn new(data_path: String) -> Self {
        debug!("init app state");
        let db = database::Database::new(data_path).await;
        AppState { db }
    }
}
