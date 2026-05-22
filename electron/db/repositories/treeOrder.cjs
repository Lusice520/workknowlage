const { getDatabase } = require('../index.cjs');
const { getDescendantContainerIds } = require('./treeContainers.cjs');

const NODE_KINDS = new Set(['folder', 'document']);
const POSITIONS = new Set(['before', 'after']);

function assertValidInput(input) {
  if (
    !input ||
    !NODE_KINDS.has(input.draggedKind) ||
    !NODE_KINDS.has(input.targetKind) ||
    !POSITIONS.has(input.position) ||
    typeof input.draggedId !== 'string' ||
    typeof input.targetId !== 'string'
  ) {
    throw new Error('Tree reorder target is invalid.');
  }
}

function getNodeRow(db, kind, id) {
  if (kind === 'folder') {
    return db
      .prepare(
        `SELECT id, 'folder' AS kind, space_id AS spaceId, parent_id AS parentId, sort_order AS sortOrder
         FROM folders
         WHERE id = ? AND deleted_at IS NULL`
      )
      .get(id);
  }

  return db
    .prepare(
      `SELECT id, 'document' AS kind, space_id AS spaceId, folder_id AS parentId, sort_order AS sortOrder
       FROM documents
       WHERE id = ? AND deleted_at IS NULL`
    )
    .get(id);
}

function listSiblingRows(db, spaceId, parentId) {
  return db
    .prepare(
      `SELECT id, kind, parentId, sortOrder, createdAt
       FROM (
         SELECT id, 'folder' AS kind, parent_id AS parentId, sort_order AS sortOrder, created_at AS createdAt
         FROM folders
         WHERE space_id = ? AND parent_id IS ? AND deleted_at IS NULL
         UNION ALL
         SELECT id, 'document' AS kind, folder_id AS parentId, sort_order AS sortOrder, created_at AS createdAt
         FROM documents
         WHERE space_id = ? AND folder_id IS ? AND deleted_at IS NULL
       )
       ORDER BY sortOrder, createdAt, kind, id`
    )
    .all(spaceId, parentId, spaceId, parentId);
}

function getNextTreeSortOrder(db, spaceId, parentId) {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(sortOrder), -1) + 1 AS next
       FROM (
         SELECT sort_order AS sortOrder
         FROM folders
         WHERE space_id = ? AND parent_id IS ? AND deleted_at IS NULL
         UNION ALL
         SELECT sort_order AS sortOrder
         FROM documents
         WHERE space_id = ? AND folder_id IS ? AND deleted_at IS NULL
       )`
    )
    .get(spaceId, parentId, spaceId, parentId);

  return row.next;
}

function updateNodeOrder(db, node, parentId, sortOrder) {
  if (node.kind === 'folder') {
    db.prepare(
      "UPDATE folders SET parent_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(parentId, sortOrder, node.id);
    return;
  }

  db.prepare(
    "UPDATE documents SET folder_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(parentId, sortOrder, node.id);
}

function reorderTreeNode(input) {
  assertValidInput(input);

  const db = getDatabase();
  const draggedNode = getNodeRow(db, input.draggedKind, input.draggedId);
  const targetNode = getNodeRow(db, input.targetKind, input.targetId);

  if (!draggedNode || !targetNode || draggedNode.spaceId !== targetNode.spaceId || draggedNode.id === targetNode.id) {
    throw new Error('Tree reorder target is invalid.');
  }

  const descendantIds = new Set(getDescendantContainerIds(db, input.draggedKind, input.draggedId));
  if (descendantIds.has(targetNode.id)) {
    throw new Error('Cannot move a node before or after its descendant.');
  }

  const nextParentId = targetNode.parentId ?? null;
  const siblingsWithoutDragged = listSiblingRows(db, targetNode.spaceId, nextParentId)
    .filter((node) => !(node.kind === draggedNode.kind && node.id === draggedNode.id));
  const targetIndex = siblingsWithoutDragged.findIndex((node) => node.kind === targetNode.kind && node.id === targetNode.id);

  if (targetIndex < 0) {
    throw new Error('Tree reorder target is invalid.');
  }

  const insertIndex = input.position === 'before' ? targetIndex : targetIndex + 1;
  const nextSiblings = [
    ...siblingsWithoutDragged.slice(0, insertIndex),
    { id: draggedNode.id, kind: draggedNode.kind },
    ...siblingsWithoutDragged.slice(insertIndex),
  ];

  const reorderTransaction = db.transaction(() => {
    nextSiblings.forEach((node, index) => {
      updateNodeOrder(db, node, nextParentId, index);
    });
  });

  reorderTransaction();
}

module.exports = {
  getNextTreeSortOrder,
  reorderTreeNode,
};
