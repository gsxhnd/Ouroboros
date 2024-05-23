// use sea_orm::Database;
// use sea_orm::DatabaseConnection;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::js_sys;
// use wasm_bindgen_futures::JsFuture;

#[wasm_bindgen]
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[wasm_bindgen]
pub async fn add_async() -> Result<usize, JsValue> {
    let promise = js_sys::Promise::resolve(&42.into());
    let result = wasm_bindgen_futures::JsFuture::from(promise).await?;
    print!("wasm print");

    Ok(2)
    // let _db: DatabaseConnection = Database::connect(
    //     "sqlite:/home/gsxhnd/Code/personal/Ourboros/db.sqlite?mode=rwc/db.sqlite?mode=rwc",
    // )
    // .await
    // .unwrap();
}
// pub  fn connect() {
//     .await
//     .unwrap();
// }
