use crate::state::AppState;

use axum::{extract::State, response::IntoResponse, Json};
use std::collections::{HashMap, VecDeque};

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    Json("ok")
}

pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    let mut tree = ouroboros_core::tree::Tree::new();
    tree.walk_dir(state.cfg.common.data_path.clone());
    let a = tree.root.unwrap().borrow().post_order_traversal();

    for (k, v) in &a.children {
        for dir in v {}
    }
    let mut stack = VecDeque::new();
    stack.push_back((dirs, 0));

    while let Some((current_dirs, depth)) = stack.pop_back() {
        for (key, value) in &current_dirs.children {
            println!("{:indent$}Directory: {}", "", key, indent = depth * 2);
            for dir in value {
                stack.push_back((dir, depth + 1));
            }
        }
    }

    Json(a)
}
