use std::net::SocketAddr;

use ourboros_server::{bind, run as run_server, AppState};
use tauri::State;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

struct ServerState {
    port: u16,
    app_state: AppState,
}

#[tauri::command]
fn get_server_port(state: State<'_, ServerState>) -> u16 {
    state.port
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn start_embedded_server(app_state: AppState) -> u16 {
    tauri::async_runtime::block_on(async {
        let addr: SocketAddr = "127.0.0.1:0".parse().expect("valid localhost address");
        let (listener, port) = bind(addr).await.expect("failed to bind embedded server");
        let state = app_state.clone();

        tauri::async_runtime::spawn(async move {
            if let Err(error) = run_server(listener, state).await {
                tracing::error!("embedded server stopped: {error}");
            }
        });

        tracing::info!("embedded server listening on http://127.0.0.1:{port}");
        port
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app_state = AppState::new();
    let port = start_embedded_server(app_state.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ServerState { port, app_state })
        .invoke_handler(tauri::generate_handler![greet, get_server_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
