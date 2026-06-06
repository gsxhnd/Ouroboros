use std::path::Path;

use sea_orm::{Database as SeaDatabase, DatabaseConnection};
use sea_orm_migration::MigratorTrait;

use crate::error::CoreResult;

pub struct Database {
    conn: DatabaseConnection,
}

impl Database {
    pub async fn open(path: &Path) -> CoreResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let url = format!("sqlite:{}?mode=rwc", path.display());
        let conn = SeaDatabase::connect(&url).await?;

        ourboros_migration::Migrator::up(&conn, None).await?;

        Ok(Self { conn })
    }

    pub async fn connect(url: &str) -> CoreResult<Self> {
        let conn = SeaDatabase::connect(url).await?;
        ourboros_migration::Migrator::up(&conn, None).await?;
        Ok(Self { conn })
    }

    pub fn connection(&self) -> &DatabaseConnection {
        &self.conn
    }
}
