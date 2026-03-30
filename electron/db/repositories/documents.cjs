const crypto = require('node:crypto');
const { getDatabase } = require('../index.cjs');
const {
  assertValidParentContainer,
  collectTreePackageIds,
  getContainerRow,
  getDescendantContainerIds,
} = require('./treeContainers.cjs');
const {
  deriveOutlineFromContentJson,
  deriveSectionsFromContentJson,
  deriveWordCount,
  normalizeContentJson,
  serializeSectionsAsContentJson,
} = require('../documentContent.cjs');

function generateId() {
  return crypto.randomUUID();
}

function assembleDocument(row) {
  if (!row) return null;
  const db = getDatabase();
  const contentJson = normalizeContentJson(row.content_json);
  const sections = deriveSectionsFromContentJson(contentJson);
  const outline = deriveOutlineFromContentJson(contentJson);
  const tags = db
    .prepare(
      `SELECT t.id, t.label, t.tone FROM tags t
       JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?`
    )
    .all(row.id);
  const backlinks = db
    .prepare(
      `SELECT b.id, b.source_doc_id AS sourceDocumentId, b.source_block_id AS sourceBlockId, d.title, b.description
       FROM backlinks b
       JOIN documents d ON d.id = b.source_doc_id
       WHERE b.target_doc_id = ?
         AND d.deleted_at IS NULL
       ORDER BY d.updated_at DESC, d.created_at DESC`
    )
    .all(row.id);

  return {
    id: row.id,
    spaceId: row.space_id,
    folderId: row.folder_id,
    title: row.title,
    contentJson,
    updatedAt: row.updated_at || '',
    updatedAtLabel: row.updated_at || '',
    wordCountLabel: `${row.word_count || 0} 字`,
    badgeLabel: row.badge_label || '',
    outline,
    tags,
    backlinks,
    sections,
    isFavorite: Boolean(row.is_favorite),
    deletedAt: row.deleted_at ?? null,
    trashRootId: row.trash_root_id ?? null,
  };
}

function listDocuments(spaceId, folderId) {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT * FROM documents WHERE space_id = ? AND folder_id IS ? AND deleted_at IS NULL ORDER BY created_at'
    )
    .all(spaceId, folderId ?? null);
  return rows.map(assembleDocument);
}

function getDocumentById(id, options = {}) {
  const db = getDatabase();
  const row = options.includeDeleted
    ? db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(id);
  return assembleDocument(row);
}

function listDocumentsForSpace(spaceId) {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT * FROM documents WHERE space_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, created_at DESC'
    )
    .all(spaceId);
  return rows.map(assembleDocument);
}

function listTrashedDocumentRoots(spaceId) {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM documents
       WHERE space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = id
       ORDER BY deleted_at DESC, updated_at DESC`
    )
    .all(spaceId);
  return rows.map(assembleDocument);
}

function listDocumentIdsForTrashRoot(spaceId, trashRootId) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT id FROM documents
       WHERE space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = ?`
    )
    .all(spaceId, trashRootId)
    .map((row) => row.id);
}

function createDocument({ spaceId, folderId, title }) {
  const db = getDatabase();
  assertValidParentContainer(db, spaceId, folderId ?? null, 'Document move target is invalid.');
  const id = generateId();
  const emptyContent = JSON.stringify([]);
  db.prepare(
    'INSERT INTO documents (id, space_id, folder_id, title, content_json, is_favorite, word_count, badge_label) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
  ).run(id, spaceId, folderId ?? null, title, emptyContent, '');
  return getDocumentById(id);
}

