use crate::state::AppState;

use axum::{
    body::Body,
    extract::{self, State},
    http::header,
    http::StatusCode,
    response::IntoResponse,
    response::Response,
};
use tokio_util::io::ReaderStream;
use tracing::info;

pub async fn file(
    _state: State<AppState>,
    extract::Path(file_id): extract::Path<String>,
) -> impl IntoResponse {
    info!("path file id:{}", file_id);
    let path = "./testing/tray.png";

    let file = match tokio::fs::File::open(path).await {
        Ok(file) => file,
        Err(err) => return Err((StatusCode::NOT_FOUND, format!("File not found: {}", err))),
    };

    let content_type = match mime_guess::from_path(&path).first_raw() {
        Some(mime) => mime,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                "MIME Type couldn't be determined".to_string(),
            ))
        }
    };
    let stream = ReaderStream::new(file);

    let body = Body::from_stream(stream);
    let response = Response::builder()
        .header(header::CONTENT_TYPE, content_type) // 设置图片的 Content-Type
        .body(body)
        .unwrap();

    Ok(response)
}

pub async fn thumbnail(
    _state: State<AppState>,
    extract::Path(file_id): extract::Path<String>,
) -> impl IntoResponse {
    info!("path file id:{}", file_id)
}
