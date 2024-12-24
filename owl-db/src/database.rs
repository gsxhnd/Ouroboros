//use serde::{Deserialize, Serialize};
use surrealdb::engine::local::RocksDb;
use tracing::debug;
//use surrealdb::RecordId;
use std::path::Path;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

#[derive(Debug, Clone)]
pub struct Database {
    pub db: Surreal<Db>,
}

impl Database {
    pub async fn new(data_path: String) -> Self {
        let db_path = Path::new(data_path.as_str()).join(".owl").join("db");
        let db_path_str = db_path.to_str().unwrap();
        debug!("init db path: {}", db_path_str);
        let db = Surreal::new::<RocksDb>(db_path_str).await.unwrap();
        Database { db }
    }
}
