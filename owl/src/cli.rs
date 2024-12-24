use clap::Parser;

#[derive(Debug, Parser)]
#[command(version, about, long_about = None)]
pub struct Cli {
    #[arg(short, long, default_value = "config.toml")]
    pub config: Option<String>,

    /// Turn debugging information on
    #[arg(short, long, default_value = "false", env = "OWL_DEBUG")]
    pub debug: bool,
}
