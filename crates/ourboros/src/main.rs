// When built with `app` feature, hide the console window on Windows.
#![cfg_attr(feature = "tray", windows_subsystem = "windows")]

mod cli;

use clap::Parser;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    cli::dispatch(cli::Cli::parse().resolve_command()?)
}
