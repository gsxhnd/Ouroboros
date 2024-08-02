use crate::state::AppState;
use axum::{extract::State, response::IntoResponse, Json};

pub(crate) async fn get_all_tag(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub(crate) async fn get_tags(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub(crate) async fn add_tag(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub(crate) async fn update_tag_name(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}

pub(crate) async fn delete_tag(state: State<AppState>) -> impl IntoResponse {
    Json("ok")
}
