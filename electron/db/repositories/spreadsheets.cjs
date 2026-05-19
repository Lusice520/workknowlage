const { getDatabase } = require('../index.cjs');

function assertValidWorkbookJson(workbookJson) {
  if (typeof workbookJson !== 'string' || workbookJson.trim().length === 0) {
    throw new Error('Spreadsheet workbook JSON must be a non-empty string.');
  }

  try {
    JSON.parse(workbookJson);
  } catch {
    throw new Error('Spreadsheet workbook JSON is invalid.');
  }
}

function getSpreadsheetWorkbook(documentId) {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT document_id AS documentId, workbook_json AS workbookJson, updated_at AS updatedAt
       FROM document_spreadsheets
       WHERE document_id = ?`
    )
    .get(documentId) ?? null;
}

function updateSpreadsheetWorkbook(documentId, workbookJson) {
  assertValidWorkbookJson(workbookJson);
  const db = getDatabase();
  const updateTransaction = db.transaction(() => {
    const result = db
      .prepare(
        `UPDATE document_spreadsheets
         SET workbook_json = ?, updated_at = datetime('now')
         WHERE document_id = ?`
      )
      .run(workbookJson, documentId);

    if (result.changes === 0) {
      throw new Error('Spreadsheet workbook not found.');
    }

    db
      .prepare("UPDATE documents SET updated_at = datetime('now') WHERE id = ?")
      .run(documentId);
  });

  updateTransaction();
  return getSpreadsheetWorkbook(documentId);
}

module.exports = {
  getSpreadsheetWorkbook,
  updateSpreadsheetWorkbook,
};
