const { extractDocumentMentions } = require('../documentContent.cjs');

function resolveDatabase(database) {
  if (database) {
    return database;
  }

  return require('../index.cjs').getDatabase();
}

function buildBacklinkId(sourceDocumentId, targetDocumentId) {
  return `backlink-${sourceDocumentId}-${targetDocumentId}`;
}

function clearBacklinksForSpace(spaceId, database) {
  const resolvedDatabase = resolveDatabase(database);

  resolvedDatabase.prepare(
    `DELETE FROM backlinks
     WHERE source_doc_id IN (SELECT id FROM documents WHERE space_id = ?)
        OR target_doc_id IN (SELECT id FROM documents WHERE space_id = ?)`
  ).run(spaceId, spaceId);
}

function rebuildBacklinksForSpace(spaceId, database) {
  const resolvedDatabase = resolveDatabase(database);
  const documents = resolvedDatabase
    .prepare(
      `SELECT id, title, content_json AS contentJson
       FROM documents
       WHERE space_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at`
    )
    .all(spaceId);

  clearBacklinksForSpace(spaceId, resolvedDatabase);

  if (documents.length === 0) {
    return 0;
  }

  const activeDocumentIds = new Set(documents.map((document) => document.id));
  const insertBacklink = resolvedDatabase.prepare(
    `INSERT INTO backlinks (id, source_doc_id, target_doc_id, source_block_id, description)
     VALUES (?, ?, ?, ?, ?)`
  );

  let insertedCount = 0;
  documents.forEach((document) => {
    const mentions = extractDocumentMentions(document.contentJson, document.id);

    mentions.forEach((mention) => {
      if (!activeDocumentIds.has(mention.targetDocumentId)) {
        return;
      }

      insertBacklink.run(
        buildBacklinkId(document.id, mention.targetDocumentId),
        document.id,
        mention.targetDocumentId,
        mention.sourceBlockId,
        mention.description,
      );
      insertedCount += 1;
    });
  });

  return insertedCount;
}

module.exports = {
  rebuildBacklinksForSpace,
};
