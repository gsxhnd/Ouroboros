use chrono;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone, Debug, ToSchema)]
#[napi(object)]
pub struct Folder {
    pub id: u32,
    pub name: String,
    pub pid: u32,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_fid: Option<u32>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String, format = Date)]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = String, format = Date)]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}
