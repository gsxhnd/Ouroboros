use crate::{service, state::AppState};

use axum::{extract::State, response::IntoResponse, Json};

pub async fn get_folders(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn delete_folders(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn rename_folders(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn add_folders(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}
