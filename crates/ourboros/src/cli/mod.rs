mod server;

use std::path::PathBuf;

use clap::CommandFactory;
use clap::{Parser, Subcommand};

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
    /// Run HTTP server
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
