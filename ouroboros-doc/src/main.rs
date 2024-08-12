use ouroboros_api::handler;
use utoipa::OpenApi;
#[derive(OpenApi)]
#[openapi(
    paths(
        handler::file::get_files
    ),

    tags((name = "Todo"))
)]
struct ApiDoc;
impl ApiDoc {
    pub fn generate() -> String {
        // Make sure the `"yaml"` feature is enabled in your `Cargo.toml`
        ApiDoc::openapi().to_pretty_json().unwrap()
    }
}

fn main() {
    // let content = ApiDoc::generate();
    // println!("{}", content)
}
