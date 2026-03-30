const crypto = require('node:crypto');
const { getDatabase } = require('../index.cjs');

function generateId() {
  return crypto.randomUUID();
}

function listSpaces() {
  const db = getDatabase();
  return db.prepare('SELECT id, name, label FROM spaces ORDER BY created_at').all();
}

function createSpace({ name, label }) {
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO spaces (id, name, label) VALUES (?, ?, ?)').run(id, name, label || 'WORKSPACE');
  return { id, name, label: label || 'WORKSPACE' };
}

function updateSpace(id, { name, label }) {
  const db = getDatabase();
  const sets = [];
  const values = [];
  if (name !== undefined) { sets.push('name = ?'); values.push(name); }
  if (label !== undefined) { sets.push('label = ?'); values.push(label); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE spaces SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

function deleteSpace(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM spaces WHERE id = ?').run(id);
}

module.exports = { listSpaces, createSpace, updateSpace, deleteSpace };
