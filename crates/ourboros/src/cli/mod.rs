mod server;

use std::path::PathBuf;

use clap::CommandFactory;
use clap::{Parser, Subcommand};
use ourboros_core::RcloneSettings;

#[derive(Parser, Debug)]
#[command(name = "ourboros", about = "Web UI for rclone")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

impl Cli {
    pub fn resolve_command(self) -> anyhow::Result<Command> {
        match self.command {
            Some(command) => Ok(command),
            None => {
                Cli::command().print_help()?;
                std::process::exit(0);
            }
        }
    }
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Print version information
    Version,
    /// Run HTTP server and manage rclone RC
    Server(ServerArgs),
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

    /// rclone binary path or name
    #[arg(long, default_value = "rclone", env = "RCLONE_BIN")]
    pub rclone_bin: String,

    /// Attach to an existing rclone RC URL instead of spawning rcd
    #[arg(long, env = "RCLONE_RC_URL")]
    pub rclone_url: Option<String>,

    /// Path to rclone.conf
    #[arg(long, env = "RCLONE_CONFIG")]
    pub rclone_config: Option<PathBuf>,

    /// Do not start or attach to rclone automatically
    #[arg(long)]
    pub no_auto_rclone: bool,
}

impl ServerArgs {
    pub fn rclone_settings(&self) -> RcloneSettings {
        RcloneSettings {
            bin: self.rclone_bin.clone(),
            rc_url: self.rclone_url.clone(),
            config: self.rclone_config.clone(),
        }
    }
}

pub fn dispatch(command: Command) -> anyhow::Result<()> {
    match command {
        Command::Version => {
            println!("ourboros v{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Command::Server(args) => tokio::runtime::Runtime::new()?.block_on(server::run(args)),
    }
}
