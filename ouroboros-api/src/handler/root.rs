use crate::{service, state::AppState};

use axum::{extract::State, response::IntoResponse, Json};

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub(crate) async fn sync(state: State<AppState>) -> impl IntoResponse {
    // state.conn.get_all().await;
    let data_path = state.cfg.common.data_path.clone();
    service::sync::sync(state.conn.clone(), data_path).await;

    Json("ok")
}
