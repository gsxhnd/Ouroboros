#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

// #[macro_use]
// extern crate serde_derive;

// use napi::bindgen_prelude::*;
// use sqlx::query;
// use sqlx::sqlite::SqlitePool;
// use sqlx::Connection;
// use sqlx::SqliteConnection;

mod database;
// pub use self::database::DB;

// #[macro_use]
// extern crate napi_derive;

// #[napi]
// fn sum(a: i32, b: i32) -> i32 {
//     println!("rust println: sum");
//     a + b
// }
