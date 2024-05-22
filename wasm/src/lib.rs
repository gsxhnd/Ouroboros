// use sea_orm::Database;
// use sea_orm::DatabaseConnection;
use sqlx::sqlite::SqlitePool;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::js_sys;
// use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[wasm_bindgen]
pub async fn get_from_js() -> Result<JsValue, JsValue> {
    let promise = js_sys::Promise::resolve(&42.into());
    let result = wasm_bindgen_futures::JsFuture::from(promise).await?;
    let _pool = SqlitePool::connect(
        "sqlite:/home/gsxhnd/Code/personal/Ourboros/db.sqlite?mode=rwc/db.sqlite?mode=rwc",
    )
    .await
    .unwrap();

    // let _db: DatabaseConnection = Database::connect(
    //     "sqlite:/home/gsxhnd/Code/personal/Ourboros/db.sqlite?mode=rwc/db.sqlite?mode=rwc",
    // )
    // .await
    // .unwrap();
    Ok(result)
}
// pub  fn connect() {
//     .await
//     .unwrap();
// }
