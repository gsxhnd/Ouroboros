use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Pool, Sqlite};
use sqlx::{SqliteConnection, SqlitePool};

// #[derive(Clone)]
pub struct Database {
    pool: Option<Pool<Sqlite>>,
}

impl Database {
    pub fn new() -> Self {
        Database { pool: None }
    }

    pub async fn init(&mut self) {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect("sqlite:database.db?mode=rwc")
            .await
            .unwrap();

        self.pool = Some(pool);
    }

    pub async fn insert(&self) {
        let p = self.pool.as_ref().unwrap().clone();

        let x = sqlx::query(" INSERT INTO test_db DEFAULT VALUES")
            .execute(&p)
            .await;
        match x {
            Err(e) => println!("{}", e),
            Ok(data) => println!("{:?}", data),
        }
    }
}

#[cfg(test)]
#[tokio::test]
async fn test_db() {
    // let db = Database::new().await;
    // db.insert().await;
}
