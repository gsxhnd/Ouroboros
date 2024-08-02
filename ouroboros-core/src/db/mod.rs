use sqlx::{migrate::Migrator, sqlite::SqlitePool, Error, Pool, Sqlite};

use crate::model::Folder;
mod file;

#[derive(Debug, Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(db_path: &str) -> Database {
        let pool = SqlitePool::connect(db_path).await.unwrap();
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

    pub async fn get_folder(&self, name: &str, parent: u32) -> Result<Option<Folder>, Error> {
        let row = sqlx::query_as::<_, Folder>(
            "SELECT id, name, parent_id FROM folder WHERE name = ? AND parent_id = ?",
        )
        .bind(name)
        .bind(parent)
        .fetch_one(&self.pool)
        .await;

        match row {
            Ok(d) => Ok(Some(d)),
            Err(e) => match e {
                Error::RowNotFound => Ok(None),
                _ => Err(e),
            },
        }
    }

    pub async fn add_folder(&self, name: &str, parent: u32) -> u32 {
        let mut tx = self.pool.begin().await.unwrap();

        sqlx::query("insert into folder (name, parent_id)  values (?,?)")
            .bind(name)
            .bind(parent)
            .execute(&mut *tx)
            .await
            .unwrap();

        let last_insert_id = sqlx::query_as::<_, (u32,)>("SELECT last_insert_rowid();")
            .fetch_one(&mut *tx)
            .await
            .unwrap()
            .0;
        tx.commit().await.unwrap();
        last_insert_id
    }
}

#[tokio::test]
async fn test_new() {
    let db = Database::new("").await;
    db.get_all().await;
}
