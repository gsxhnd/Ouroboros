use crate::state::AppState;
use axum::{
    extract::{self, State},
    response::IntoResponse,
    Json,
};
use ouroboros_core::model::Tag;
use serde::Deserialize;
use tracing::info;

#[derive(Deserialize)]
pub struct CreateTag {
    name: String,
    parent_id: u32,
}

pub(crate) async fn add_tag(
    state: State<AppState>,
    extract::Json(payload): extract::Json<CreateTag>,
) -> impl IntoResponse {
    state.conn.add_tag(payload.name, payload.parent_id).await;
    Json("ok")
}

pub(crate) async fn delete_tag(
    state: State<AppState>,
    extract::Json(payload): extract::Json<Vec<u32>>,
) -> impl IntoResponse {
    state.conn.delete_tag(payload).await;
    Json("ok")
}

pub(crate) async fn update_tag_info(
    state: State<AppState>,
    extract::Json(payload): extract::Json<Tag>,
) -> impl IntoResponse {
    state.conn.update_tag(payload).await;
    Json("ok")
}

pub(crate) async fn get_tags(state: State<AppState>) -> impl IntoResponse {
    let data = match state.conn.get_all_tags().await {
        Ok(data) => data,
        Err(_) => None,
    };
    info!("get all tags: {:?}", data);
    Json(data)
}
