use std::{env, fs};

mod config;
mod handler;
mod routes;
mod state;

use config::Config;

#[tokio::main]
async fn main() {
    // Get the command line arguments
    let args: Vec<String> = env::args().collect();

    // Check if the user provided the config file path
    let config_file_path = if args.len() > 1 {
        &args[1]
    } else {
        "config.toml"
    };

    let toml_str = match fs::read_to_string(config_file_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error reading default config file: {}", e);
            eprintln!("Usage: {} <config_file_path>", args[0]);
            std::process::exit(1);
        }
    };

    let cfg: Config = toml::from_str(&toml_str).unwrap();
    let r = routes::routes(cfg.clone()).await;

    let listener = tokio::net::TcpListener::bind(cfg.common.server_listen)
        .await
        .unwrap();
    axum::serve(listener, r).await.unwrap();
}
