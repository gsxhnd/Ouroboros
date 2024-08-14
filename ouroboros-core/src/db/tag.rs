use super::Database;
use crate::model;

use sqlx::Error;

impl Database {
    pub async fn add_tag(&self, name: String, parent_id: u32) -> u32 {
        let mut tx = self.pool.begin().await.unwrap();

        sqlx::query("insert into tag (name, parent_id)  values (?,?)")
            .bind(name)
            .bind(parent_id)
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

    pub async fn delete_tag(&self, tag_id: Vec<u32>) {
        let mut tx = self.pool.begin().await.unwrap();

        let query_str = format!(
            "delete from tag where id in ( {} )",
            tag_id
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
                .join(",")
        );

        sqlx::query(query_str.as_str())
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }

    pub async fn update_tag(&self, tag: model::Tag) {
        let mut tx = self.pool.begin().await.unwrap();

        sqlx::query("update tag set parent_id = ?, name = ? where id= ?")
            .bind(tag.parent_id)
            .bind(tag.name)
            .bind(tag.id)
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }

    pub async fn get_all_tags(&self) -> Result<Option<Vec<model::Tag>>, Error> {
        let rows: Result<Vec<model::Tag>, Error> = sqlx::query_as("select * from tag;")
            .fetch_all(&self.pool)
            .await;
        match rows {
            Ok(data) => Ok(Some(data)),
            Err(e) => Err(e),
        }
    }
}
