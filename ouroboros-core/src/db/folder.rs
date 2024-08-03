use super::Database;
use crate::model::Folder;

use sqlx::Error;

impl Database {
    pub async fn get_folders(&self) -> Result<Vec<Folder>, Error> {
        let rows: Result<Vec<Folder>, Error> = sqlx::query_as("select * from folder;")
            .fetch_all(&self.pool)
            .await;
        match rows {
            Ok(data) => Ok(data),
            Err(e) => Err(e),
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

    pub async fn delete_folders(&self, filder_ids: Vec<u32>) {
        let mut tx = self.pool.begin().await.unwrap();
        sqlx::query("delete from folder where id in (1,2,3);")
            .execute(&mut *tx)
            .await
            .unwrap();
        sqlx::query("delete from file where folder_id in (1,2,3);")
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }
}
