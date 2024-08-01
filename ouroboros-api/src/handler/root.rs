use crate::state::AppState;
use axum::{extract::State, response::IntoResponse, Json};

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    Json("ok")
}

pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    let mut tree = ouroboros_core::tree::Tree::new();
    tree.walk_dir(state.cfg.common.data_path.clone());
    let a = tree.root.unwrap().borrow().post_order_traversal();

    Json(a)
}
