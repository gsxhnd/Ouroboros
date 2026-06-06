use std::path::PathBuf;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use ourboros_core::CoreError;
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/system/info", get(system_info))
        .route("/api/library/create", post(create_library))
        .route("/api/library/open", post(open_library))
        .route("/api/library/info", get(library_info))
        .route("/api/library/close", post(close_library))
        .route("/health", get(health))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
}

#[derive(Serialize)]
struct SystemInfoResponse {
    name: &'static str,
    version: String,
    library_open: bool,
}

#[derive(Deserialize)]
struct CreateLibraryRequest {
    path: PathBuf,
    name: String,
}

#[derive(Deserialize)]
struct OpenLibraryRequest {
    path: PathBuf,
}

#[derive(Serialize)]
struct ApiErrorBody {
    error: String,
}

struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn from_core(error: CoreError) -> Self {
        let (status, message) = match error {
            CoreError::AlreadyOpen => (StatusCode::CONFLICT, error.to_string()),
            CoreError::NotOpen => (StatusCode::NOT_FOUND, error.to_string()),
            CoreError::NotFound(path) => (StatusCode::NOT_FOUND, path),
            CoreError::AlreadyExists(path) => (StatusCode::CONFLICT, path),
            CoreError::InvalidPath(path) => (StatusCode::BAD_REQUEST, path),
            other => (StatusCode::INTERNAL_SERVER_ERROR, other.to_string()),
        };

        Self { status, message }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ApiErrorBody {
                error: self.message,
            }),
        )
            .into_response()
    }
}

async fn health() -> &'static str {
    "ok"
}

async fn system_info(State(state): State<AppState>) -> Json<SystemInfoResponse> {
    let library_open = state
        .library_manager
        .lock()
        .map(|manager| manager.is_open())
        .unwrap_or(false);

    Json(SystemInfoResponse {
        name: "ourboros",
        version: state.version.clone(),
        library_open,
    })
}

async fn create_library(
    State(state): State<AppState>,
    Json(payload): Json<CreateLibraryRequest>,
) -> Result<Json<ourboros_core::LibraryInfo>, ApiError> {
    let mut manager = state.library_manager.lock().map_err(|_| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "library manager lock poisoned".to_string(),
    })?;

    let info = manager
        .create(&payload.path, &payload.name)
        .map_err(ApiError::from_core)?;

    Ok(Json(info))
}

async fn open_library(
    State(state): State<AppState>,
    Json(payload): Json<OpenLibraryRequest>,
) -> Result<Json<ourboros_core::LibraryInfo>, ApiError> {
    let mut manager = state.library_manager.lock().map_err(|_| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "library manager lock poisoned".to_string(),
    })?;

    let info = manager
        .open(&payload.path)
        .map_err(ApiError::from_core)?;

    Ok(Json(info))
}

async fn library_info(
    State(state): State<AppState>,
) -> Result<Json<ourboros_core::LibraryInfo>, ApiError> {
    let manager = state.library_manager.lock().map_err(|_| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "library manager lock poisoned".to_string(),
    })?;

    manager
        .info()
        .map(Json)
        .ok_or_else(|| ApiError {
            status: StatusCode::NOT_FOUND,
            message: CoreError::NotOpen.to_string(),
        })
}

async fn close_library(State(state): State<AppState>) -> Result<StatusCode, ApiError> {
    let mut manager = state.library_manager.lock().map_err(|_| ApiError {
        status: StatusCode::INTERNAL_SERVER_ERROR,
        message: "library manager lock poisoned".to_string(),
    })?;

    manager.close().map_err(ApiError::from_core)?;
    Ok(StatusCode::NO_CONTENT)
}
