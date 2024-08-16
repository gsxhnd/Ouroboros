mod utils;
use std::fs;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {}

#[wasm_bindgen]
pub fn greet() -> String {
    match fs::create_dir_all("123") {
        Ok(_) => "ok".to_string(),
        Err(e) => e.to_string(),
    }
}
