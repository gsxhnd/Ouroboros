use std::net::SocketAddr;

use ourboros::{bind, run as serve, web, AppState, ServerOptions};

use super::ServerArgs;

pub async fn run(args: ServerArgs) -> anyhow::Result<()> {
    let web_dir = web::resolve_web_dir(args.web_dir);
    log_web_dir(&web_dir);

    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    let (listener, port) = bind(addr).await?;
    tracing::info!("ourboros server listening on http://{}:{}", args.host, port);

    serve(
        listener,
        AppState::new(),
        ServerOptions { web_dir },
    )
    .await
}

fn log_web_dir(web_dir: &Option<std::path::PathBuf>) {
    match web_dir {
        Some(path) => tracing::info!(web_dir = %path.display(), "Serving web UI"),
        None => tracing::info!(
            "API-only mode. Pass --web-dir or set OURBOROS_WEB_DIR to serve a custom UI."
        ),
    }
}
