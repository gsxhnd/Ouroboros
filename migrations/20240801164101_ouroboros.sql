
CREATE TABLE IF NOT EXISTS "folder"
(
    "id"         INTEGER  NOT NULL UNIQUE,
    "name"       VARCHAR  NOT NULL,
    "parent_id"  INTEGER,
    "created_at" DATETIME NOT NULL default CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "folder_index_0"
    ON "folder" ("id");
CREATE TABLE IF NOT EXISTS "file"
(
    "id"         INTEGER  NOT NULL UNIQUE,
    "folder_id"  INTEGER,
    "name"       TEXT,
    "desc"       TEXT,
    "updated_at" DATETIME,
    "created_at" DATETIME NOT NULL default CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "file_index_0"
    ON "file" ("id");

CREATE TABLE IF NOT EXISTS "tag"
(
    "id"         INTEGER  NOT NULL UNIQUE,
    "name"       VARCHAR  NOT NULL,
    "parent_id"  INTEGER,
    "created_at" DATETIME NOT NULL default CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tag_index_0"
    ON "tag" ("id");

CREATE TABLE IF NOT EXISTS "file_tag"
(
    "tag_id"     INTEGER,
    "file_id"    INTEGER,
    "created_at" DATETIME NOT NULL default CURRENT_TIMESTAMP,
    "updated_at" DATETIME
);
