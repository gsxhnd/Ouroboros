use sqlx::sqlite::SqlitePool;

pub struct Database {}

impl Database {
    pub async fn new() {
        let pool = SqlitePool::connect("sqlite:todos.db?mode=rwc").await.unwrap();
    }
}

#[tokio::test]
async fn test_new() {
    Database::new().await;
}