function updateDocument(id, data) {
  const db = getDatabase();
  const sets = [];
  const values = [];

  if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
  if (data.contentJson !== undefined || data.sections !== undefined) {
    const contentJson = data.contentJson !== undefined
      ? normalizeContentJson(data.contentJson)
      : serializeSectionsAsContentJson(data.sections);
    sets.push('content_json = ?');
    values.push(contentJson);
    const wordCount = deriveWordCount(contentJson);
    sets.push('word_count = ?');
    values.push(wordCount);
  }
  if (data.badgeLabel !== undefined) { sets.push('badge_label = ?'); values.push(data.badgeLabel); }
  if (data.isFavorite !== undefined) { sets.push('is_favorite = ?'); values.push(data.isFavorite ? 1 : 0); }

  if (sets.length === 0) return getDocumentById(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getDocumentById(id);
}

function moveDocument(id, targetFolderId) {
  const db = getDatabase();
  const currentRow = db
    .prepare('SELECT id, space_id AS spaceId FROM documents WHERE id = ? AND deleted_at IS NULL')
    .get(id);

  if (!currentRow) {
    throw new Error('Document move target is invalid.');
  }

  if (targetFolderId !== null) {
    const targetContainer = getContainerRow(db, targetFolderId);
    const descendantContainerIds = new Set(getDescendantContainerIds(db, 'document', id));
    if (
      id === targetFolderId ||
      descendantContainerIds.has(targetFolderId) ||
      !targetContainer ||
      currentRow.spaceId !== targetContainer.spaceId
    ) {
      throw new Error('Document move target is invalid.');
    }
  }

  db.prepare(
    "UPDATE documents SET folder_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(targetFolderId ?? null, id);

  return getDocumentById(id);
}

function trashDocument(id) {
  const db = getDatabase();
  const existing = getDocumentById(id);
  if (!existing) {
    return null;
  }

  const deletedAt = db.prepare("SELECT datetime('now') AS value").get().value;
  const { folderIds, documentIds } = collectTreePackageIds(db, 'document', id);
  const documentPlaceholders = documentIds.map(() => '?').join(', ');

  db.prepare(
    `UPDATE documents
     SET deleted_at = ?, trash_root_id = ?, updated_at = datetime('now')
     WHERE id IN (${documentPlaceholders})`
  ).run(deletedAt, id, ...documentIds);

  if (folderIds.length > 0) {
    const folderPlaceholders = folderIds.map(() => '?').join(', ');
    db.prepare(
      `UPDATE folders
       SET deleted_at = ?, trash_root_id = ?, updated_at = datetime('now')
       WHERE id IN (${folderPlaceholders})`
    ).run(deletedAt, id, ...folderIds);
  }

  return getDocumentById(id, { includeDeleted: true });
}

function restoreDocumentTrashRoot(spaceId, trashRootId) {
  const db = getDatabase();
  const documentRow = db.prepare(
    `SELECT id, folder_id AS folderId
     FROM documents
     WHERE id = ?
       AND space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).get(trashRootId, spaceId, trashRootId);

  if (!documentRow) {
    return false;
  }

  const validFolder = documentRow.folderId
    ? getContainerRow(db, documentRow.folderId)
    : null;
  const folderResult = db.prepare(
    `UPDATE folders
     SET deleted_at = NULL, trash_root_id = NULL, updated_at = datetime('now')
     WHERE space_id = ? AND deleted_at IS NOT NULL AND trash_root_id = ?`
  ).run(spaceId, trashRootId);
  const result = db.prepare(
    `UPDATE documents
     SET deleted_at = NULL,
         trash_root_id = NULL,
         updated_at = datetime('now')
     WHERE space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(spaceId, trashRootId);
  const rootResult = db.prepare(
    `UPDATE documents
     SET deleted_at = NULL,
         folder_id = ?,
         trash_root_id = NULL,
         updated_at = datetime('now')
     WHERE id = ?
       AND space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(validFolder ? documentRow.folderId : null, trashRootId, spaceId, trashRootId);

  return result.changes > 0 || folderResult.changes > 0 || rootResult.changes > 0;
}

function deleteDocumentTrashRoot(spaceId, trashRootId) {
  const db = getDatabase();
  const folderResult = db.prepare(
    `DELETE FROM folders
     WHERE space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(spaceId, trashRootId);
  const documentResult = db.prepare(
    `DELETE FROM documents
     WHERE space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(spaceId, trashRootId);

  return documentResult.changes > 0 || folderResult.changes > 0;
}

function emptyDocumentTrash(spaceId) {
  const db = getDatabase();
  const trashedDocumentIds = db
    .prepare(
      `SELECT id FROM documents
       WHERE space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = id`
    )
    .all(spaceId)
    .map((row) => row.id);

  if (trashedDocumentIds.length === 0) {
    return 0;
  }

  const placeholders = trashedDocumentIds.map(() => '?').join(', ');
  db.prepare(`DELETE FROM documents WHERE id IN (${placeholders})`).run(...trashedDocumentIds);
  return trashedDocumentIds.length;
}

function deleteDocument(id) {
  const db = getDatabase();
  const { folderIds, documentIds } = collectTreePackageIds(db, 'document', id, { includeDeleted: true });
  if (documentIds.length > 0) {
    const documentPlaceholders = documentIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM documents WHERE id IN (${documentPlaceholders})`).run(...documentIds);
  }
  if (folderIds.length > 0) {
    const folderPlaceholders = folderIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM folders WHERE id IN (${folderPlaceholders})`).run(...folderIds);
  }
}

module.exports = {
  listDocuments,
  listDocumentsForSpace,
  listTrashedDocumentRoots,
  listDocumentIdsForTrashRoot,
  getDocumentById,
  createDocument,
  updateDocument,
  moveDocument,
  trashDocument,
  restoreDocumentTrashRoot,
  deleteDocumentTrashRoot,
  emptyDocumentTrash,
  deleteDocument,
};
