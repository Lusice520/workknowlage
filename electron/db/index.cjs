const Database = require('better-sqlite3');
const path = require('node:path');
const { app } = require('electron');
const SCHEMA_SQL = require('./schema.cjs');
const { seedDatabase } = require('./seed.cjs');

/** @type {import('better-sqlite3').Database | null} */
let db = null;

function tableExists(database, tableName) {
  return Boolean(
    database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(tableName)
  );
}

function migrateDocumentsFolderIdNullable(database) {
  if (!tableExists(database, 'documents') || !tableExists(database, 'folders')) {
    return;
  }

  const folderTableSql = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'folders'"
  ).get()?.sql ?? '';
  const documentTableSql = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'"
  ).get()?.sql ?? '';
  const documentColumns = database.prepare('PRAGMA table_info(documents)').all();
  const folderIdColumn = documentColumns.find((column) => column.name === 'folder_id');
  const requiresMixedTreeMigration =
    folderTableSql.includes('REFERENCES folders(id)') ||
    documentTableSql.includes('REFERENCES folders(id)');

  if (!folderIdColumn || (folderIdColumn.notnull === 0 && !requiresMixedTreeMigration)) {
    return;
  }

  console.log('[DB] Migrating tree containers to allow mixed document/folder nesting...');

  const folders = database.prepare('SELECT * FROM folders').all();
  const documents = database.prepare('SELECT * FROM documents').all();
  const documentShares = tableExists(database, 'document_shares')
    ? database.prepare('SELECT * FROM document_shares').all()
    : [];
  const documentTags = tableExists(database, 'document_tags')
    ? database.prepare('SELECT * FROM document_tags').all()
    : [];
  const backlinks = tableExists(database, 'backlinks')
    ? database.prepare('SELECT * FROM backlinks').all()
    : [];

  database.pragma('foreign_keys = OFF');

  try {
    const migrate = database.transaction(() => {
      database.exec(`
        DROP TABLE IF EXISTS workspace_search;
        DROP TABLE IF EXISTS workspace_search_entries;
        DROP TABLE IF EXISTS document_shares;
        DROP TABLE IF EXISTS document_tags;
        DROP TABLE IF EXISTS backlinks;
        DROP TABLE IF EXISTS documents;
        DROP TABLE IF EXISTS folders;
      `);

      database.exec(SCHEMA_SQL);

      const insertFolder = database.prepare(`
        INSERT INTO folders (
          id, space_id, parent_id, name, deleted_at, trash_root_id, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertDocument = database.prepare(`
        INSERT INTO documents (
          id, space_id, folder_id, title, content_json, is_favorite, deleted_at, trash_root_id, word_count, badge_label, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertDocumentShare = database.prepare(`
        INSERT INTO document_shares (id, document_id, token, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const insertDocumentTag = database.prepare(`
        INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)
      `);
      const insertBacklink = database.prepare(`
        INSERT INTO backlinks (id, source_doc_id, target_doc_id, source_block_id, description) VALUES (?, ?, ?, ?, ?)
      `);

      folders.forEach((folder) => {
        insertFolder.run(
          folder.id,
          folder.space_id,
          folder.parent_id ?? null,
          folder.name,
          folder.deleted_at ?? null,
          folder.trash_root_id ?? null,
          folder.sort_order ?? 0,
          folder.created_at,
          folder.updated_at,
        );
      });

      documents.forEach((document) => {
        insertDocument.run(
          document.id,
          document.space_id,
          document.folder_id ?? null,
          document.title,
          document.content_json,
          document.is_favorite ?? 0,
          document.deleted_at ?? null,
          document.trash_root_id ?? null,
          document.word_count,
          document.badge_label,
          document.created_at,
          document.updated_at,
        );
      });

      documentShares.forEach((share) => {
        insertDocumentShare.run(
          share.id,
          share.document_id,
          share.token,
          share.enabled,
          share.created_at,
          share.updated_at,
        );
      });

      documentTags.forEach((documentTag) => {
        insertDocumentTag.run(documentTag.document_id, documentTag.tag_id);
      });

      backlinks.forEach((backlink) => {
        insertBacklink.run(
          backlink.id,
          backlink.source_doc_id,
          backlink.target_doc_id,
          backlink.source_block_id ?? null,
          backlink.description,
        );
      });
    });

    migrate();
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

function migrateDocumentsFavoriteFlag(database) {
  if (!tableExists(database, 'documents')) {
    return;
  }

  const documentColumns = database.prepare('PRAGMA table_info(documents)').all();
  const favoriteColumn = documentColumns.find((column) => column.name === 'is_favorite');

  if (favoriteColumn) {
    return;
  }

  console.log('[DB] Adding is_favorite column to documents table...');
  database.exec("ALTER TABLE documents ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0");
}

function migrateTrashColumns(database) {
  if (tableExists(database, 'documents')) {
    const documentColumns = database.prepare('PRAGMA table_info(documents)').all();
    if (!documentColumns.find((column) => column.name === 'deleted_at')) {
      console.log('[DB] Adding deleted_at column to documents table...');
      database.exec('ALTER TABLE documents ADD COLUMN deleted_at TEXT');
    }
    if (!documentColumns.find((column) => column.name === 'trash_root_id')) {
      console.log('[DB] Adding trash_root_id column to documents table...');
      database.exec('ALTER TABLE documents ADD COLUMN trash_root_id TEXT');
    }
  }

  if (tableExists(database, 'folders')) {
    const folderColumns = database.prepare('PRAGMA table_info(folders)').all();
    if (!folderColumns.find((column) => column.name === 'deleted_at')) {
      console.log('[DB] Adding deleted_at column to folders table...');
      database.exec('ALTER TABLE folders ADD COLUMN deleted_at TEXT');
    }
    if (!folderColumns.find((column) => column.name === 'trash_root_id')) {
      console.log('[DB] Adding trash_root_id column to folders table...');
      database.exec('ALTER TABLE folders ADD COLUMN trash_root_id TEXT');
    }
  }
}

function migrateBacklinkSourceBlockId(database) {
  if (!tableExists(database, 'backlinks')) {
    return;
  }

  const backlinkColumns = database.prepare('PRAGMA table_info(backlinks)').all();
  if (backlinkColumns.find((column) => column.name === 'source_block_id')) {
    return;
  }

  console.log('[DB] Adding source_block_id column to backlinks table...');
  database.exec('ALTER TABLE backlinks ADD COLUMN source_block_id TEXT');
}

function getUserDataDir() {
  const overriddenUserDataDir = process.env.WORKKNOWLAGE_USER_DATA_DIR;

  if (overriddenUserDataDir && overriddenUserDataDir.trim()) {
    return overriddenUserDataDir;
  }

  return app.getPath('userData');
}

function getDbPath() {
  return path.join(getUserDataDir(), 'workknowlage.db');
}

/**
 * Opens the database, applies schema, seeds if empty.
 * @returns {import('better-sqlite3').Database}
 */
function initDatabase() {
  const dbPath = getDbPath();
  console.log('[DB] Opening database at:', dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(SCHEMA_SQL);
  migrateDocumentsFolderIdNullable(db);
  migrateDocumentsFavoriteFlag(db);
  migrateTrashColumns(db);
  migrateBacklinkSourceBlockId(db);

  // Seed on first launch
  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM spaces').get();
  if (cnt === 0) {
    console.log('[DB] Empty database detected, seeding initial data...');
    seedDatabase(db);
    console.log('[DB] Seed complete.');
  }

  console.log('[DB] Database ready.');
  return db;
}

/**
 * @returns {import('better-sqlite3').Database}
 */
function getDatabase() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed.');
  }
}

module.exports = { initDatabase, getDatabase, closeDatabase, getDbPath, getUserDataDir };
