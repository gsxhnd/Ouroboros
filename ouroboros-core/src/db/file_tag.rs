use super::Database;
use crate::model::FileTag;
use sqlx::Error;

impl Database {
    pub async fn get_file_tags(&self) -> Result<Vec<FileTag>, Error> {
        let rows: Result<Vec<FileTag>, Error> = sqlx::query_as("SELECT * FROM file_tags")
            .fetch_all(&self.pool)
            .await;
        match rows {
            Ok(v) => Ok(v),
            Err(e) => Err(e),
        }
    }
}
