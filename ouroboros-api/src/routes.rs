use axum::{routing, Router};

use crate::handler::{file, folder, root, tag};

use crate::{config, state::AppState};

pub async fn routes(cfg: config::Config) -> Router {
    let state = AppState::new(cfg).await;
    let v1_r = Router::new()
        .route(
            "/tag",
            routing::get(tag::get_all_tag)
                .post(tag::add_tag)
                .put(tag::update_tag_name)
                .delete(tag::delete_tag),
        )
        .route(
            "/folder",
            routing::get(folder::get_folders)
                .post(folder::add_folders)
                .put(folder::rename_folders)
                .delete(folder::delete_folders),
        )
        .route(
            "/file",
            routing::get(file::get_files)
                .post(file::add_files)
                .put(file::rename_files)
                .delete(file::delete_files),
        )
        .route("/file_tag", routing::get(root::ping))
        .route("/sync", routing::get(root::sync));

    Router::new()
        .route("/ping", routing::get(root::ping))
        .nest("/api/v1", v1_r)
        .with_state(state)
}
