use axum::{
    routing::{get, post},
    Router,
};

use crate::handler::root::ping;

use crate::{config, state::AppState};

pub async fn routes(cfg: config::Config) -> Router {
    let state = AppState::new(cfg).await;
    Router::new()
        .route("/ping", get(ping))
        .route("/", post(|| async { "Hello, World!" }))
        .with_state(state)
}
