use crate::handler;
use ouroboros_core::model;

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(description = "My Api description"),
    paths(
        handler::file::get_files,
        handler::file::delete_files,
        handler::file::rename_files,
        handler::file::add_files,
        handler::folder::add_folder,
        handler::folder::delete_folders,
        handler::folder::rename_folders,
        handler::folder::get_folders,
        handler::tag::add_tag,
        handler::tag::delete_tag,
        handler::tag::update_tag_info,
        handler::tag::get_tags,
    ),
    components(schemas(
        handler::folder::CreateFolder,
        handler::tag::CreateTag,
        model::Folder,
        model::File,
        model::Tag,
    ))
)]
struct ApiDoc;
impl ApiDoc {
    pub fn generate() -> String {
        ApiDoc::openapi().to_pretty_json().unwrap()
    }
}

#[tokio::test]
async fn generate_doc() {
    use std::fs;
    let content = ApiDoc::generate();
    println!("{}", content);
    match fs::write("../doc/swagger.json", content) {
        Ok(_) => {}
        Err(e) => {
            println!("{}", e);
        }
    }
}
