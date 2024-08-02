use super::Database;
use crate::model::Folder;

use sqlx::Error;

impl Database {
    pub async fn get_folders(&self) {
        let rows: Result<Vec<Folder>, Error> = sqlx::query_as("").fetch_all(&self.pool).await;
        match rows {
            Ok(data) => {
                println!("{:?}", data)
            }
            Err(e) => {}
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
