const crypto = require('node:crypto');
const { getDatabase } = require('../db/index.cjs');

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function rowToShare(row) {
  if (!row) return null;

  return {
    id: row.id,
    documentId: row.document_id,
    token: row.token,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getShareByDocumentId(documentId) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id, document_id, token, enabled, created_at, updated_at
       FROM document_shares
       WHERE document_id = ?`
    )
    .get(documentId);

  return rowToShare(row);
}

function getShareByToken(token) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id, document_id, token, enabled, created_at, updated_at
       FROM document_shares
       WHERE token = ?`
    )
    .get(token);

  return rowToShare(row);
}

function upsertShare(documentId, { enabled = true, token = generateToken() } = {}) {
  const db = getDatabase();
  const existing = getShareByDocumentId(documentId);
  const nextToken = token || generateToken();

  if (existing) {
    db.prepare(
      `UPDATE document_shares
       SET token = ?, enabled = ?, updated_at = datetime('now')
       WHERE document_id = ?`
    ).run(nextToken, enabled ? 1 : 0, documentId);
    return getShareByDocumentId(documentId);
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO document_shares (id, document_id, token, enabled)
     VALUES (?, ?, ?, ?)`
  ).run(id, documentId, nextToken, enabled ? 1 : 0);

  return getShareByDocumentId(documentId);
}

function createShare(documentId) {
  const current = getShareByDocumentId(documentId);
  if (current) {
    if (!current.enabled) {
      return upsertShare(documentId, { enabled: true, token: current.token });
    }
    return current;
  }

  return upsertShare(documentId, { enabled: true });
}

function regenerateShare(documentId) {
  return upsertShare(documentId, { enabled: true });
}

function disableShare(documentId) {
  const current = getShareByDocumentId(documentId);
  if (!current) {
    return null;
  }

  const db = getDatabase();
  db.prepare(
    `UPDATE document_shares
     SET enabled = 0, updated_at = datetime('now')
     WHERE document_id = ?`
  ).run(documentId);

  return getShareByDocumentId(documentId);
}

module.exports = {
  createShare,
  disableShare,
  getShareByDocumentId,
  getShareByToken,
  regenerateShare,
};
