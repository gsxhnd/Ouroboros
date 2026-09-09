mod server;

use std::path::PathBuf;

use clap::CommandFactory;
use clap::{Parser, Subcommand};

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

    /// Directory that contains the built web UI (`index.html`).
    /// Also available as `--web-dir` or `OURBOROS_WEB_DIR`.
    #[arg(
        long = "webui",
        visible_alias = "web-dir",
        env = "OURBOROS_WEB_DIR",
        value_name = "DIR"
    )]
    pub web_dir: Option<PathBuf>,

    /// Application data directory for workspace and settings JSON
    #[arg(long, env = "OURBOROS_DATA_DIR")]
    pub data_dir: Option<PathBuf>,

    /// rclone binary path or name. Overrides saved settings for this process.
    #[arg(long, env = "RCLONE_BIN")]
    pub rclone_bin: Option<String>,

    /// Attach to an existing rclone RC URL instead of spawning rcd
    #[arg(long, env = "RCLONE_RC_URL")]
    pub rclone_url: Option<String>,

    #[arg(long, env = "RCLONE_RC_USER")]
    pub rclone_user: Option<String>,

    #[arg(long, env = "RCLONE_RC_PASS")]
    pub rclone_pass: Option<String>,

    /// Path to rclone.conf
    #[arg(long, env = "RCLONE_CONFIG")]
    pub rclone_config: Option<PathBuf>,

    /// Do not start or attach to rclone automatically
    #[arg(long)]
    pub no_auto_rclone: bool,
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

#[cfg(test)]
mod tests {
    use super::*;
    use clap::{CommandFactory, Parser};

    #[test]
    fn server_should_accept_webui_path() {
        let cli = Cli::parse_from(["ourboros", "server", "--webui", "/tmp/ui"]);
        match cli.command {
            Some(Command::Server(args)) => {
                assert_eq!(
                    args.web_dir.as_deref(),
                    Some(std::path::Path::new("/tmp/ui"))
                );
            }
            other => panic!("unexpected command: {other:?}"),
        }
    }

    #[test]
    fn server_should_accept_web_dir_alias() {
        let cli = Cli::parse_from(["ourboros", "server", "--web-dir", "/tmp/ui"]);
        match cli.command {
            Some(Command::Server(args)) => {
                assert_eq!(
                    args.web_dir.as_deref(),
                    Some(std::path::Path::new("/tmp/ui"))
                );
            }
            other => panic!("unexpected command: {other:?}"),
        }
    }

    #[test]
    fn server_help_should_mention_webui() {
        let help = ServerArgs::command().render_help().to_string();
        assert!(help.contains("--webui"));
        assert!(help.contains("--web-dir"));
        assert!(help.contains("OURBOROS_WEB_DIR"));
    }
}
