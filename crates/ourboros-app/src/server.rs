use std::net::SocketAddr;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;

use tokio::runtime::Runtime;
use tokio::sync::oneshot;

pub struct ServerHandle {
    shutdown_tx: oneshot::Sender<()>,
    runtime: Runtime,
}

pub fn start_server(port_store: Arc<AtomicU16>) -> ServerHandle {
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let runtime = Runtime::new().expect("failed to create tokio runtime");

    runtime.spawn(async move {
        let addr: SocketAddr = "127.0.0.1:0".parse().unwrap();
        let state = ourboros_server::AppState::new();

        let (listener, port) = ourboros_server::bind(addr)
            .await
            .expect("failed to bind server");

        port_store.store(port, Ordering::SeqCst);
        tracing::info!("ourboros-server listening on http://127.0.0.1:{port}");

        let app = ourboros_server::router(state);

        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .expect("server error");
    });

    ServerHandle {
        shutdown_tx,
        runtime,
    }
}

pub fn stop_server(handle: ServerHandle) {
    let _ = handle.shutdown_tx.send(());
    handle.runtime.shutdown_background();
}
