mod server;

#[cfg(feature = "tray")]
mod app;

use std::path::PathBuf;

use clap::{CommandFactory, Parser, Subcommand};
use ourboros::web;

#[derive(Parser, Debug)]
#[command(name = "ourboros", about = "Ourboros resource library manager")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

impl Cli {
    pub fn resolve_command(self) -> anyhow::Result<Command> {
        match self.command {
            Some(command) => Ok(command),
            None if web::is_macos_app_bundle() => {
                #[cfg(feature = "tray")]
                {
                    Ok(Command::App(AppArgs::default()))
                }
                #[cfg(not(feature = "tray"))]
                {
                    anyhow::bail!(
                        "this build has no tray support; rebuild with the `tray` feature enabled"
                    )
                }
            }
            None => {
                Cli::command().print_help()?;
                std::process::exit(0);
            }
        }
    }
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Run HTTP server (headless, for NAS or CLI)
    Server(ServerArgs),
    /// Run with system tray (desktop)
    #[cfg(feature = "tray")]
    App(AppArgs),
}

#[derive(Parser, Debug)]
pub struct ServerArgs {
    #[arg(short, long, default_value = "8080")]
    pub port: u16,

    #[arg(long, default_value = "127.0.0.1")]
    pub host: String,

    /// Directory containing built web assets (index.html). Omit for API-only mode.
    #[arg(long, value_name = "DIR")]
    pub web_dir: Option<PathBuf>,
}

#[derive(Parser, Debug, Default)]
pub struct AppArgs {
    /// Directory containing built web assets (index.html).
    #[arg(long, value_name = "DIR")]
    pub web_dir: Option<PathBuf>,
}

pub fn dispatch(command: Command) -> anyhow::Result<()> {
    match command {
        Command::Server(args) => {
            tokio::runtime::Runtime::new()?.block_on(server::run(args))
        }
        #[cfg(feature = "tray")]
        Command::App(args) => {
            app::run(args);
            Ok(())
        }
    }
}
