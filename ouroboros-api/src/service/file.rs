use ouroboros_core::{db::Database, model::Folder};

use tracing::info;

pub async fn delete_files(db: Database, file_ids: Vec<u32>) {
    // TODO: get
    db.get_files_by_id(file_ids).await;
}
