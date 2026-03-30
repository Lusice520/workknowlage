function getFolderRow(db, id, options = {}) {
  const row = options.includeDeleted
    ? db.prepare('SELECT id, space_id AS spaceId, parent_id AS parentId FROM folders WHERE id = ?').get(id)
    : db.prepare('SELECT id, space_id AS spaceId, parent_id AS parentId FROM folders WHERE id = ? AND deleted_at IS NULL').get(id);

  return row ? { ...row, kind: 'folder' } : null;
}

function getDocumentRow(db, id, options = {}) {
  const row = options.includeDeleted
    ? db.prepare('SELECT id, space_id AS spaceId, folder_id AS parentId FROM documents WHERE id = ?').get(id)
    : db.prepare('SELECT id, space_id AS spaceId, folder_id AS parentId FROM documents WHERE id = ? AND deleted_at IS NULL').get(id);

  return row ? { ...row, kind: 'document' } : null;
}

function getContainerRow(db, id, options = {}) {
  return getFolderRow(db, id, options) ?? getDocumentRow(db, id, options);
}

function listChildFolderRows(db, parentId, options = {}) {
  return (options.includeDeleted
    ? db.prepare('SELECT id FROM folders WHERE parent_id = ?')
    : db.prepare('SELECT id FROM folders WHERE parent_id = ? AND deleted_at IS NULL')
  ).all(parentId);
}

function listChildDocumentRows(db, parentId, options = {}) {
  return (options.includeDeleted
    ? db.prepare('SELECT id FROM documents WHERE folder_id = ?')
    : db.prepare('SELECT id FROM documents WHERE folder_id = ? AND deleted_at IS NULL')
  ).all(parentId);
}

function collectTreePackageIds(db, rootKind, rootId, options = {}) {
  const folderIds = [];
  const documentIds = [];
  const seenFolderIds = new Set();
  const seenDocumentIds = new Set();

  const visitFolder = (folderId) => {
    if (seenFolderIds.has(folderId)) {
      return;
    }

    seenFolderIds.add(folderId);
    folderIds.push(folderId);
    listChildFolderRows(db, folderId, options).forEach((folder) => visitFolder(folder.id));
    listChildDocumentRows(db, folderId, options).forEach((document) => visitDocument(document.id));
  };

  const visitDocument = (documentId) => {
    if (seenDocumentIds.has(documentId)) {
      return;
    }

    seenDocumentIds.add(documentId);
    documentIds.push(documentId);
    listChildFolderRows(db, documentId, options).forEach((folder) => visitFolder(folder.id));
    listChildDocumentRows(db, documentId, options).forEach((document) => visitDocument(document.id));
  };

  if (rootKind === 'folder') {
    visitFolder(rootId);
  } else {
    visitDocument(rootId);
  }

  return { folderIds, documentIds };
}

function getDescendantContainerIds(db, rootKind, rootId, options = {}) {
  const packageIds = collectTreePackageIds(db, rootKind, rootId, options);

  return [
    ...packageIds.folderIds.filter((id) => !(rootKind === 'folder' && id === rootId)),
    ...packageIds.documentIds.filter((id) => !(rootKind === 'document' && id === rootId)),
  ];
}

function assertValidParentContainer(db, spaceId, parentId, invalidMessage) {
  if (parentId === null) {
    return null;
  }

  const container = getContainerRow(db, parentId);
  if (!container || container.spaceId !== spaceId) {
    throw new Error(invalidMessage);
  }

  return container;
}

module.exports = {
  assertValidParentContainer,
  collectTreePackageIds,
  getContainerRow,
  getDescendantContainerIds,
};
