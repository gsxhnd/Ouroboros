use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("library already open")]
    AlreadyOpen,

    #[error("no library is open")]
    NotOpen,

    #[error("library not found at {0}")]
    NotFound(String),

    #[error("library already exists at {0}")]
    AlreadyExists(String),

    #[error("invalid library path: {0}")]
    InvalidPath(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("migration error: {0}")]
    Migration(String),

    #[error("config error: {0}")]
    Config(#[from] toml::de::Error),

    #[error("config write error: {0}")]
    ConfigWrite(#[from] toml::ser::Error),
}

pub type CoreResult<T> = Result<T, CoreError>;
