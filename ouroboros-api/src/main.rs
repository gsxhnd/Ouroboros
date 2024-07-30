use axum::{
    routing::{get, post},
    Router,
};

#[tokio::main]
async fn main() {
    println!("Hello world");
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/", post(|| async { "Hello, World!" }));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
