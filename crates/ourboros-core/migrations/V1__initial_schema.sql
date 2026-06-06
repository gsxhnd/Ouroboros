CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_ext TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT,
    mime_type TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    duration REAL,
    rating INTEGER DEFAULT 0,
    color_hex TEXT,
    color_palette TEXT,
    notes TEXT,
    metadata_json TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL
);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders(id),
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE asset_folders (
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, folder_id)
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    group_name TEXT,
    color TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE asset_tags (
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE smart_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rules_json TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE assets_fts USING fts5(
    file_name, notes, tags_text,
    content='assets',
    content_rowid='rowid'
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_ext ON assets(file_ext);
CREATE INDEX idx_assets_rating ON assets(rating);
CREATE INDEX idx_assets_color ON assets(color_hex);
CREATE INDEX idx_assets_created ON assets(created_at);
CREATE INDEX idx_assets_hash ON assets(file_hash);
CREATE INDEX idx_tags_group ON tags(group_name);
