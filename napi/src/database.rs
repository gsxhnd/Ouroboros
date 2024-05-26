// use napi::bindgen_prelude::*;
// use sqlx::{Pool, Sqlite, SqliteConnection, SqlitePool};

// #[napi]
// pub struct SqliteDatabase {
//     // conn: DatabaseConnection,
//     // pool: SqlitePool,
//     pub pool: Pool,
// }

// #[napi]
// impl SqliteDatabase {
//     #[napi(constructor)]
//     pub async fn new(path: String) -> Self {
//         let init_pool = SqlitePool::connect("sqlite:test.sqlite?mode=rwc")
//             .await
//             .unwrap();

//         SqliteDatabase { pool: init_pool }
//     }

//     #[napi]
//     pub async fn select(&self) -> i64 {
//         let row: (i64,) = sqlx::query_as("SELECT * from test")
//             .bind(150_i64)
//             .fetch_one(&self.pool)
//             .await
//             .unwrap();
//         row.0
//     }
// }
