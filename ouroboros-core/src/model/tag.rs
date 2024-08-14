use chrono;
use serde::{Deserialize, Serialize};
// use sqlx::types::chrono;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
pub struct Tag {
    pub id: u32,
    pub name: String,
    pub parent_id: u32,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String, format = Date)]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String, format = Date)]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}
