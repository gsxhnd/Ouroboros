use axum::{
    extract::{Form, Path, Query, State},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};

use crate::{config, state::AppState};

pub async fn routes(cfg: config::Config) -> Router {
    let state = AppState::new(cfg).await;
    Router::new()
        .route("/ping", get(ping))
        .route("/", post(|| async { "Hello, World!" }))
        .with_state(state)
}

async fn ping(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    Json("ok")
}
