use std::net::SocketAddr;

use ourboros::{assert_bind_host, bind, run as serve, web, AppState, RuntimeConfig, ServerOptions};

use super::ServerArgs;

pub async fn run(args: ServerArgs) -> anyhow::Result<()> {
    assert_bind_host(&args.host)?;

    let web_dir = web::resolve_web_dir(args.web_dir)?;
    log_web_dir(&web_dir);

    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    let (listener, port) = bind(addr).await?;
    tracing::info!("ourboros server listening on http://{}:{}", args.host, port);

    let state = AppState::new(RuntimeConfig {
        data_dir: args.data_dir,
        bind_host: args.host.clone(),
        bind_port: port,
        web_dir: web_dir.clone(),
        rclone_bin: args.rclone_bin,
        rclone_url: args.rclone_url,
        rclone_config: args.rclone_config,
        rclone_user: args.rclone_user,
        rclone_pass: args.rclone_pass,
        no_auto_rclone: args.no_auto_rclone,
    })?;

    if args.no_auto_rclone || !state.settings.get().auto_start {
        tracing::info!("rclone auto-start disabled");
    } else if let Err(error) = state.rclone.ensure_running().await {
        tracing::warn!("rclone is not ready: {error}");
    }

    tokio::spawn(ourboros::scheduler::run_loop(state.clone()));
    serve(listener, state, ServerOptions { web_dir }).await
}

fn log_web_dir(web_dir: &Option<std::path::PathBuf>) {
    match web_dir {
        Some(path) => tracing::info!(web_dir = %path.display(), "Serving web UI"),
        None => tracing::info!(
            "API-only mode. Pass --webui / --web-dir or set OURBOROS_WEB_DIR to serve the UI."
        ),
    }
}
