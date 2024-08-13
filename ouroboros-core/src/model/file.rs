use chrono;
use serde::{Deserialize, Serialize};
// use sqlx::types::chrono;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct File {
    pub id: u32,
    pub folder_id: u32,
    pub name: String,
    pub desc: String,
    pub md5: String,
    // pub created_at: chrono::DateTime<chrono::Utc>,
    // pub updated_at: chrono::DateTime<chrono::Utc>,
}
