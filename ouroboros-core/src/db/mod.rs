use sqlx::{
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    ConnectOptions, Pool, Sqlite,
};

mod file;
mod folder;
mod tag;

#[derive(Debug, Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(db_path: &str) -> Database {
        let mut conn_opt: SqliteConnectOptions = db_path.parse().unwrap();
        conn_opt = conn_opt.log_statements(log::LevelFilter::Info);

        let pool_option = SqlitePoolOptions::new();
        let pool = pool_option.connect_with(conn_opt).await.unwrap();

        // let pool = SqlitePool::connect(db_path).await.unwrap();

        Migrator::new(std::path::Path::new("./migrations"))
            .await
            .unwrap()
            .run(&pool)
            .await
            .unwrap();

        Database { pool }
    }

    pub async fn init(&self) {
        Migrator::new(std::path::Path::new("./migrations"))
            .await
            .unwrap()
            .run(&self.pool)
            .await
            .unwrap();
    }
}
