use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "assets")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[sea_orm(unique)]
    pub file_path: String,
    pub file_name: String,
    pub file_ext: String,
    pub file_size: i64,
    pub file_hash: Option<String>,
    pub mime_type: String,
    pub asset_type: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<f64>,
    #[sea_orm(default_value = "0")]
    pub rating: Option<i32>,
    pub color_hex: Option<String>,
    pub color_palette: Option<String>,
    pub notes: Option<String>,
    pub metadata_json: Option<String>,
    #[sea_orm(default_value = "0")]
    pub is_deleted: Option<i32>,
    pub created_at: String,
    pub modified_at: String,
    pub indexed_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
