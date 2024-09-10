use axum::{
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing, Router,
};
use rust_embed::RustEmbed;

use crate::handler::{file, folder, resource, root, tag};
use crate::state::AppState;

#[derive(RustEmbed)]
#[folder = "../dist/renderer"]
struct Assets;
static INDEX_HTML: &str = "index.html";

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() || path == INDEX_HTML {
        return index_html().await;
    }

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();

            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if path.contains('.') {
                return not_found().await;
            }
            index_html().await
        }
    }
}

async fn index_html() -> Response {
    match Assets::get(INDEX_HTML) {
        Some(content) => Html(content.data).into_response(),
        None => not_found().await,
    }
}

async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "404").into_response()
}

pub async fn routes(state: AppState) -> Router {
    let v1_r = Router::new()
        .route(
            "/tag",
            routing::get(tag::get_tags)
                .post(tag::add_tag)
                .put(tag::update_tag_info)
                .delete(tag::delete_tag),
        )
        .route(
            "/folder",
            routing::get(folder::get_folders)
                .post(folder::add_folder)
                .delete(folder::delete_folders),
        )
        .route("/folder/rename", routing::put(folder::rename_folders))
        .route("/folder/move", routing::put(folder::rename_folders))
        .route(
            "/file",
            routing::get(file::get_files)
                .post(file::add_files)
                .put(file::rename_files)
                .delete(file::delete_files),
        )
        .route("/file_tag", routing::get(root::ping))
        .route("/resource/file/:file_id", routing::get(resource::file))
        .route(
            "/resource/thumbnail/:file_id",
            routing::get(resource::thumbnail),
        )
        .route("/sync", routing::get(root::sync));

    Router::new()
        .fallback(static_handler)
        .route("/ping", routing::get(root::ping))
        .nest("/api/v1", v1_r)
        .with_state(state)
}
