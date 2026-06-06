pub mod http;
pub mod state;

use std::net::SocketAddr;

use axum::Router;
use tokio::net::TcpListener;

pub use state::AppState;

pub async fn run(listener: TcpListener, state: AppState) -> anyhow::Result<()> {
    let app = http::router(state);
    axum::serve(listener, app).await?;
    Ok(())
}

pub async fn bind(addr: SocketAddr) -> anyhow::Result<(TcpListener, u16)> {
    let listener = TcpListener::bind(addr).await?;
    let port = listener.local_addr()?.port();
    Ok((listener, port))
}

pub fn router(state: AppState) -> Router {
    http::router(state)
}
