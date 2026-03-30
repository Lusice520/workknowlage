const fs = require('node:fs');
const path = require('node:path');
const {
  initDatabase,
  closeDatabase,
  getDbPath,
  getUserDataDir,
} = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const foldersRepo = require('../electron/db/repositories/folders.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');
const { rebuildBacklinksForSpace } = require('../electron/db/repositories/backlinks.cjs');
const quickNotesRepo = require('../electron/db/repositories/quickNotes.cjs');
const searchRepo = require('../electron/db/repositories/search.cjs');
const { createUploadStorage } = require('../electron/uploads/storage.cjs');
const {
  cleanupOrphanAttachments,
  createBackupSnapshot,
  restoreBackupSnapshot,
} = require('../electron/maintenance/dataTools.cjs');
const { version: appVersion } = require('../package.json');

async function runSmoke() {
  initDatabase();

  const userDataDir = getUserDataDir();
  const uploadStorage = createUploadStorage({ userDataDir });
  const space = spacesRepo.createSpace({ name: 'Smoke Space', label: 'WORKSPACE' });
  const folder = foldersRepo.createFolder({
    spaceId: space.id,
    parentId: null,
    name: 'Smoke Folder',
  });
  const document = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: folder.id,
    title: 'Smoke Document',
  });
  const mentionTargetDocument = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: folder.id,
    title: 'Smoke Mention Target',
  });
  const uploadedAsset = uploadStorage.storeAssets(document.id, [{
    name: 'restore-proof.txt',
    mimeType: 'text/plain',
    bytes: Uint8Array.from([87, 75, 1, 2, 3]),
  }])[0];
  const attachmentContentJson = JSON.stringify([
    {
      id: 'block-attachment',
      type: 'kbAttachment',
      props: {
        url: uploadedAsset.urlPath,
        name: uploadedAsset.name,
        isImage: false,
      },
      content: [],
      children: [],
    },
    {
      id: 'block-mention',
      type: 'paragraph',
      content: [
        { type: 'text', text: '这里回链到 ', styles: {} },
        {
          type: 'docMention',
          props: {
            documentId: mentionTargetDocument.id,
            title: mentionTargetDocument.title,
          },
        },
        { type: 'text', text: ' 以验证持久化。', styles: {} },
      ],
      children: [],
    },
  ]);

  documentsRepo.updateDocument(document.id, {
    title: 'Smoke Document Renamed',
    contentJson: attachmentContentJson,
  });
  rebuildBacklinksForSpace(space.id);

  const quickNote = quickNotesRepo.upsertQuickNote({
    spaceId: space.id,
    noteDate: '2026-03-26',
    title: '3月26日快记',
    contentJson: JSON.stringify([]),
  });
  const quickNoteAsset = uploadStorage.storeAssets(quickNote.id, [{
    name: 'quick-note-proof.png',
    mimeType: 'image/png',
    bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
  }])[0];
  const smokeQuickNoteContentJson = JSON.stringify([
    {
      id: 'quick-note-block',
      type: 'kbAttachment',
      props: {
        url: quickNoteAsset.urlPath,
        name: quickNoteAsset.name,
        isImage: true,
      },
      content: [],
      children: [],
    },
    {
      id: 'quick-note-text',
      type: 'paragraph',
      content: [{ type: 'text', text: '今天验证一下重启后持久化', styles: {} }],
      children: [],
    },
  ]);

  quickNotesRepo.upsertQuickNote({
    spaceId: space.id,
    noteDate: '2026-03-26',
    title: '3月26日快记',
    contentJson: smokeQuickNoteContentJson,
  });

  closeDatabase();

  const backupRootDir = path.join(userDataDir, 'smoke-backups');
  const backupResult = createBackupSnapshot({
    appVersion,
    userDataDir,
    dbPath: getDbPath(),
    destinationRootDir: backupRootDir,
  });

  initDatabase();
  documentsRepo.updateDocument(document.id, {
    title: 'Mutated After Backup',
    contentJson: JSON.stringify([]),
  });
  fs.rmSync(uploadedAsset.filePath, { force: true });
  closeDatabase();

  restoreBackupSnapshot({
    backupDir: backupResult.path,
    userDataDir,
    dbPath: getDbPath(),
  });

  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();

  const restoredSpace = spacesRepo.listSpaces().find((item) => item.id === space.id);
  const restoredFolder = foldersRepo.listFolders(space.id).find((item) => item.id === folder.id);
  const restoredDocument = documentsRepo.getDocumentById(document.id);
  const restoredMentionTarget = documentsRepo.getDocumentById(mentionTargetDocument.id);
  const restoredQuickNote = quickNotesRepo.getQuickNote(space.id, '2026-03-26');

  if (!restoredSpace || !restoredFolder || !restoredDocument || !restoredMentionTarget || !restoredQuickNote) {
    throw new Error('Smoke persistence verification failed');
  }

  const persistedBacklink = restoredMentionTarget.backlinks.find((backlink) => backlink.sourceDocumentId === document.id);
  const visibleAfterReopen = Boolean(persistedBacklink);

  const orphanDir = uploadStorage.getDocumentUploadDir('missing-document');
  fs.mkdirSync(orphanDir, { recursive: true });
  fs.writeFileSync(path.join(orphanDir, 'orphan.txt'), Buffer.from('orphan'));

  const cleanupResult = cleanupOrphanAttachments({
    uploadsRootDir: uploadStorage.uploadsRootDir,
  });
  const attachmentRestored = fs.existsSync(uploadedAsset.filePath);
  const quickNoteAttachmentRestored = fs.existsSync(quickNoteAsset.filePath);

  documentsRepo.trashDocument(document.id);
  rebuildBacklinksForSpace(space.id);
  const softDeletedVisible = Boolean(documentsRepo.getDocumentById(document.id));
  const hiddenAfterTrash = !documentsRepo.getDocumentById(mentionTargetDocument.id)?.backlinks.some(
    (backlink) => backlink.sourceDocumentId === document.id
  );
  const restoredVisible = documentsRepo.restoreDocumentTrashRoot(space.id, document.id)
    ? Boolean(documentsRepo.getDocumentById(document.id))
    : false;
  rebuildBacklinksForSpace(space.id);
  const visibleAfterRestore = Boolean(
    documentsRepo.getDocumentById(mentionTargetDocument.id)?.backlinks.some(
      (backlink) => backlink.sourceDocumentId === document.id
    )
  );
  documentsRepo.trashDocument(document.id);
  rebuildBacklinksForSpace(space.id);
  const purged = documentsRepo.deleteDocumentTrashRoot(space.id, document.id);
  rebuildBacklinksForSpace(space.id);
  if (purged) {
    uploadStorage.removeDocumentUploadDir(document.id);
  }
  const purgedRecoverable = purged
    ? documentsRepo.restoreDocumentTrashRoot(space.id, document.id)
    : false;
  const attachmentPurged = !fs.existsSync(uploadedAsset.filePath);
  const hiddenAfterPurge = !documentsRepo.getDocumentById(mentionTargetDocument.id)?.backlinks.some(
    (backlink) => backlink.sourceDocumentId === document.id
  );

  const smokeResult = {
    ok: true,
    dbPath: getDbPath(),
    backup: {
      created: backupResult.success,
      path: backupResult.path,
    },
    persisted: {
      spaceName: restoredSpace.name,
      folderName: restoredFolder.name,
      documentTitle: restoredDocument.title,
      quickNoteTitle: restoredQuickNote.title,
    },
    restored: {
      documentTitle: restoredDocument.title,
      attachmentRestored,
      quickNoteAttachmentRestored,
    },
    cleanup: {
      deletedFiles: cleanupResult.deletedFiles,
      deletedDirectories: cleanupResult.deletedDirectories,
    },
    trash: {
      softDeletedVisible,
      restoredVisible,
      purgedRecoverable,
      attachmentPurged,
    },
    backlinks: {
      visibleAfterReopen,
      hiddenAfterTrash,
      visibleAfterRestore,
      hiddenAfterPurge,
      sourceDocumentId: persistedBacklink?.sourceDocumentId ?? null,
      sourceBlockId: persistedBacklink?.sourceBlockId ?? null,
    },
  };

  closeDatabase();
  console.log(JSON.stringify(smokeResult));
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron persistence smoke failed:', error);
    process.exitCode = 1;
  });
