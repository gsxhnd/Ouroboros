use crate::state::AppState;
use axum::{extract::State, response::IntoResponse, Json};
use tracing::{debug, info};

#[utoipa::path(get, path = "/ping", tag = "default", responses())]
pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    debug!("ping request");
    let a = state.db.db.version().await.unwrap();

    info!("version: {} ", a);

    Json("ok")
}
