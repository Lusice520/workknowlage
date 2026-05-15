const { getDatabase } = require('../index.cjs');

function asRecord(value) {
  return typeof value === 'object' && value !== null ? value : null;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function collectTextSegments(value, segments = []) {
  if (typeof value === 'string') {
    const text = normalizeWhitespace(value);
    if (text.length > 0) {
      segments.push(text);
    }
    return segments;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectTextSegments(item, segments));
    return segments;
  }

  const record = asRecord(value);
  if (!record) {
    return segments;
  }

  ['text', 'title', 'caption', 'label', 'name'].forEach((key) => {
    if (typeof record[key] === 'string') {
      const text = normalizeWhitespace(record[key]);
      if (text.length > 0) {
        segments.push(text);
      }
    }
  });

  if ('content' in record) {
    collectTextSegments(record.content, segments);
  }

  if ('children' in record) {
    collectTextSegments(record.children, segments);
  }

  if ('items' in record) {
    collectTextSegments(record.items, segments);
  }

  if ('props' in record) {
    collectTextSegments(record.props, segments);
  }

  return segments;
}

function parseContentJson(contentJson) {
  if (typeof contentJson !== 'string' || contentJson.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(contentJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractPlainTextFromContentJson(contentJson) {
  return normalizeWhitespace(collectTextSegments(parseContentJson(contentJson)).join(' '));
}

function collectDirectTextSegments(value, segments = []) {
  if (typeof value === 'string') {
    const text = normalizeWhitespace(value);
    if (text.length > 0) {
      segments.push(text);
    }
    return segments;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const record = asRecord(item);
      if (record && typeof record.text === 'string') {
        const text = normalizeWhitespace(record.text);
        if (text.length > 0) {
          segments.push(text);
        }
      } else if (typeof item === 'string') {
        const text = normalizeWhitespace(item);
        if (text.length > 0) {
          segments.push(text);
        }
      }
    });
    return segments;
  }

  const record = asRecord(value);
  if (!record) {
    return segments;
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    if (typeof props?.title === 'string') {
      const mentionText = normalizeWhitespace(`@${props.title}`);
      if (mentionText.length > 0) {
        segments.push(mentionText);
      }
    }
    return segments;
  }

  if (typeof record.text === 'string') {
    const text = normalizeWhitespace(record.text);
    if (text.length > 0) {
      segments.push(text);
    }
  }

  return segments;
}

function collectDirectFieldText(record, keys) {
  if (!record) {
    return [];
  }

  return keys.flatMap((key) => collectDirectTextSegments(record[key]));
}

function extractBlockDirectText(block) {
  const record = asRecord(block);
  if (!record) {
    return '';
  }

  const props = asRecord(record.props);
  const propText = collectDirectFieldText(props, ['title', 'caption', 'label', 'name']).join(' ');
  const blockFieldText = collectDirectFieldText(record, ['title', 'content', 'caption', 'label', 'name', 'items']).join(' ');

  return normalizeWhitespace([propText, blockFieldText].filter(Boolean).join(' '));
}

function buildDocumentBlockSearchEntries(input) {
  const blocks = parseContentJson(input.contentJson ?? input.content_json ?? '[]');
  const spaceId = input.spaceId ?? input.space_id ?? null;
  const documentId = input.documentId ?? input.document_id ?? input.id ?? null;
  const documentTitle = normalizeWhitespace(input.title || '');

  if (!spaceId || !documentId || blocks.length === 0) {
    return [];
  }

  const entries = [];
  const visit = (items) => {
    items.forEach((item) => {
      const block = asRecord(item);
      if (!block) {
        return;
      }

      const blockId = typeof block.id === 'string' ? block.id : null;
      const blockType = typeof block.type === 'string' ? block.type : 'unknown';
      const blockText = extractBlockDirectText(block);

      if (blockId && blockText.length > 0) {
        entries.push({
          spaceId,
          documentId,
          blockId,
          blockType,
          title: documentTitle,
          preview: makePreview(blockText, documentTitle),
          fallbackText: blockText,
          titleSearch: tokenizeSearchText(documentTitle).join(' '),
          bodySearch: tokenizeSearchText(blockText).join(' '),
        });
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        visit(block.children);
      }
    });
  };

  visit(blocks);
  return entries;
}

function tokenizeSearchText(text) {
  const normalized = normalizeWhitespace(String(text || ''));
  if (normalized.length === 0) {
    return [];
  }

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
    return Array.from(segmenter.segment(normalized))
      .filter((item) => item.isWordLike)
      .map((item) => item.segment.trim())
      .filter(Boolean);
  }

  return normalized
    .split(/[^\p{L}\p{N}_]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function escapeFtsToken(token) {
  return `"${token.replace(/"/g, '""')}"`;
}

function buildFtsMatchQuery(query) {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0) {
    return '';
  }

  return tokens.map(escapeFtsToken).join(' AND ');
}

function makePreview(text, fallbackText = '') {
  const source = normalizeWhitespace(text || fallbackText || '');
  if (source.length === 0) {
    return '';
  }

  return source.length > 120 ? `${source.slice(0, 120)}…` : source;
}

function buildSearchEntry(input) {
  const entityId = input.id;
  const kind = input.kind;
  const spaceId = input.spaceId ?? input.space_id ?? '__global-quick-notes__';
  const documentId = input.documentId ?? input.document_id ?? null;
  const noteDate = input.noteDate ?? input.note_date ?? null;
  const title = normalizeWhitespace(input.title || '');
  const bodyText = extractPlainTextFromContentJson(input.contentJson ?? input.content_json ?? '[]');

  return {
    entityId,
    spaceId,
    kind,
    documentId,
    noteDate,
    title,
    preview: makePreview(bodyText, title),
    titleSearch: tokenizeSearchText(title).join(' '),
    bodySearch: tokenizeSearchText(bodyText).join(' '),
  };
}

function upsertDocumentBlockSearchEntries(input, db = getDatabase()) {
  const documentId = input.documentId ?? input.document_id ?? input.id ?? null;
  if (!documentId) {
    return [];
  }

  const entries = buildDocumentBlockSearchEntries(input);
  db.prepare('DELETE FROM workspace_block_search_entries WHERE document_id = ?').run(documentId);

  if (entries.length === 0) {
    return [];
  }

  const insertEntry = db.prepare(
    `INSERT INTO workspace_block_search_entries (
       space_id, document_id, block_id, block_type, title, preview, fallback_text, title_search, body_search
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(document_id, block_id) DO UPDATE SET
       space_id = excluded.space_id,
       block_type = excluded.block_type,
       title = excluded.title,
       preview = excluded.preview,
       fallback_text = excluded.fallback_text,
       title_search = excluded.title_search,
       body_search = excluded.body_search,
       updated_at = datetime('now')`
  );

  entries.forEach((entry) => {
    insertEntry.run(
      entry.spaceId,
      entry.documentId,
      entry.blockId,
      entry.blockType,
      entry.title,
      entry.preview,
      entry.fallbackText,
      entry.titleSearch,
      entry.bodySearch,
    );
  });

  return entries;
}

function upsertSearchEntry(input, db = getDatabase()) {
  const entry = buildSearchEntry(input);
  db.prepare(
    `INSERT INTO workspace_search_entries (
       entity_id, space_id, kind, document_id, note_date, title, preview, title_search, body_search
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entity_id) DO UPDATE SET
       space_id = excluded.space_id,
       kind = excluded.kind,
       document_id = excluded.document_id,
       note_date = excluded.note_date,
       title = excluded.title,
       preview = excluded.preview,
       title_search = excluded.title_search,
       body_search = excluded.body_search,
       updated_at = datetime('now')`
  ).run(
    entry.entityId,
    entry.spaceId,
    entry.kind,
    entry.documentId,
    entry.noteDate,
    entry.title,
    entry.preview,
    entry.titleSearch,
    entry.bodySearch
  );
  if (entry.kind === 'document') {
    upsertDocumentBlockSearchEntries(input, db);
  }
  return entry;
}

function removeSearchEntry(entityId, db = getDatabase()) {
  db.prepare('DELETE FROM workspace_search_entries WHERE entity_id = ?').run(entityId);
}

function removeDocumentBlockSearchEntries(documentId, db = getDatabase()) {
  db.prepare('DELETE FROM workspace_block_search_entries WHERE document_id = ?').run(documentId);
}

function searchWorkspace({ spaceId, query, limit = 20 } = {}) {
  const matchQuery = buildFtsMatchQuery(query);
  if (!spaceId || !matchQuery) {
    return [];
  }

  const db = getDatabase();
  const documentAndQuickNoteHits = db
    .prepare(
      `SELECT
         e.entity_id AS id,
         e.kind,
         e.title,
         e.preview,
         e.space_id AS spaceId,
         e.document_id AS documentId,
         e.note_date AS noteDate,
         d.folder_id AS folderId,
         bm25(workspace_search) AS rank
       FROM workspace_search
       JOIN workspace_search_entries e ON e.id = workspace_search.rowid
       LEFT JOIN documents d ON d.id = e.document_id AND d.deleted_at IS NULL
       WHERE workspace_search MATCH ?
         AND (e.kind = 'quick-note' OR e.space_id = ?)
         AND (e.kind != 'document' OR d.id IS NOT NULL)
       ORDER BY rank ASC
       LIMIT ?`
    )
    .all(matchQuery, spaceId, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      preview: row.preview,
      spaceId: row.spaceId,
      rank: row.rank,
      ...(row.documentId ? { documentId: row.documentId } : {}),
      ...(row.folderId ? { folderId: row.folderId } : {}),
      ...(row.noteDate ? { noteDate: row.noteDate } : {}),
    }));

  const blockHits = db
    .prepare(
      `SELECT
         ('block:' || b.document_id || ':' || b.block_id) AS id,
         'document-block' AS kind,
         b.title,
         b.preview,
         b.fallback_text AS fallbackText,
         b.space_id AS spaceId,
         b.document_id AS documentId,
         b.block_id AS blockId,
         d.folder_id AS folderId,
         bm25(workspace_block_search) AS rank
       FROM workspace_block_search
       JOIN workspace_block_search_entries b ON b.id = workspace_block_search.rowid
       JOIN documents d ON d.id = b.document_id AND d.deleted_at IS NULL
       WHERE workspace_block_search MATCH ?
         AND b.space_id = ?
       ORDER BY rank ASC
       LIMIT ?`
    )
    .all(matchQuery, spaceId, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      preview: row.preview,
      spaceId: row.spaceId,
      documentId: row.documentId,
      blockId: row.blockId,
      fallbackText: row.fallbackText,
      ...(row.folderId ? { folderId: row.folderId } : {}),
      rank: row.rank,
    }));

  return [...blockHits, ...documentAndQuickNoteHits]
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      if (left.kind !== right.kind) {
        return left.kind === 'document-block' ? -1 : 1;
      }

      return String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN');
    })
    .slice(0, limit)
    .map(({ rank: _rank, ...row }) => row);
}

