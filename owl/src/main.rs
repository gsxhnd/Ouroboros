use std::fs;

use clap::Parser;
use toml;

mod cli;
mod config;
mod doc;
mod handler;
mod router;
mod state;

#[tokio::main]
async fn main() {
    let arg = cli::Cli::parse();

    let mut cfg = match arg.config {
        None => config::Config::default(),
        Some(c) => {
            let file = fs::read_to_string(c).unwrap();
            let toml_str: config::Config = toml::from_str(&file).unwrap();
            toml_str
        }
    };

    if arg.debug {
        cfg.log.level = "debug".to_string()
    }

    let lvl = match cfg.log.level.as_str() {
        "debug" => tracing::Level::TRACE,
        "warn" => tracing::Level::WARN,
        "error" => tracing::Level::ERROR,
        _ => tracing::Level::INFO,
    };
    tracing_subscriber::fmt().with_max_level(lvl).init();

    let state = state::AppState::new(cfg.clone().data_path).await;
    let r = router::routes(state).await;
    let listener = tokio::net::TcpListener::bind(cfg.server.clone().listen)
        .await
        .unwrap();
    axum::serve(listener, r).await.unwrap();
}
