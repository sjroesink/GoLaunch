use crate::models::{Item, NewItem, Setting, UpdateItem};
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;
use uuid::Uuid;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {e}"))?;
        }
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database at {}: {e}", db_path.display()))?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    pub fn with_path(path: &PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {e}"))?;
        }
        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open database at {}: {e}", path.display()))?;
        let db = Self { conn };
        db.initialize()?;
        Ok(db)
    }

    pub fn db_path() -> Result<PathBuf, String> {
        let data_dir = dirs::data_local_dir()
            .or_else(dirs::home_dir)
            .ok_or_else(|| "Cannot determine home directory".to_string())?;
        Ok(data_dir.join("golaunch").join("golaunch.db"))
    }

    fn initialize(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    subtitle TEXT,
                    icon TEXT,
                    action_type TEXT NOT NULL DEFAULT 'command',
                    action_value TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'General',
                    tags TEXT NOT NULL DEFAULT '',
                    frequency INTEGER NOT NULL DEFAULT 0,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_items_title ON items(title);
                CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
                CREATE INDEX IF NOT EXISTS idx_items_enabled ON items(enabled);

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ",
            )
            .map_err(|e| format!("Failed to initialize database: {e}"))
    }

    pub fn add_item(&self, item: NewItem) -> Result<Item, String> {
        let id = Uuid::new_v4().to_string();
        let category = item.category.unwrap_or_else(|| "General".to_string());
        let tags = item.tags.unwrap_or_default();

        self.conn
            .execute(
                "INSERT INTO items (id, title, subtitle, icon, action_type, action_value, category, tags)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    id,
                    item.title,
                    item.subtitle,
                    item.icon,
                    item.action_type,
                    item.action_value,
                    category,
                    tags,
                ],
            )
            .map_err(|e| format!("Failed to add item: {e}"))?;

        self.get_item(&id)
    }

    pub fn get_item(&self, id: &str) -> Result<Item, String> {
        self.conn
            .query_row(
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at FROM items WHERE id = ?1",
                params![id],
                |row| {
                    Ok(Item {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        subtitle: row.get(2)?,
                        icon: row.get(3)?,
                        action_type: row.get(4)?,
                        action_value: row.get(5)?,
                        category: row.get(6)?,
                        tags: row.get(7)?,
                        frequency: row.get(8)?,
                        enabled: row.get::<_, i64>(9)? != 0,
                        created_at: row.get(10)?,
                        updated_at: row.get(11)?,
                    })
                },
            )
            .map_err(|e| format!("Item not found: {e}"))
    }

    pub fn update_item(&self, id: &str, update: UpdateItem) -> Result<Item, String> {
        let current = self.get_item(id)?;

        let title = update.title.unwrap_or(current.title);
        let subtitle = update.subtitle.or(current.subtitle);
        let icon = update.icon.or(current.icon);
        let action_type = update.action_type.unwrap_or(current.action_type);
        let action_value = update.action_value.unwrap_or(current.action_value);
        let category = update.category.unwrap_or(current.category);
        let tags = update.tags.unwrap_or(current.tags);
        let enabled = update.enabled.unwrap_or(current.enabled);

        self.conn
            .execute(
                "UPDATE items SET title = ?1, subtitle = ?2, icon = ?3, action_type = ?4, action_value = ?5, category = ?6, tags = ?7, enabled = ?8, updated_at = datetime('now') WHERE id = ?9",
                params![title, subtitle, icon, action_type, action_value, category, tags, enabled as i64, id],
            )
            .map_err(|e| format!("Failed to update item: {e}"))?;

        self.get_item(id)
    }

    pub fn remove_item(&self, id: &str) -> Result<bool, String> {
        let rows = self
            .conn
            .execute("DELETE FROM items WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to remove item: {e}"))?;
        Ok(rows > 0)
    }

    pub fn search_items(&self, query: &str) -> Result<Vec<Item>, String> {
        let pattern = format!("%{query}%");
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at
                 FROM items
                 WHERE enabled = 1 AND (title LIKE ?1 OR subtitle LIKE ?1 OR tags LIKE ?1 OR category LIKE ?1)
                 ORDER BY frequency DESC, title ASC",
            )
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let items = stmt
            .query_map(params![pattern], |row| {
                Ok(Item {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    subtitle: row.get(2)?,
                    icon: row.get(3)?,
                    action_type: row.get(4)?,
                    action_value: row.get(5)?,
                    category: row.get(6)?,
                    tags: row.get(7)?,
                    frequency: row.get(8)?,
                    enabled: row.get::<_, i64>(9)? != 0,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .map_err(|e| format!("Failed to execute query: {e}"))?
            .collect::<SqlResult<Vec<Item>>>()
            .map_err(|e| format!("Failed to collect results: {e}"))?;

        Ok(items)
    }

    pub fn list_items(
        &self,
        category: Option<&str>,
        include_disabled: bool,
    ) -> Result<Vec<Item>, String> {
        let sql = match (category, include_disabled) {
            (Some(_), false) => {
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at
                 FROM items WHERE category = ?1 AND enabled = 1 ORDER BY frequency DESC, title ASC"
            }
            (Some(_), true) => {
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at
                 FROM items WHERE category = ?1 ORDER BY frequency DESC, title ASC"
            }
            (None, false) => {
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at
                 FROM items WHERE enabled = 1 ORDER BY frequency DESC, title ASC"
            }
            (None, true) => {
                "SELECT id, title, subtitle, icon, action_type, action_value, category, tags, frequency, enabled, created_at, updated_at
                 FROM items ORDER BY frequency DESC, title ASC"
            }
        };

        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let items = if let Some(cat) = category {
            stmt.query_map(params![cat], Self::row_to_item)
        } else {
            stmt.query_map([], Self::row_to_item)
        }
        .map_err(|e| format!("Failed to execute query: {e}"))?
        .collect::<SqlResult<Vec<Item>>>()
        .map_err(|e| format!("Failed to collect results: {e}"))?;

        Ok(items)
    }

    pub fn get_categories(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT DISTINCT category FROM items WHERE enabled = 1 ORDER BY category ASC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let categories = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to execute query: {e}"))?
            .collect::<SqlResult<Vec<String>>>()
            .map_err(|e| format!("Failed to collect results: {e}"))?;

        Ok(categories)
    }

    pub fn increment_frequency(&self, id: &str) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE items SET frequency = frequency + 1, updated_at = datetime('now') WHERE id = ?1",
                params![id],
            )
            .map_err(|e| format!("Failed to increment frequency: {e}"))?;
        Ok(())
    }

    pub fn import_items(&self, items: Vec<NewItem>) -> Result<Vec<Item>, String> {
        let mut imported = Vec::new();
        for item in items {
            imported.push(self.add_item(item)?);
        }
        Ok(imported)
    }

    pub fn export_items(&self) -> Result<Vec<Item>, String> {
        self.list_items(None, true)
    }

    // --- Settings CRUD ---

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        match self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        ) {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get setting: {e}")),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
                params![key, value],
            )
            .map_err(|e| format!("Failed to set setting: {e}"))?;
        Ok(())
    }

    pub fn delete_setting(&self, key: &str) -> Result<bool, String> {
        let rows = self
            .conn
            .execute("DELETE FROM settings WHERE key = ?1", params![key])
            .map_err(|e| format!("Failed to delete setting: {e}"))?;
        Ok(rows > 0)
    }

    pub fn get_all_settings(&self) -> Result<Vec<Setting>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM settings ORDER BY key ASC")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let settings = stmt
            .query_map([], |row| {
                Ok(Setting {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to execute query: {e}"))?
            .collect::<SqlResult<Vec<Setting>>>()
            .map_err(|e| format!("Failed to collect results: {e}"))?;

        Ok(settings)
    }

    fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<Item> {
        Ok(Item {
            id: row.get(0)?,
            title: row.get(1)?,
            subtitle: row.get(2)?,
            icon: row.get(3)?,
            action_type: row.get(4)?,
            action_value: row.get(5)?,
            category: row.get(6)?,
            tags: row.get(7)?,
            frequency: row.get(8)?,
            enabled: row.get::<_, i64>(9)? != 0,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }
}
