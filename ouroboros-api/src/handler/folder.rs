use crate::{service, state::AppState};

use axum::extract::{self, State};
use axum::response::Json as resp_json;
use axum::{response::IntoResponse, Json as json_res};

pub async fn get_folders(state: State<AppState>) -> impl IntoResponse {
    let data = state.conn.get_folders().await.unwrap();
    resp_json(data)
}

pub async fn delete_folders(
    state: State<AppState>,
    extract::Json(payload): extract::Json<Vec<u32>>,
) -> impl IntoResponse {
    state.conn.delete_folders(payload).await;
    json_res("ok")
}

pub async fn rename_folders(state: State<AppState>) -> impl IntoResponse {
    json_res("ok")
}

pub async fn add_folders(state: State<AppState>) -> impl IntoResponse {
    json_res("ok")
}
