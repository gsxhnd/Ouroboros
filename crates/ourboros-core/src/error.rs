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

    #[error("rclone rc command is not allowed: {0}")]
    ForbiddenCommand(String),

    #[error("failed to contact rclone: {0}")]
    Transport(String),

    #[error("invalid path: {0}")]
    InvalidPath(String),

    #[error("invalid request: {0}")]
    InvalidRequest(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("{0}")]
    Conflict(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("unsupported schema version {version} for {document}")]
    UnsupportedSchema { document: String, version: u32 },

    #[error("store is corrupt: {message}")]
    CorruptStore { message: String },
}

impl CoreError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotRunning | Self::ReadyTimeout | Self::BinaryNotFound(_) => "rclone_unavailable",
            Self::AlreadyRunning => "already_running",
            Self::InvalidCommand(_) => "invalid_command",
            Self::ForbiddenCommand(_) => "forbidden_command",
            Self::Transport(_) => "rclone_error",
            Self::InvalidPath(_) => "invalid_path",
            Self::InvalidRequest(_) => "invalid_request",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::Io(_) => "io_error",
            Self::UnsupportedSchema { .. } => "unsupported_schema",
            Self::CorruptStore { .. } => "corrupt_store",
        }
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
