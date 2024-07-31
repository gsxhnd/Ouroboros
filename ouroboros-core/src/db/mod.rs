use sqlx::{sqlite::SqlitePool, Pool, Sqlite};

#[derive(Debug, Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(db_path: &str) -> Database {
        let pool = SqlitePool::connect(db_path).await.unwrap();
        Database { pool }
    }

    pub async fn get_all(&self) {
        match sqlx::query("SELECT id, description, done FROM todos ORDER BY id")
            .fetch_all(&self.pool)
            .await
        {
            Ok(_rows) => {}
            Err(err) => {
                println!("{}", err)
            }
        }
    }
}

#[tokio::test]
async fn test_new() {
    let db = Database::new("").await;
    db.get_all().await;
}
