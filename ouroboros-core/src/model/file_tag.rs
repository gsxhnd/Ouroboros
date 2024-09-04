use chrono;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
#[napi(object)]
pub struct FileTag {
    pub id: u32,
    pub file_id: u32,
    pub tag_id: u32,
    #[serde(default)]
    #[schema(value_type = String, format = Date)]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}
