use std::{env, path::Path, vec};

use ouroboros_core::db;

#[tokio::test]
async fn test_delete_files() {
    println!("current path: {:?}", env::current_dir());
    let current_path = env::current_dir().unwrap();
    let db_path = current_path.join("../data/.ouroboros/data.db");
    println!("db path: {:?}", db_path);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.as_os_str().to_str().unwrap());
    println!("db url: {:?}", db_url);

    let db = db::Database::new(
        "sqlite:/home/gsxhnd/Code/personal/Ourboros/data/.ouroboros/data.db?mode=rwc",
    )
    .await;
    let _ = db.delete_files_by_id(vec![6, 7]).await;
}
