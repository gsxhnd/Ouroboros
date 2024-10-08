use crate::state::AppState;
use tokio::{fs::File, io::AsyncWriteExt};

use axum::{
    extract::{self, Multipart, Query, State},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;

#[utoipa::path(get,
    path = "/api/v1/file",
    params(
        ("id" = i32, Path, description = "Todo database id")
    ),
    tag="file",
    responses()
)]
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

#[utoipa::path(post,
    path = "/api/v1/file",
    params(
        ("id" = i32, Path, description = "Todo database id")
    ),
    tag="file",
    responses()
)]
pub async fn add_files(
    state: State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let target_folder_id = params.get("folder_id");
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap().to_string();
        let file_name = field.file_name().unwrap().to_string();
        let data = field.bytes().await.unwrap();

        // // 生成一个唯一的文件名
        // let file_name = format!("./uploads/{}-{}.upload", name, "xxx");

        // // 将文件保存到磁盘
        // let mut file = File::create(file_name).await.unwrap();
        // file.write_all(&data).await.unwrap();
    }

    state.conn.get_folder_full_path(8).await;

    Json("ok")
}

/// This is a summary of the operation
#[utoipa::path(delete,
    path = "/api/v1/file",
    request_body(content=Vec<u32>,description="id list"),
    tag="file",
    responses()
)]
pub async fn delete_files(
    _state: State<AppState>,
    extract::Json(_payload): extract::Json<Vec<u32>>,
) -> impl IntoResponse {
    Json("ok")
}

#[utoipa::path(put,
    path = "/api/v1/file",
    params(
        ("id" = i32, Path, description = "Todo database id")
    ),
    tag="file",
    responses()
)]
pub async fn rename_files(_state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}
