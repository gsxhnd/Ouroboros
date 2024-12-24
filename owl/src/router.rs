use axum::{routing, Router};

use crate::handler::root::ping;
use crate::state::AppState;

pub async fn routes(state: AppState) -> Router {
    let v1_api = Router::new().route("/folder", routing::get(ping));
    Router::new()
        .route("/ping", routing::get(ping).post(ping))
        .nest("/api/v1", v1_api)
        .with_state(state)
}
