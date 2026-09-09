use std::path::PathBuf;

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use ourboros_core::{CoreError, RcloneStatus};
use serde::Serialize;
use serde_json::Value;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/system/info", get(system_info))
        .route("/api/rclone/status", get(rclone_status))
        .route("/api/rclone/start", post(rclone_start))
        .route("/api/rclone/stop", post(rclone_stop))
        .route("/api/rc/{*command}", post(proxy_rc))
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
    home_dir: Option<PathBuf>,
    rclone: RcloneStatus,
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
        let status = match error {
            CoreError::AlreadyRunning => StatusCode::CONFLICT,
            CoreError::NotRunning | CoreError::ReadyTimeout | CoreError::BinaryNotFound(_) => {
                StatusCode::SERVICE_UNAVAILABLE
            }
            CoreError::InvalidCommand(_) => StatusCode::BAD_REQUEST,
            CoreError::Transport(_) | CoreError::Io(_) => StatusCode::BAD_GATEWAY,
        };

        Self {
            status,
            message: error.to_string(),
        }
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
    Json(SystemInfoResponse {
        name: "ourboros",
        version: state.version.clone(),
        home_dir: state.home_dir.clone(),
        rclone: state.rclone.status().await,
    })
}

async fn rclone_status(State(state): State<AppState>) -> Json<RcloneStatus> {
    Json(state.rclone.status().await)
}

async fn rclone_start(State(state): State<AppState>) -> Result<Json<RcloneStatus>, ApiError> {
    let status = state
        .rclone
        .ensure_running()
        .await
        .map_err(ApiError::from_core)?;
    Ok(Json(status))
}

async fn rclone_stop(State(state): State<AppState>) -> Result<Json<RcloneStatus>, ApiError> {
    let status = state.rclone.stop().await.map_err(ApiError::from_core)?;
    Ok(Json(status))
}

async fn proxy_rc(
    State(state): State<AppState>,
    Path(command): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    let payload = if body.is_empty() {
        Value::Object(Default::default())
    } else {
        serde_json::from_slice(&body).map_err(|error| ApiError {
            status: StatusCode::BAD_REQUEST,
            message: error.to_string(),
        })?
    };
    let response = state
        .rclone
        .call(&command, payload)
        .await
        .map_err(ApiError::from_core)?;

    let status = StatusCode::from_u16(response.status).unwrap_or(StatusCode::BAD_GATEWAY);
    Ok((status, Json(response.body)).into_response())
}
