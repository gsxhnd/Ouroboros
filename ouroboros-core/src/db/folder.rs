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
        let row = sqlx::query_as::<_, Folder>("SELECT * FROM folder WHERE name = ? AND pid = ?")
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

        sqlx::query("insert into folder (name, pid)  values (?,?)")
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

    pub async fn delete_folders(&self, folder_ids: Vec<u32>) {
        let mut tx = self.pool.begin().await.unwrap();

        let query_str = format!(
            "delete from folder where id in ( {} )",
            folder_ids
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
                .join(",")
        );

        let query_files = format!(
            "delete from file where folder_id in ( {} )",
            folder_ids
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<String>>()
                .join(",")
        );

        sqlx::query(query_str.as_str())
            .execute(&mut *tx)
            .await
            .unwrap();
        sqlx::query(query_files.as_str())
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }

    pub async fn update_folder(&self, folder: Folder) {
        let mut tx = self.pool.begin().await.unwrap();

        sqlx::query("update folder set pid = ?, name = ? where id= ?")
            .bind(folder.pid)
            .bind(folder.name)
            .bind(folder.id)
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }
}

// WITH RECURSIVE folder_tree AS (
//     SELECT
//         id,
//         name,
//         pid

//     FROM
//         folder
//     WHERE
//         id = 8 -- 替换为你要查询的初始 id

//     UNION ALL

//     SELECT
//         f.id,
//         f.name,
//         f.pid

//     FROM
//         folder f
//             INNER JOIN
//         folder_tree ft ON f.id = ft.pid
// )
// SELECT * FROM folder_tree;
