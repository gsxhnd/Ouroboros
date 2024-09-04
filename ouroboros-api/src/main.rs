use clap::Parser;
use std::fs;
use tracing::{self};

mod config;
mod doc;
mod handler;
mod routes;
mod service;
mod state;
use config::Config;

/// Simple program to greet a person
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = None)]
    config: Option<String>,

    #[arg(short, long, default_value = None)]
    data_path: Option<String>,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    let (config_path, mut cfg) = match args.config {
        None => {
            let cfg = Config::default();
            let config_path = "./config.toml";
            (config_path.to_string().clone(), cfg)
        }
        Some(p) => {
            let toml_str = fs::read_to_string(p.clone()).unwrap();
            let cfg = toml::from_str(&toml_str).unwrap();
            (p.clone(), cfg)
        }
    };

    match args.data_path {
        Some(p) => cfg.common.data_path = p,
        None => {}
    }

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    match ouroboros_core::sync::init::init(cfg.clone().common.data_path).await {
        Ok(_) => tracing::info!("init sync storage success"),
        Err(e) => match e.kind() {
            std::io::ErrorKind::AlreadyExists => {
                tracing::info!("sync storage already exists");
            }
            _ => {
                panic!("init failed error: {}", e)
            }
        },
    }

    let state = state::AppState::new(config_path, cfg.clone()).await;

    let r = routes::routes(state).await;
    let listener = tokio::net::TcpListener::bind(cfg.clone().common.server_listen)
        .await
        .unwrap();
    axum::serve(listener, r).await.unwrap();
}
