use crate::{service, state::AppState};

use axum::{
    extract::{self, State},
    response::IntoResponse,
    Json,
};
use ouroboros_core::sync;
use tracing::info;

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    info!("data path: {}", state.cfg.common.data_path);
    Json("ok")
}

pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    let data_path = state.cfg.common.data_path.clone();
    sync::sync(state.conn.clone(), data_path).await;

    Json("ok")
}

pub(crate) async fn init(state: State<AppState>) -> impl IntoResponse {
    state.cfg.rewrite(&state.config_path).await;
    Json("ok")
}
