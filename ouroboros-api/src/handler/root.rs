use crate::state::AppState;

use axum::{extract::State, response::IntoResponse, Json};
use std::path::PathBuf;

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    Json("ok")
}

pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    // state.conn.get_all().await;

    let mut tree = ouroboros_core::tree::Tree::new();
    tree.walk_dir(state.cfg.common.data_path.clone());
    // let dirs = tree.root.unwrap().borrow().post_order_dirs();

    let i = PathBuf::from("/abc/asb");
    let mut iter = i.iter();
    let mut deepth: u32 = 0;

    while let Some(component) = iter.next() {
        println!("Component at depth {}: {:?}", deepth, component);
        let name = component.to_str().unwrap();
        state.conn.get_folder(name, deepth).await;
        deepth += 1;
    }

    Json("")
}
