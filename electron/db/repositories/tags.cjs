const crypto = require('node:crypto');
const { getDatabase } = require('../index.cjs');

function generateId() {
  return crypto.randomUUID();
}

function listTagsForDocument(documentId) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT t.id, t.label, t.tone FROM tags t
       JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?`
    )
    .all(documentId);
}

function addTagToDocument(documentId, { label, tone }) {
  const db = getDatabase();

  // Upsert tag
  let tag = db.prepare('SELECT id, label, tone FROM tags WHERE label = ?').get(label);
  if (!tag) {
    const id = generateId();
    db.prepare('INSERT INTO tags (id, label, tone) VALUES (?, ?, ?)').run(id, label, tone || 'neutral');
    tag = { id, label, tone: tone || 'neutral' };
  }

  // Link
  db.prepare('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)').run(documentId, tag.id);

  return tag;
}

function removeTagFromDocument(documentId, tagId) {
  const db = getDatabase();
  db.prepare('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?').run(documentId, tagId);
}

module.exports = { listTagsForDocument, addTagToDocument, removeTagFromDocument };
