const { initDatabase, closeDatabase, getDbPath } = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const foldersRepo = require('../electron/db/repositories/folders.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');
const quickNotesRepo = require('../electron/db/repositories/quickNotes.cjs');
const searchRepo = require('../electron/db/repositories/search.cjs');
const spreadsheetsRepo = require('../electron/db/repositories/spreadsheets.cjs');

const smokeContentJson = JSON.stringify([
  {
    id: 'search-heading',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: '搜索验证标题', styles: {} }],
    children: [],
  },
  {
    id: 'search-paragraph',
    type: 'paragraph',
    content: [{ type: 'text', text: '全文检索需要命中标题和正文内容。', styles: {} }],
    children: [],
  },
]);

const smokeQuickNoteContentJson = JSON.stringify([
  {
    id: 'quick-note-search',
    type: 'paragraph',
    content: [{ type: 'text', text: '今天快速记录 FTS5 检索验证。', styles: {} }],
    children: [],
  },
]);

async function runSmoke() {
  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();

  const seedHit = searchRepo.searchWorkspace({
    spaceId: 'personal-workspace',
    query: '毫秒级 全局模糊搜索',
  })[0];

  const space = spacesRepo.createSpace({ name: 'Smoke Search Space', label: 'WORKSPACE' });
  const folder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: null,
    name: 'Search Folder',
  });
  const document = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: folder.id,
    title: 'Smoke Search Document',
  });

  const updatedDocument = documentsRepo.updateDocument(document.id, {
    title: 'Smoke Document Renamed',
    contentJson: smokeContentJson,
  });
  searchRepo.upsertSearchEntry({
    id: updatedDocument.id,
    kind: 'document',
    spaceId: updatedDocument.spaceId,
    documentId: updatedDocument.id,
    documentKind: updatedDocument.kind,
    title: updatedDocument.title,
    contentJson: updatedDocument.contentJson,
  });

  const spreadsheetDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: folder.id,
    title: 'Smoke Budget 预算表',
    kind: 'spreadsheet',
  });
  spreadsheetsRepo.updateSpreadsheetWorkbook(spreadsheetDocument.id, JSON.stringify({
    id: 'smoke-budget-workbook',
    name: 'Smoke Budget 预算表',
    appVersion: '0.23.0',
    locale: 'zhCN',
    styles: {},
    sheetOrder: ['sheet-1'],
    sheets: {
      'sheet-1': {
        id: 'sheet-1',
        name: 'Sheet1',
        rowCount: 100,
        columnCount: 26,
        cellData: {
          0: {
            0: {
              v: 'Hidden Cell Token',
            },
          },
        },
      },
    },
  }));
  searchRepo.upsertSearchEntry({
    id: spreadsheetDocument.id,
    kind: 'document',
    spaceId: spreadsheetDocument.spaceId,
    documentId: spreadsheetDocument.id,
    documentKind: spreadsheetDocument.kind,
    title: spreadsheetDocument.title,
    contentJson: spreadsheetDocument.contentJson,
  });

  const savedQuickNote = quickNotesRepo.upsertQuickNote({
    spaceId: space.id,
    noteDate: '2026-03-26',
    title: '3月26日快记',
    contentJson: smokeQuickNoteContentJson,
  });
  searchRepo.upsertSearchEntry({
    id: savedQuickNote.id,
    kind: 'quick-note',
    spaceId: savedQuickNote.spaceId,
    noteDate: savedQuickNote.noteDate,
    title: savedQuickNote.title,
    contentJson: savedQuickNote.contentJson,
  });

  const firstPassHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '搜索验证',
  });
  const blockHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '验证标题',
  });
  const noteHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '快速记录',
  });
  const spreadsheetTitleHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '预算表',
  });
  const spreadsheetCellHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: 'Hidden Cell Token',
  });

  closeDatabase();
  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();

  const persistedHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '检索',
  });
  const persistedSpreadsheetTitleHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: '预算表',
  });
  const persistedSpreadsheetCellHits = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: 'Hidden Cell Token',
  });

  const smokeResult = {
    ok: true,
    dbPath: getDbPath(),
    spaceId: space.id,
    seedHit,
    firstPassHits,
    blockHits,
    noteHits,
    spreadsheetTitleHits,
    spreadsheetCellHits,
    persistedHits,
    persistedSpreadsheetTitleHits,
    persistedSpreadsheetCellHits,
  };

  closeDatabase();
  console.log(JSON.stringify(smokeResult));
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron search smoke failed:', error);
    process.exitCode = 1;
  });
