const { initDatabase, closeDatabase } = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const foldersRepo = require('../electron/db/repositories/folders.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');
const searchRepo = require('../electron/db/repositories/search.cjs');

async function runSmoke() {
  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();

  const space = spacesRepo.createSpace({ name: 'Root Doc Space', label: 'WORKSPACE' });
  const folder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: null,
    name: 'Nested Folder',
  });

  const createdRootDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: null,
    title: 'Root Smoke Document',
  });
  searchRepo.upsertSearchEntry({
    id: createdRootDocument.id,
    kind: 'document',
    spaceId: createdRootDocument.spaceId,
    documentId: createdRootDocument.id,
    title: createdRootDocument.title,
    contentJson: createdRootDocument.contentJson,
  });

  const movedRootDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: folder.id,
    title: 'Move To Root Document',
  });

  const updatedMovedRootDocument = documentsRepo.moveDocument(movedRootDocument.id, null);
  searchRepo.upsertSearchEntry({
    id: updatedMovedRootDocument.id,
    kind: 'document',
    spaceId: updatedMovedRootDocument.spaceId,
    documentId: updatedMovedRootDocument.id,
    title: updatedMovedRootDocument.title,
    contentJson: updatedMovedRootDocument.contentJson,
  });

  closeDatabase();
  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();

  const reopenedCreatedRootDocument = documentsRepo.getDocumentById(createdRootDocument.id);
  const reopenedMovedRootDocument = documentsRepo.getDocumentById(movedRootDocument.id);
  const rootSearchHit = searchRepo.searchWorkspace({
    spaceId: space.id,
    query: 'Root Smoke',
  })[0] ?? null;

  closeDatabase();
  console.log(`__ROOT_SMOKE__${JSON.stringify({
    ok: true,
    spaceId: space.id,
    createdRootFolderId: reopenedCreatedRootDocument?.folderId ?? null,
    movedRootFolderId: reopenedMovedRootDocument?.folderId ?? null,
    rootSearchHit,
  })}`);
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron root document smoke failed:', error);
    process.exitCode = 1;
  });
