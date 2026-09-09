use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("rclone is not running")]
    NotRunning,

    #[error("rclone is already running")]
    AlreadyRunning,

    #[error("rclone binary not found: {0}")]
    BinaryNotFound(String),

    #[error("rclone did not become ready in time")]
    ReadyTimeout,

    #[error("invalid rclone rc command: {0}")]
    InvalidCommand(String),

    #[error("failed to contact rclone: {0}")]
    Transport(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub type CoreResult<T> = Result<T, CoreError>;
