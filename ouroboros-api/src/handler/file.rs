use crate::state::AppState;

use axum::{
    extract::{Query, RawQuery, State},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;

pub async fn get_files(
    state: State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let folder_id: u32 = match params.get("folder_id") {
        Some(folder_id) => match folder_id.parse() {
            Ok(v) => v,
            Err(_e) => 0,
        },
        None => 0,
    };

    let data = match state.conn.get_files_by_folder_id(folder_id).await {
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
