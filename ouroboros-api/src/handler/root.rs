use crate::state::AppState;

use axum::{extract::State, response::IntoResponse, Json};
use ouroboros_core::sync;
use tracing::info;

#[utoipa::path(post, path = "/ping", tag = "default", responses())]
pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    info!("data path: {}", state.cfg.common.data_path);
    Json("ok")
}

#[utoipa::path(post, path = "/api/v1/sync", tag = "default", responses())]
pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    let data_path = state.cfg.common.data_path.clone();
    sync::sync(state.conn.clone(), data_path).await;

    Json("ok")
}
