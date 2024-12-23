use clap::Parser;

#[derive(Debug, Parser)]
#[command(version, about, long_about = None)]
pub struct Cli {
    #[arg(short, long)]
    pub config: Option<String>,

    /// Turn debugging information on
    #[arg(short, long)]
    pub debug: bool,
}
