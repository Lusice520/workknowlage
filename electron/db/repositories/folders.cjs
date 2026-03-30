const crypto = require('node:crypto');
const { getDatabase } = require('../index.cjs');
const {
  assertValidParentContainer,
  collectTreePackageIds,
  getContainerRow,
  getDescendantContainerIds,
} = require('./treeContainers.cjs');

function generateId() {
  return crypto.randomUUID();
}

function listFolders(spaceId) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT id, space_id AS spaceId, parent_id AS parentId, name, deleted_at AS deletedAt, trash_root_id AS trashRootId
       FROM folders
       WHERE space_id = ? AND deleted_at IS NULL
       ORDER BY sort_order, created_at`
    )
    .all(spaceId);
}

function listTrashedFolderRoots(spaceId) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT id, space_id AS spaceId, parent_id AS parentId, name, deleted_at AS deletedAt, trash_root_id AS trashRootId
       FROM folders
       WHERE space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = id
       ORDER BY deleted_at DESC, updated_at DESC`
    )
    .all(spaceId);
}

function createFolder({ spaceId, parentId, name }) {
  const db = getDatabase();
  assertValidParentContainer(db, spaceId, parentId || null, 'Folder move target is invalid.');
  const id = generateId();
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM folders WHERE space_id = ? AND parent_id IS ?')
    .get(spaceId, parentId || null);
  db.prepare('INSERT INTO folders (id, space_id, parent_id, name, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, spaceId, parentId || null, name, maxOrder.next);
  return { id, spaceId, parentId: parentId || null, name };
}

function renameFolder(id, name) {
  const db = getDatabase();
  db.prepare("UPDATE folders SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
}

function getFolderPackageStats(spaceId, trashRootId) {
  const db = getDatabase();
  const childFolderCount = db.prepare(
    'SELECT COUNT(*) AS count FROM folders WHERE space_id = ? AND deleted_at IS NOT NULL AND trash_root_id = ? AND id != ?'
  ).get(spaceId, trashRootId, trashRootId).count;
  const childDocumentCount = db.prepare(
    'SELECT COUNT(*) AS count FROM documents WHERE space_id = ? AND deleted_at IS NOT NULL AND trash_root_id = ?'
  ).get(spaceId, trashRootId).count;

  return {
    childFolderCount,
    childDocumentCount,
  };
}

function moveFolder(id, newParentId) {
  const db = getDatabase();
  if (newParentId !== null) {
    if (id === newParentId) {
      throw new Error('Cannot move a folder into itself or its descendant.');
    }

    const folder = db.prepare('SELECT id, space_id AS spaceId FROM folders WHERE id = ? AND deleted_at IS NULL').get(id);
    const targetContainer = getContainerRow(db, newParentId);
    const descendantContainerIds = new Set(getDescendantContainerIds(db, 'folder', id));

    if (!folder || !targetContainer || folder.spaceId !== targetContainer.spaceId) {
      throw new Error('Folder move target is invalid.');
    }

    if (descendantContainerIds.has(newParentId)) {
      throw new Error('Cannot move a folder into itself or its descendant.');
    }
  }

  db.prepare("UPDATE folders SET parent_id = ?, updated_at = datetime('now') WHERE id = ?").run(newParentId || null, id);
}

function trashFolder(id) {
  const db = getDatabase();
  const folder = db.prepare('SELECT id, space_id AS spaceId FROM folders WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!folder) {
    return null;
  }

  const deletedAt = db.prepare("SELECT datetime('now') AS value").get().value;
  const { folderIds, documentIds } = collectTreePackageIds(db, 'folder', id);
  const placeholders = folderIds.map(() => '?').join(', ');
  const documentPlaceholders = documentIds.map(() => '?').join(', ');

  db.prepare(
    `UPDATE folders
     SET deleted_at = ?, trash_root_id = ?, updated_at = datetime('now')
     WHERE id IN (${placeholders})`
  ).run(deletedAt, id, ...folderIds);

  if (documentIds.length > 0) {
    db.prepare(
      `UPDATE documents
       SET deleted_at = ?, trash_root_id = ?, updated_at = datetime('now')
       WHERE id IN (${documentPlaceholders})`
    ).run(deletedAt, id, ...documentIds);
  }

  return db.prepare(
    `SELECT id, space_id AS spaceId, parent_id AS parentId, name, deleted_at AS deletedAt, trash_root_id AS trashRootId
     FROM folders
     WHERE id = ?`
  ).get(id);
}

function restoreFolderTrashRoot(spaceId, trashRootId) {
  const db = getDatabase();
  const trashRootFolder = db.prepare(
    `SELECT id, parent_id AS parentId
     FROM folders
     WHERE id = ?
       AND space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).get(trashRootId, spaceId, trashRootId);

  if (!trashRootFolder) {
    return false;
  }

  const validParent = trashRootFolder.parentId
    ? getContainerRow(db, trashRootFolder.parentId)
    : null;

  db.prepare(
    `UPDATE folders
     SET parent_id = ?, updated_at = datetime('now')
     WHERE id = ?
       AND space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(validParent ? trashRootFolder.parentId : null, trashRootId, spaceId, trashRootId);

  const folderResult = db.prepare(
    `UPDATE folders
     SET deleted_at = NULL, trash_root_id = NULL, updated_at = datetime('now')
     WHERE space_id = ? AND deleted_at IS NOT NULL AND trash_root_id = ?`
  ).run(spaceId, trashRootId);

  db.prepare(
    `UPDATE documents
     SET deleted_at = NULL, trash_root_id = NULL, updated_at = datetime('now')
     WHERE space_id = ? AND deleted_at IS NOT NULL AND trash_root_id = ?`
  ).run(spaceId, trashRootId);

  return folderResult.changes > 0;
}

function deleteFolderTrashRoot(spaceId, trashRootId) {
  const db = getDatabase();
  const documentResult = db.prepare(
    `DELETE FROM documents
     WHERE space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(spaceId, trashRootId);
  const folderResult = db.prepare(
    `DELETE FROM folders
     WHERE space_id = ?
       AND deleted_at IS NOT NULL
       AND trash_root_id = ?`
  ).run(spaceId, trashRootId);

  return folderResult.changes > 0 || documentResult.changes > 0;
}

function emptyFolderTrash(spaceId) {
  const db = getDatabase();
  const trashedFolderIds = db
    .prepare(
      `SELECT id FROM folders
       WHERE space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = id`
    )
    .all(spaceId)
    .map((row) => row.id);

  trashedFolderIds.forEach((folderId) => {
    db.prepare(
      `DELETE FROM folders
       WHERE id = ?
         AND space_id = ?
         AND deleted_at IS NOT NULL
         AND trash_root_id = ?`
    ).run(folderId, spaceId, folderId);
  });

  return trashedFolderIds.length;
}

function deleteFolder(id) {
  const db = getDatabase();
  const { folderIds, documentIds } = collectTreePackageIds(db, 'folder', id, { includeDeleted: true });
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
  listFolders,
  listTrashedFolderRoots,
  createFolder,
  renameFolder,
  moveFolder,
  trashFolder,
  restoreFolderTrashRoot,
  deleteFolderTrashRoot,
  emptyFolderTrash,
  getFolderPackageStats,
  deleteFolder,
};
