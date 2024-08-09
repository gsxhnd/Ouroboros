use crate::state::AppState;

use axum::{extract::State, response::IntoResponse, Json};

pub async fn get_files(state: State<AppState>) -> impl IntoResponse {
    let data = match state.conn.get_files_by_folder_id(6).await {
        Ok(data) => match data {
            Some(data) => Some(data),
            None => None,
        },
        Err(_e) => None,
    };
    Json(data)
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
