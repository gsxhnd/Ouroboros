use std::net::SocketAddr;

use clap::Parser;
use ourboros_server::{bind, run, AppState};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Parser, Debug)]
#[command(name = "ourboros-server", about = "Ourboros HTTP server")]
struct Args {
    #[arg(short, long, default_value = "8080")]
    port: u16,

    #[arg(long, default_value = "127.0.0.1")]
    host: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let args = Args::parse();
    let addr: SocketAddr = format!("{}:{}", args.host, args.port).parse()?;
    let (listener, port) = bind(addr).await?;
    tracing::info!("ourboros-server listening on http://127.0.0.1:{port}");

    run(listener, AppState::new()).await
}
