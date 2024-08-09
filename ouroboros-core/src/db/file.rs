use super::Database;
use crate::model::File;
use sqlx::Error;

impl Database {
    pub async fn get_file_by_folder_id(
        &self,
        filename: &str,
        folder_id: u32,
    ) -> Result<Option<File>, Error> {
        let row = sqlx::query_as::<_, File>("select * from file where folder_id = ? and name = ?;")
            .bind(folder_id)
            .bind(filename)
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

    pub async fn get_files_by_folder_id(&self, folder_id: u32) -> Result<Option<Vec<File>>, Error> {
        let row = sqlx::query_as::<_, File>("select * from file where folder_id = ?;")
            .bind(folder_id)
            .fetch_all(&self.pool)
            .await;
        match row {
            Ok(d) => Ok(Some(d)),
            Err(e) => match e {
                Error::RowNotFound => Ok(None),
                _ => Err(e),
            },
        }
    }

    pub async fn insert_file_by_folder_id(&self, list: Vec<File>) {
        let mut tx = self.pool.begin().await.unwrap();
        for f in list.iter() {
            sqlx::query("insert into file (name, folder_id)  values (?,?)")
                .bind(&f.name)
                .bind(f.folder_id)
                .execute(&mut *tx)
                .await
                .unwrap();
        }

        tx.commit().await.unwrap();
    }
}
