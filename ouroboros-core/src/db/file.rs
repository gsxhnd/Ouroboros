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
            sqlx::query("insert into file (name, folder_id, md5)  values (?,?,?)")
                .bind(&f.name)
                .bind(f.folder_id)
                .bind(&f.md5)
                .execute(&mut *tx)
                .await
                .unwrap();
        }

        tx.commit().await.unwrap();
    }

    pub async fn get_files_by_id(&self, ids: Vec<u32>) -> Result<Option<Vec<File>>, Error> {
        let query = format!(
            "SELECT * FROM folder WHERE id in ( {} )",
            ids.iter()
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
                .join(",")
        );

        let rows = sqlx::query_as::<_, File>(&query)
            .fetch_all(&self.pool)
            .await;

        match rows {
            Ok(d) => Ok(Some(d)),
            Err(e) => match e {
                Error::RowNotFound => Ok(None),
                _ => Err(e),
            },
        }
    }

    pub async fn delete_files_by_id(&self, ids: Vec<u32>) -> Result<(), Error> {
        let mut tx = match self.pool.begin().await {
            Ok(tx) => tx,
            Err(e) => return Err(e),
        };

        let query = format!(
            "delete from file where id in ( {} )",
            ids.iter()
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
                .join(",")
        );

        match sqlx::query(query.as_str()).execute(&mut *tx).await {
            Ok(_) => tx.commit().await,
            Err(e) => {
                match tx.rollback().await {
                    Ok(_) => return Err(e),
                    Err(e2) => {
                        print!("{}", e2);
                        return Err(e);
                    }
                };
            }
        }
    }
}
