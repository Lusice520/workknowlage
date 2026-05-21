const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { initDatabase, closeDatabase, getDatabase, getDbPath } = require('../electron/db/index.cjs');

async function runSmoke() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const legacyDb = new Database(dbPath);
  try {
    legacyDb.exec(`
      CREATE TABLE spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT 'WORKSPACE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        folder_id TEXT,
        title TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '[]',
        word_count INTEGER NOT NULL DEFAULT 0,
        badge_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO spaces (id, name, label) VALUES ('space-legacy', 'Legacy Space', 'WORKSPACE');
      INSERT INTO documents (id, space_id, folder_id, title, content_json)
      VALUES ('doc-legacy', 'space-legacy', NULL, 'Legacy Doc', '[]');
    `);
  } finally {
    legacyDb.close();
  }

  initDatabase();
  const db = getDatabase();
  const columns = db.prepare('PRAGMA table_info(documents)').all();
  const documentKindColumn = columns.find((column) => column.name === 'document_kind');
  const migratedDocument = db
    .prepare('SELECT document_kind AS documentKind FROM documents WHERE id = ?')
    .get('doc-legacy');
  const documentKindIndex = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_documents_kind'")
    .get();

  closeDatabase();
  console.log(`__LEGACY_MIGRATION_SMOKE__${JSON.stringify({
    ok: true,
    documentKindColumn: Boolean(documentKindColumn),
    documentKind: migratedDocument?.documentKind ?? null,
    documentKindIndex: documentKindIndex?.name ?? null,
  })}`);
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron legacy migration smoke failed:', error);
    process.exitCode = 1;
  });
