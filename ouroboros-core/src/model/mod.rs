use chrono;
use serde::{Deserialize, Serialize};
// use sqlx::types::chrono;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct File {
    pub id: u32,
    pub name: String,
    pub folder_id: u32,
    // pub created_at: chrono::DateTime<chrono::Utc>,
    // pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct Folder {
    pub id: u32,
    pub name: String,
    pub parent_id: u32,
    // pub created_at: chrono::DateTime<chrono::Utc>,
    // pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct Tag {
    pub id: u32,
    pub name: String,
    pub parent_id: u32,
    // pub created_at: chrono::DateTime<chrono::Utc>,
    // pub updated_at: chrono::DateTime<chrono::Utc>,
}
