pub mod http;
pub mod state;
pub mod web;

#[cfg(feature = "tray")]
pub mod tray;

use std::future::Future;
use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tokio::net::TcpListener;

pub use state::AppState;

#[derive(Debug, Clone, Default)]
pub struct ServerOptions {
    pub web_dir: Option<PathBuf>,
}

pub async fn run(listener: TcpListener, state: AppState, options: ServerOptions) -> anyhow::Result<()> {
    let app = build_router(state, &options);
    axum::serve(listener, app).await?;
    Ok(())
}

pub async fn run_with_shutdown(
    listener: TcpListener,
    state: AppState,
    options: ServerOptions,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> anyhow::Result<()> {
    let app = build_router(state, &options);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await?;
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
