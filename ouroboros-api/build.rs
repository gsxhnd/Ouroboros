use std::fs;

fn main() {
    let info = utoipa::openapi::InfoBuilder::new()
        .title("My api")
        .version("1.0.0")
        .contact(Some(
            utoipa::openapi::ContactBuilder::new()
                .name(Some("Admin Admin"))
                .email(Some("amdin@petapi.com"))
                .build(),
        ))
        .build();
    let doc = utoipa::openapi::OpenApi::new(info, utoipa::openapi::Paths::new());
    let doc_str = doc.to_pretty_json().unwrap();
    let _ = fs::write("../doc/swagger.json", doc_str);
}
