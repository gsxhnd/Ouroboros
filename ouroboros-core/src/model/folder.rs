use chrono;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct Folder {
    pub id: u32,
    pub name: String,
    pub pid: u32,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_fid: Option<u32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}
