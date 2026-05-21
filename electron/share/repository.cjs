const crypto = require('node:crypto');
const { getDatabase } = require('../db/index.cjs');

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function generatePublicPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

function hashPublicPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const normalizedPassword = String(password || '');
  const hash = crypto.scryptSync(normalizedPassword, salt, 32).toString('base64url');
  return { hash, salt };
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSqliteTimestampForDateParse(value) {
  const timestamp = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(timestamp)) {
    return `${timestamp.replace(' ', 'T')}Z`;
  }
  return timestamp;
}

function isPublicShareExpired(share, now = new Date()) {
  const expiresAt = String(share?.publicExpiresAt || '').trim();
  if (!expiresAt) {
    return false;
  }

  const expiresTime = Date.parse(normalizeSqliteTimestampForDateParse(expiresAt));
  return !Number.isNaN(expiresTime) && expiresTime <= now.getTime();
}

function rowToShare(row) {
  if (!row) return null;

  return {
    id: row.id,
    documentId: row.document_id,
    token: row.token,
    enabled: Boolean(row.enabled),
    publicToken: row.public_token || '',
    publicEnabled: Boolean(row.public_enabled),
    publicExpiresAt: row.public_expires_at || null,
    publicCreatedAt: row.public_created_at || null,
    publicUpdatedAt: row.public_updated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function selectShareColumns() {
  return `id, document_id, token, enabled,
          public_token, public_enabled, public_password_hash, public_password_salt,
          public_expires_at, public_created_at, public_updated_at,
          created_at, updated_at`;
}

function getShareByDocumentId(documentId) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT ${selectShareColumns()}
       FROM document_shares
       WHERE document_id = ?`
    )
    .get(documentId);

  return rowToShare(row);
}

function listSharesForSpace(spaceId) {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT s.id,
              s.document_id,
              s.token,
              s.enabled,
              s.public_token,
              s.public_enabled,
              s.public_password_hash,
              s.public_password_salt,
              s.public_expires_at,
              s.public_created_at,
              s.public_updated_at,
              s.created_at,
              s.updated_at,
              d.title AS document_title,
              d.document_kind AS document_kind,
              d.folder_id AS folder_id
       FROM document_shares s
       INNER JOIN documents d ON d.id = s.document_id
       WHERE d.space_id = ?
         AND d.deleted_at IS NULL
         AND (s.enabled = 1 OR s.public_enabled = 1)
       ORDER BY s.updated_at DESC`
    )
    .all(spaceId);

  return rows
    .map((row) => ({
      ...rowToShare(row),
      documentTitle: row.document_title,
      documentKind: row.document_kind || 'note',
      folderId: row.folder_id || null,
    }))
    .filter((share) => Boolean(share?.enabled || (share?.publicEnabled && !isPublicShareExpired(share))));
}

function disableSharesForSpace(spaceId) {
  const shares = listSharesForSpace(spaceId);
  if (shares.length === 0) {
    return 0;
  }

  const db = getDatabase();
  const documentIds = shares.map((share) => share.documentId);
  const placeholders = documentIds.map(() => '?').join(',');
  db.prepare(
    `UPDATE document_shares
     SET enabled = 0,
         public_enabled = 0,
         public_updated_at = CASE WHEN public_enabled = 1 THEN datetime('now') ELSE public_updated_at END,
         updated_at = datetime('now')
     WHERE document_id IN (${placeholders})`
  ).run(...documentIds);

  return shares.length;
}

function getShareByToken(token) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT ${selectShareColumns()}
       FROM document_shares
       WHERE token = ?`
    )
    .get(token);

  return rowToShare(row);
}

function getPublicShareRowByToken(publicToken) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT ${selectShareColumns()}
       FROM document_shares
       WHERE public_token = ?`
    )
    .get(publicToken);
}

function getPublicShareByToken(publicToken) {
  const share = rowToShare(getPublicShareRowByToken(publicToken));
  if (!share || !share.publicEnabled || isPublicShareExpired(share)) {
    return null;
  }

  return share;
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

function createPublicShare(documentId, { expiresAt } = {}) {
  const db = getDatabase();
  const existing = getShareByDocumentId(documentId);
  const id = existing?.id || crypto.randomUUID();
  const localToken = existing?.token || generateToken();
  const publicToken = generateToken();
  const publicPassword = generatePublicPassword();
  const { hash, salt } = hashPublicPassword(publicPassword);
  const publicExpiresAt = String(expiresAt || '').trim() || null;

  if (existing) {
    db.prepare(
      `UPDATE document_shares
       SET public_token = ?,
           public_enabled = 1,
           public_password_hash = ?,
           public_password_salt = ?,
           public_expires_at = ?,
           public_created_at = COALESCE(public_created_at, datetime('now')),
           public_updated_at = datetime('now'),
           updated_at = datetime('now')
       WHERE document_id = ?`
    ).run(publicToken, hash, salt, publicExpiresAt, documentId);
  } else {
    db.prepare(
      `INSERT INTO document_shares (
         id, document_id, token, enabled,
         public_token, public_enabled, public_password_hash, public_password_salt,
         public_expires_at, public_created_at, public_updated_at
       ) VALUES (?, ?, ?, 0, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(id, documentId, localToken, publicToken, hash, salt, publicExpiresAt);
  }

  return {
    ...getShareByDocumentId(documentId),
    publicPassword,
  };
}

function verifyPublicSharePassword(publicToken, password) {
  const row = getPublicShareRowByToken(publicToken);
  const share = rowToShare(row);
  if (!share || !share.publicEnabled || isPublicShareExpired(share)) {
    return false;
  }

  if (!row.public_password_hash || !row.public_password_salt) {
    return false;
  }

  const { hash } = hashPublicPassword(password, row.public_password_salt);
  return timingSafeEqualString(hash, row.public_password_hash);
}

function disablePublicShare(documentId) {
  const current = getShareByDocumentId(documentId);
  if (!current) {
    return null;
  }

  const db = getDatabase();
  db.prepare(
    `UPDATE document_shares
     SET public_enabled = 0,
         public_updated_at = datetime('now'),
         updated_at = datetime('now')
     WHERE document_id = ?`
  ).run(documentId);

  return getShareByDocumentId(documentId);
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
  createPublicShare,
  disableShare,
  disablePublicShare,
  disableSharesForSpace,
  getShareByDocumentId,
  getPublicShareByToken,
  getShareByToken,
  listSharesForSpace,
  regenerateShare,
  verifyPublicSharePassword,
};
