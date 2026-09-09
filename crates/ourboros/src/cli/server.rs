use std::net::SocketAddr;

use ourboros::{bind, run as serve, web, AppState, ServerOptions};

use super::ServerArgs;

pub async fn run(args: ServerArgs) -> anyhow::Result<()> {
    let web_dir = web::resolve_web_dir(args.web_dir.clone());
    log_web_dir(&web_dir);

    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    let (listener, port) = bind(addr).await?;
    tracing::info!("ourboros server listening on http://{}:{}", args.host, port);

    let state = AppState::new(args.rclone_settings());
    if args.no_auto_rclone {
        tracing::info!("rclone auto-start disabled");
    } else if let Err(error) = state.rclone.ensure_running().await {
        tracing::warn!("rclone is not ready: {error}");
    }

    serve(listener, state, ServerOptions { web_dir }).await
}

fn log_web_dir(web_dir: &Option<std::path::PathBuf>) {
    match web_dir {
        Some(path) => tracing::info!(web_dir = %path.display(), "Serving web UI"),
        None => tracing::info!(
            "API-only mode. Pass --web-dir or set OURBOROS_WEB_DIR to serve a custom UI."
        ),
    }
}
