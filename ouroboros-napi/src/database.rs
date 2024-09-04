use napi::Error;
use ouroboros_core::model::{File, Folder, Tag};

#[napi]
pub struct Database {
    db: ouroboros_core::db::Database,
}

#[napi]
impl Database {
    #[napi]
    pub async fn init(db_path: String) -> Self {
        let db = ouroboros_core::db::Database::new(&db_path).await;
        Self { db }
    }

    #[napi]
    pub async fn get_tags(&self) -> napi::Result<Option<Vec<Tag>>> {
        match self.db.get_all_tags().await {
            Ok(tags) => Ok(tags),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub async fn get_folders(&self) -> napi::Result<Option<Vec<Folder>>> {
        match self.db.get_folders().await {
            Ok(f) => Ok(f),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub async fn get_files_by_folder_ids(&self, folder_id: u32) -> napi::Result<Option<Vec<File>>> {
        match self.db.get_files_by_folder_id(folder_id).await {
            Ok(f) => Ok(f),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub async fn sync(&self, data_path: String) {
        ouroboros_core::sync::sync(self.db.clone(), data_path).await
    }
}
