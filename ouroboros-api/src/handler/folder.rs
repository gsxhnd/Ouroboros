use crate::{service, state::AppState};
use ouroboros_core::model;

use axum::extract::{self, State};
use axum::response::Json as resp_json;
use axum::{response::IntoResponse, Json as json_res};
use serde::Deserialize;
use tracing::info;

#[derive(Deserialize)]
pub struct CreateFolder {
    name: String,
    parent_id: u32,
}

#[derive(Deserialize)]
pub struct RenameFolder {
    id: u32,
    new_name: String,
}

pub async fn get_folders(state: State<AppState>) -> impl IntoResponse {
    let data = state.conn.get_folders().await.unwrap();
    resp_json(data)
}

pub async fn delete_folders(
    state: State<AppState>,
    extract::Json(payload): extract::Json<Vec<u32>>,
) -> impl IntoResponse {
    state.conn.delete_folders(payload).await;
    // TODO: remove local folders and files
    json_res("ok")
}

pub async fn rename_folders(
    state: State<AppState>,
    extract::Json(payload): extract::Json<model::Folder>,
) -> impl IntoResponse {
    info!("payload: {:?}", payload);
    service::folder::update_folder_info(state.conn.clone(), payload).await;
    json_res("ok")
}

pub async fn add_folder(
    state: State<AppState>,
    extract::Json(payload): extract::Json<CreateFolder>,
) -> impl IntoResponse {
    service::folder::add_folder(state.conn.clone(), payload.name, payload.parent_id).await;
    json_res("ok")
}
