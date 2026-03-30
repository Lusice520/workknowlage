const crypto = require('node:crypto');
const { getDatabase } = require('../index.cjs');

function generateId() {
  return crypto.randomUUID();
}

function assembleQuickNote(row) {
  if (!row) return null;

  return {
    id: row.id,
    spaceId: row.space_id,
    noteDate: row.note_date,
    title: row.title,
    contentJson: row.content_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDefaultQuickNoteSpaceId(db) {
  const fallbackSpace = db
    .prepare('SELECT id FROM spaces ORDER BY created_at LIMIT 1')
    .get();

  if (!fallbackSpace?.id) {
    throw new Error('Cannot persist quick note without an available space.');
  }

  return fallbackSpace.id;
}

function resolveQuickNoteDate(noteDateOrSpaceId, maybeNoteDate) {
  return maybeNoteDate || noteDateOrSpaceId;
}

function resolveQuickNoteMonthKey(monthKeyOrSpaceId, maybeMonthKey) {
  return maybeMonthKey || monthKeyOrSpaceId;
}

function getQuickNote(noteDateOrSpaceId, maybeNoteDate) {
  const db = getDatabase();
  const noteDate = resolveQuickNoteDate(noteDateOrSpaceId, maybeNoteDate);
  const row = db
    .prepare(
      `SELECT *
       FROM quick_notes
       WHERE note_date = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    )
    .get(noteDate);
  return assembleQuickNote(row);
}

function upsertQuickNote({ noteDate, title, contentJson, spaceId }) {
  const db = getDatabase();
  const existing = db
    .prepare(
      `SELECT id
       FROM quick_notes
       WHERE note_date = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    )
    .get(noteDate);

  if (existing?.id) {
    db.prepare(
      `UPDATE quick_notes
       SET title = ?, content_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(title, contentJson, existing.id);
    return getQuickNote(noteDate);
  }

  const id = generateId();
  const storageSpaceId = spaceId || getDefaultQuickNoteSpaceId(db);
  db.prepare(
    `INSERT INTO quick_notes (id, space_id, note_date, title, content_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, storageSpaceId, noteDate, title, contentJson);

  return getQuickNote(noteDate);
}

function listMonthQuickNotes(monthKeyOrSpaceId, maybeMonthKey) {
  const db = getDatabase();
  const monthKey = resolveQuickNoteMonthKey(monthKeyOrSpaceId, maybeMonthKey);
  return db
    .prepare(
      `SELECT note_date AS noteDate, MAX(updated_at) AS updatedAt
       FROM quick_notes
       WHERE note_date LIKE ?
       GROUP BY note_date
       ORDER BY note_date`
    )
    .all(`${monthKey}-%`);
}

module.exports = {
  getQuickNote,
  upsertQuickNote,
  listMonthQuickNotes,
};
