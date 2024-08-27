use ouroboros_core::db::Database;

pub async fn delete_files(db: Database, file_id_list: Vec<u32>) {
    // TODO: remove files in database
    let _ = db.delete_files_by_id(file_id_list).await;
    // TODO: remove files in file system
}
