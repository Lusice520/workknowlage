const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS spaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT 'WORKSPACE',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folders (
  id         TEXT PRIMARY KEY,
  space_id   TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  parent_id  TEXT,
  name       TEXT NOT NULL,
  deleted_at TEXT,
  trash_root_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  space_id        TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  folder_id       TEXT,
  title           TEXT NOT NULL,
  document_kind   TEXT NOT NULL DEFAULT 'note' CHECK(document_kind IN ('note','spreadsheet')),
  content_json    TEXT NOT NULL DEFAULT '[]',
  is_favorite     INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,
  trash_root_id   TEXT,
  word_count      INTEGER NOT NULL DEFAULT 0,
  badge_label     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_spreadsheets (
  document_id   TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  workbook_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quick_notes (
  id           TEXT PRIMARY KEY,
  space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  note_date    TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(space_id, note_date)
);

CREATE TABLE IF NOT EXISTS document_shares (
  id            TEXT PRIMARY KEY,
  document_id   TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  enabled       INTEGER NOT NULL DEFAULT 1,
  public_token  TEXT UNIQUE,
  public_enabled INTEGER NOT NULL DEFAULT 0,
  public_password_hash TEXT,
  public_password_salt TEXT,
  public_expires_at TEXT,
  public_created_at TEXT,
  public_updated_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  tone  TEXT NOT NULL DEFAULT 'neutral' CHECK(tone IN ('primary','neutral'))
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS backlinks (
  id              TEXT PRIMARY KEY,
  source_doc_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_block_id TEXT,
  description     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workspace_search_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id     TEXT NOT NULL UNIQUE,
  space_id      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK(kind IN ('document', 'quick-note')),
  document_id   TEXT,
  note_date     TEXT,
  title         TEXT NOT NULL,
  preview       TEXT NOT NULL DEFAULT '',
  title_search  TEXT NOT NULL DEFAULT '',
  body_search   TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS workspace_search USING fts5(
  title_search,
  body_search,
  content='workspace_search_entries',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TABLE IF NOT EXISTS workspace_block_search_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id      TEXT NOT NULL,
  document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  block_id      TEXT NOT NULL,
  block_type    TEXT NOT NULL DEFAULT 'unknown',
  title         TEXT NOT NULL,
  preview       TEXT NOT NULL DEFAULT '',
  fallback_text TEXT NOT NULL DEFAULT '',
  title_search  TEXT NOT NULL DEFAULT '',
  body_search   TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, block_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS workspace_block_search USING fts5(
  title_search,
  body_search,
  content='workspace_block_search_entries',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE INDEX IF NOT EXISTS idx_folders_space ON folders(space_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_id);
CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(document_kind);
CREATE INDEX IF NOT EXISTS idx_quick_notes_space_date ON quick_notes(space_id, note_date);
CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(token);
CREATE INDEX IF NOT EXISTS idx_document_shares_public_token ON document_shares(public_token);
CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_source ON backlinks(source_doc_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_target ON backlinks(target_doc_id);
CREATE INDEX IF NOT EXISTS idx_workspace_search_entries_space ON workspace_search_entries(space_id);
CREATE INDEX IF NOT EXISTS idx_workspace_search_entries_entity ON workspace_search_entries(entity_id);
CREATE INDEX IF NOT EXISTS idx_workspace_block_search_entries_space ON workspace_block_search_entries(space_id);
CREATE INDEX IF NOT EXISTS idx_workspace_block_search_entries_document ON workspace_block_search_entries(document_id);

CREATE TRIGGER IF NOT EXISTS workspace_search_entries_ai AFTER INSERT ON workspace_search_entries BEGIN
  INSERT INTO workspace_search(rowid, title_search, body_search)
  VALUES (new.id, new.title_search, new.body_search);
END;

CREATE TRIGGER IF NOT EXISTS workspace_search_entries_ad AFTER DELETE ON workspace_search_entries BEGIN
  INSERT INTO workspace_search(workspace_search, rowid, title_search, body_search)
  VALUES('delete', old.id, old.title_search, old.body_search);
END;

CREATE TRIGGER IF NOT EXISTS workspace_search_entries_au AFTER UPDATE ON workspace_search_entries BEGIN
  INSERT INTO workspace_search(workspace_search, rowid, title_search, body_search)
  VALUES('delete', old.id, old.title_search, old.body_search);
  INSERT INTO workspace_search(rowid, title_search, body_search)
  VALUES (new.id, new.title_search, new.body_search);
END;

CREATE TRIGGER IF NOT EXISTS workspace_block_search_entries_ai AFTER INSERT ON workspace_block_search_entries BEGIN
  INSERT INTO workspace_block_search(rowid, title_search, body_search)
  VALUES (new.id, new.title_search, new.body_search);
END;

CREATE TRIGGER IF NOT EXISTS workspace_block_search_entries_ad AFTER DELETE ON workspace_block_search_entries BEGIN
  INSERT INTO workspace_block_search(workspace_block_search, rowid, title_search, body_search)
  VALUES('delete', old.id, old.title_search, old.body_search);
END;

CREATE TRIGGER IF NOT EXISTS workspace_block_search_entries_au AFTER UPDATE ON workspace_block_search_entries BEGIN
  INSERT INTO workspace_block_search(workspace_block_search, rowid, title_search, body_search)
  VALUES('delete', old.id, old.title_search, old.body_search);
  INSERT INTO workspace_block_search(rowid, title_search, body_search)
  VALUES (new.id, new.title_search, new.body_search);
END;
`;

module.exports = SCHEMA_SQL;
