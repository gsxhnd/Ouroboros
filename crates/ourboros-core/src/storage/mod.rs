use std::path::Path;

use refinery::embed_migrations;
use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};

embed_migrations!("migrations");

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> CoreResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut conn = Connection::open(path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        migrations::runner()
            .run(&mut conn)
            .map_err(|err| CoreError::Migration(err.to_string()))?;

        Ok(Self { conn })
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn runs_migrations_on_open() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::open(&db_path).unwrap();

        let table_count: i64 = db
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'assets'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_count, 1);
    }
}
