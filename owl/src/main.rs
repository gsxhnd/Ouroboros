use clap::Parser;

mod config;

#[tokio::main]
async fn main() {
    let cli = config::Cli::parse();

    println!("{:?}", cli)
}
