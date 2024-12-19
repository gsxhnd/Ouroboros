use sqlx::{
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    ConnectOptions, Pool, Sqlite,
};

use serde::{Deserialize, Serialize};
use surrealdb::engine::local::RocksDb;
use surrealdb::RecordId;
use surrealdb::Surreal;
// use surrealdb::engine::local

mod file;
mod file_tag;
mod folder;
mod tag;

#[derive(Debug, Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

#[derive(Debug, Serialize)]
struct Person {
    title: String,
    name: String,
    marketing: bool,
}

#[derive(Debug, Deserialize)]
struct Record {
    #[allow(dead_code)]
    id: RecordId,
}

impl Database {
    pub async fn new(db_path: &str) -> Database {
        let mut conn_opt: SqliteConnectOptions = db_path.parse().unwrap();
        conn_opt = conn_opt.log_statements(log::LevelFilter::Info);

        let pool_option = SqlitePoolOptions::new();
        let pool = pool_option.connect_with(conn_opt).await.unwrap();

        Migrator::new(std::path::Path::new("./migrations"))
            .await
            .unwrap()
            .run(&pool)
            .await
            .unwrap();

        let db = Surreal::new::<RocksDb>("./data/123").await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();

        let created: Option<Record> = db
            .create("person")
            .content(Person {
                title: "Founder & CEO".to_string(),
                name: "Founder & CEO".to_string(),
                marketing: true,
            })
            .await
            .unwrap();
        let people: Vec<Record> = db.select("person").await.unwrap();
        dbg!(people);
        Database { pool }
    }
}
