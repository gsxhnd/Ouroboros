// use sea_orm::Database;
// use sea_orm::DatabaseConnection;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::js_sys;
// use wasm_bindgen_futures::JsFuture;
use std::fs;

#[wasm_bindgen]
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[wasm_bindgen]
pub fn copy_async(from: String, to: String) -> Result<(), JsValue> {
    println!("from {}", from);
    let _ = fs::copy(from, to).expect("error");
    Ok(())
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

#[cfg(test)]
#[test]
fn test_copy() {
    copy_async(
        "/home/gsxhnd/.config/ouroboros/db.json".to_string(),
        "./tray.ts".to_string(),
    );
}
