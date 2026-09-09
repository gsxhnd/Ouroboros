use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use ourboros_core::CoreError;
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub details: Value,
}

#[derive(Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: String,
    message: String,
    details: Value,
}

impl ApiError {
    pub fn new(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
        details: Value,
    ) -> Self {
        Self {
            status,
            code,
            message: message.into(),
            details,
        }
    }

    pub fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message, json!({}))
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message, json!({}))
    }

    pub fn conflict(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, code, message, json!({}))
    }

    pub fn from_core(error: CoreError) -> Self {
        let code = match &error {
            CoreError::Conflict(message) if message.contains("revision") => "workspace_conflict",
            other => other.code(),
        };
        let status = match &error {
            CoreError::InvalidCommand(_)
            | CoreError::ForbiddenCommand(_)
            | CoreError::InvalidPath(_)
            | CoreError::InvalidRequest(_) => StatusCode::BAD_REQUEST,
            CoreError::NotFound(_) => StatusCode::NOT_FOUND,
            CoreError::AlreadyRunning | CoreError::Conflict(_) => StatusCode::CONFLICT,
            CoreError::NotRunning | CoreError::ReadyTimeout | CoreError::BinaryNotFound(_) => {
                StatusCode::SERVICE_UNAVAILABLE
            }
            CoreError::Transport(_) => StatusCode::BAD_GATEWAY,
            CoreError::Io(_)
            | CoreError::UnsupportedSchema { .. }
            | CoreError::CorruptStore { .. } => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let details = match &error {
            CoreError::Conflict(message) if message.contains("found") => {
                json!({ "message": message })
            }
            _ => json!({}),
        };
        Self::new(status, code, error.to_string(), details)
    }
}

impl From<CoreError> for ApiError {
    fn from(error: CoreError) -> Self {
        Self::from_core(error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorBody {
                error: ErrorDetail {
                    code: self.code.to_string(),
                    message: self.message,
                    details: self.details,
                },
            }),
        )
            .into_response()
    }
}
