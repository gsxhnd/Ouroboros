use crate::state::AppState;
use axum::{extract::State, response::IntoResponse, Json};

pub(crate) async fn ping(state: State<AppState>) -> impl IntoResponse {
    state.conn.get_all().await;
    Json("ok")
}
