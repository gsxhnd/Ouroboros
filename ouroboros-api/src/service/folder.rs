use ouroboros_core::{db::Database, model::Folder};

use tracing::info;

pub async fn add_folder(db: Database, name: String, parent_id: u32) {
    let id = db.add_folder(name.as_str(), parent_id).await;
    info!("add folder id: {}", id)
}

pub async fn update_folder_info(db: Database, folder: Folder) {
    db.update_folder(folder).await;
}
