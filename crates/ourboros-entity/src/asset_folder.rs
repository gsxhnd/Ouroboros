use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "asset_folders")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub asset_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub folder_id: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
