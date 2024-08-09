use crate::db::Database;
use crate::model::{File, Folder};

use walkdir::WalkDir;

pub async fn sync(db: Database, data_path: String) {
    // let data_path = Path::new(&data_path);
    let mut file_list = Vec::new();

    for entry in WalkDir::new(data_path.clone()).sort_by_file_name() {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("Error reading directory entry: {}", e);
                continue;
            }
        };

        let path = entry.path();
        let relative_path = match path.strip_prefix(data_path.clone()) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Error stripping prefix: {}", e);
                continue;
            }
        };

        if relative_path.starts_with(".ouroboros") {
            continue;
        }

        if entry.file_type().is_dir() {
            let mut parent_id = 0;
            for (depth, component) in relative_path.components().enumerate() {
                let str = match component.as_os_str().to_str() {
                    Some(s) => s,
                    None => {
                        eprintln!("Invalid UTF-8 sequence in path");
                        continue;
                    }
                };

                println!("depth: {}, file name: {}", depth, str);
                let data = match db.get_folder(str, parent_id).await {
                    Ok(row) => row,
                    Err(e) => {
                        eprintln!("Error querying database: {}", e);
                        None
                    }
                };

                match data {
                    Some(row) => {
                        parent_id = row.id;
                    }
                    None => {
                        let id = db.add_folder(str, parent_id).await;
                        parent_id = id
                    }
                }
            }
        }

        if entry.file_type().is_file() {
            let mut folder_id: u32 = 0;
            let size = relative_path.components().count();
            for (depth, component) in relative_path.components().enumerate() {
                let str = match component.as_os_str().to_str() {
                    Some(s) => s,
                    None => {
                        eprintln!("Invalid UTF-8 sequence in path");
                        continue;
                    }
                };
                if depth == size - 1 {
                    let data = match db.get_file_by_folder_id(str, folder_id).await {
                        Ok(row) => row,
                        Err(e) => {
                            eprintln!("Error querying database: {}", e);
                            None
                        }
                    };
                    match data {
                        Some(_row) => {}
                        None => {
                            file_list.push(File {
                                id: 0,
                                name: String::from(str),
                                folder_id,
                            });
                        }
                    }
                }
                match db.get_folder(str, folder_id).await {
                    Ok(row) => match row {
                        Some(r) => folder_id = r.id,
                        None => {}
                    },
                    Err(e) => {}
                }
            }
        }
    }
    db.insert_file_by_folder_id(file_list.clone()).await;
}
