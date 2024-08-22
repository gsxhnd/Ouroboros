use crate::handler;
use ouroboros_core::model;

use utoipa::OpenApi;
#[derive(OpenApi)]
#[openapi(
    info(title = "123", description = "My Api description"),
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
        handler::resource::file,
        handler::resource::thumbnail,
        handler::root::ping,
        handler::root::sync,
    ),
    components(schemas(
        handler::folder::CreateFolder,
        handler::tag::CreateTag,
        model::Folder,
        model::File,
        model::Tag,
    ))
)]
#[allow(dead_code)]
struct ApiDoc;

#[tokio::test]
async fn generate_doc() {
    use std::fs;

    let mut doc = ApiDoc::openapi();
    let contact = utoipa::openapi::ContactBuilder::new()
        .name(Some("ouroboros"))
        .build();
    doc.info.contact = Some(contact);

    let content = doc.to_pretty_json().unwrap();
    match fs::write("../doc/swagger.json", content) {
        Ok(_) => {}
        Err(e) => {
            println!("{}", e);
        }
    }
}
