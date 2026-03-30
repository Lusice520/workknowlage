const { initDatabase, closeDatabase } = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const foldersRepo = require('../electron/db/repositories/folders.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');

async function runSmoke() {
  initDatabase();

  const space = spacesRepo.createSpace({ name: 'Tree Move Space', label: 'WORKSPACE' });
  const sourceFolder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: null,
    name: 'Source Folder',
  });
  const targetFolder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: null,
    name: 'Target Folder',
  });
  const childFolder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: sourceFolder.id,
    name: 'Child Folder',
  });
  const invalidChildFolder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: sourceFolder.id,
    name: 'Invalid Child Folder',
  });
  const document = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: sourceFolder.id,
    title: 'Move Me',
  });
  const parentDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: targetFolder.id,
    title: 'Parent Doc',
  });

  const movedDocument = documentsRepo.moveDocument(document.id, targetFolder.id);
  const nestedDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: parentDocument.id,
    title: 'Nested Doc',
  });
  const nestedFolder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: parentDocument.id,
    name: 'Nested Folder',
  });
  const movedIntoDocument = documentsRepo.moveDocument(movedDocument.id, parentDocument.id);
  foldersRepo.moveFolder(childFolder.id, parentDocument.id);
  const movedFolderIntoDocument = foldersRepo.listFolders(space.id).find((folder) => folder.id === childFolder.id);

  let invalidMoveError = '';
  try {
    foldersRepo.moveFolder(sourceFolder.id, invalidChildFolder.id);
  } catch (error) {
    invalidMoveError = error instanceof Error ? error.message : String(error);
  }

  closeDatabase();
  console.log(JSON.stringify({
    ok: true,
    targetFolderId: targetFolder.id,
    movedDocumentFolderId: movedDocument.folderId,
    parentDocumentId: parentDocument.id,
    nestedDocumentFolderId: nestedDocument.folderId,
    nestedFolderParentId: nestedFolder.parentId,
    movedIntoDocumentFolderId: movedIntoDocument.folderId,
    movedFolderIntoDocumentParentId: movedFolderIntoDocument.parentId,
    invalidMoveError,
  }));
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron tree move smoke failed:', error);
    process.exitCode = 1;
  });
