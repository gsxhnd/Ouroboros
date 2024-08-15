use std::error::Error;
use std::fs;
use std::path::Path;

#[allow(dead_code)]
pub async fn create_dir(path: &Path) -> Result<(), Box<dyn Error>> {
    // let m = match path.metadata() {
    //     Ok(m) => {
    //         if !m.is_dir() {
    //             // return Err(Box::new(""));
    //         }
    //     }
    //     Err(e) => return Err(Box::new(e)),
    // };
    fs::create_dir_all(path.join(".ouroboros"))?;

    // let m = path.metadata();

    // {
    //     Ok(v) => {
    //         if !v.is_dir() {
    //             return Err(String::from("Path not dir"));
    //         }
    //     }
    //     Err(e) => match e.kind() {
    //         std::io::ErrorKind::NotFound => match fs::create_dir(p) {
    //             Ok(_) => {}
    //             Err(e) => {
    //                 return Err(String::from(format!("Path error {}", e.kind().to_string())));
    //             }
    //         },
    //         _ => {
    //             return Err(String::from(format!("Path error {}", e.kind().to_string())));
    //         }
    //     },
    // }
    Ok(())
}
