use crate::{service, state::AppState};

use axum::{extract::State, response::IntoResponse, Json};

pub async fn get_files(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn delete_files(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn rename_files(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub async fn add_files(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}
