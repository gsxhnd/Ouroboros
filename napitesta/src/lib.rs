#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use sqlx::query;
use sqlx::sqlite::SqlitePool;
use sqlx::Connection;
use sqlx::SqliteConnection;

#[macro_use]
extern crate napi_derive;

#[napi]
fn sum(a: i32, b: i32) -> i32 {
    println!("rust println: sum");
    a + b
}

#[napi]
pub async fn sql() -> Result<()> {
    println!("test sql");
    // let conn = SqliteConnection::connect("sqlite::memory:").await.unwrap();
    let init_pool = SqlitePool::connect("sqlite:test.sqlite?mode=rwc").await;
    let pool = match init_pool {
        Ok(pool) => pool,
        Err(err) => {
            return Err(Error::new(
                Status::Unknown,
                format!("failed to read file, {}", err),
            ))
        }
    };

    let _row: (i64,) = sqlx::query_as("SELECT * from test")
        .bind(150_i64)
        .fetch_one(&pool)
        .await
        .unwrap();
    Ok(())
}

#[cfg(test)]
#[tokio::test]
async fn test_sql() {
    // sum(1, 1);
    // use tokio_test;
    sql().await;
}
