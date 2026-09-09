pub mod events;
pub mod http;
pub mod jobs;
pub mod mounts;
pub mod persist;
pub mod scheduler;
pub mod settings;
pub mod state;
pub mod web;
pub mod workspace;

use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tokio::net::TcpListener;

pub use state::{AppState, RuntimeConfig};

#[derive(Debug, Clone, Default)]
pub struct ServerOptions {
    pub web_dir: Option<PathBuf>,
}

pub async fn run(
    listener: TcpListener,
    state: AppState,
    options: ServerOptions,
) -> anyhow::Result<()> {
    let app = build_router(state, &options);
    axum::serve(listener, app).await?;
    Ok(())
}

pub async fn bind(addr: SocketAddr) -> anyhow::Result<(TcpListener, u16)> {
    let listener = TcpListener::bind(addr).await?;
    let port = listener.local_addr()?.port();
    Ok((listener, port))
}

pub fn build_router(state: AppState, options: &ServerOptions) -> Router {
    let api = http::router(state);
    web::attach_static(api, options.web_dir.as_deref())
}

pub fn router(state: AppState) -> Router {
    http::router(state)
}

pub fn assert_bind_host(host: &str) -> anyhow::Result<()> {
    if ourboros_core::rclone::is_loopback_host(host) {
        Ok(())
    } else {
        anyhow::bail!(
            "refusing to bind {host}: HTTP authentication is not implemented; use 127.0.0.1"
        )
    }
}