function rebuildWorkspaceSearchIndex() {
  const db = getDatabase();
  const documents = db
    .prepare(
      `SELECT id, space_id AS spaceId, title, content_json AS contentJson
       FROM documents
       WHERE deleted_at IS NULL
       ORDER BY created_at`
    )
    .all();
  const quickNotes = db
    .prepare('SELECT id, space_id AS spaceId, note_date AS noteDate, title, content_json AS contentJson FROM quick_notes ORDER BY created_at')
    .all();

  const rebuild = db.transaction(() => {
    db.prepare('DELETE FROM workspace_search_entries').run();
    db.prepare('DELETE FROM workspace_block_search_entries').run();

    documents.forEach((document) => {
      upsertSearchEntry({ ...document, kind: 'document', documentId: document.id }, db);
    });

    quickNotes.forEach((quickNote) => {
      upsertSearchEntry({ ...quickNote, kind: 'quick-note' }, db);
    });
  });

  rebuild();
}

module.exports = {
  buildFtsMatchQuery,
  extractPlainTextFromContentJson,
  rebuildWorkspaceSearchIndex,
  buildDocumentBlockSearchEntries,
  removeDocumentBlockSearchEntries,
  removeSearchEntry,
  searchWorkspace,
  tokenizeSearchText,
  upsertDocumentBlockSearchEntries,
  upsertSearchEntry,
};
