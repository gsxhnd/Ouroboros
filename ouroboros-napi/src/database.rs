use napi::Error;
use ouroboros_core::model::Tag;

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
    pub async fn get(&self) -> napi::Result<Option<Vec<Tag>>> {
        match self.db.get_all_tags().await {
            Ok(tags) => Ok(tags),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub async fn get_folder(&self) -> napi::Result<Option<Vec<Tag>>> {
        match self.db.get_all_tags().await {
            Ok(tags) => Ok(tags),
            Err(e) => Err(Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub async fn sync(&self) {
        ouroboros_core::sync::sync(self.db.clone(), "".to_string()).await
    }
}
