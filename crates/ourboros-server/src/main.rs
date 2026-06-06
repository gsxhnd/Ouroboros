fn main() {
    tracing_subscriber::fmt::init();
    tracing::info!("ourboros-server v{}", ourboros_core::VERSION);
}
