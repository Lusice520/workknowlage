const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { initDatabase, closeDatabase, getDbPath, getUserDataDir } = require('./db/index.cjs');
const spacesRepo = require('./db/repositories/spaces.cjs');
const foldersRepo = require('./db/repositories/folders.cjs');
const documentsRepo = require('./db/repositories/documents.cjs');
const treeOrderRepo = require('./db/repositories/treeOrder.cjs');
const spreadsheetsRepo = require('./db/repositories/spreadsheets.cjs');
const quickNotesRepo = require('./db/repositories/quickNotes.cjs');
const searchRepo = require('./db/repositories/search.cjs');
const tagsRepo = require('./db/repositories/tags.cjs');
const { rebuildBacklinksForSpace } = require('./db/repositories/backlinks.cjs');
const { createUploadStorage } = require('./uploads/storage.cjs');
const { saveTextFile, saveBinaryFile, sanitizeExportFileName } = require('./export/files.cjs');
const { savePdfFromHtml } = require('./export/pdf.cjs');
const {
  cleanupOrphanAttachments,
  createBackupSnapshot,
  inspectDocumentContentHealth,
  restoreBackupSnapshot,
} = require('./maintenance/dataTools.cjs');
const {
  createPublicShare,
  createShare,
  disablePublicShare,
  disableShare,
  disableSharesForSpace,
  getShareByDocumentId,
  listSharesForSpace,
  regenerateShare,
} = require('./share/repository.cjs');
const { startShareServer } = require('./share/server.cjs');
const { getPublicShareExpiryDelay, startCloudflareTunnel } = require('./share/cloudflareTunnel.cjs');
const {
  findExternalMarkdownFilePaths,
  importExternalMarkdownFile,
  isExternalMarkdownFilePath,
  readExternalMarkdownFile,
  saveExternalMarkdownFile,
} = require('./externalFiles.cjs');

let shareServerRuntime = null;
const publicShareTunnelRuntimes = new Map();
let uploadStorage = null;
let externalFileHandlingReady = false;
const pendingExternalMarkdownFilePaths = [];
const externalFileWindowsByPath = new Map();
const externalFilePathsByWebContentsId = new Map();

function reopenDatabase() {
  closeDatabase();
  initDatabase();
}

function upsertDocumentSearchEntry(document) {
  if (!document) {
    return;
  }

  searchRepo.upsertSearchEntry({
    id: document.id,
    kind: 'document',
    spaceId: document.spaceId,
    documentId: document.id,
    documentKind: document.kind,
    title: document.title,
    contentJson: document.contentJson,
  });
}

function rebuildBacklinksForAllSpaces() {
  spacesRepo.listSpaces().forEach((space) => {
    rebuildBacklinksForSpace(space.id);
  });
}

function syncSearchAndBacklinksForSpace(spaceId, options = {}) {
  if (!spaceId) {
    return;
  }

  const { rebuildSearch = false, removedDocumentId = null, upsertDocument = null } = options;

  if (rebuildSearch) {
    searchRepo.rebuildWorkspaceSearchIndex();
  } else {
    if (removedDocumentId) {
      removeDocumentSearchEntry(removedDocumentId);
    }
    if (upsertDocument) {
      upsertDocumentSearchEntry(upsertDocument);
    }
  }

  rebuildBacklinksForSpace(spaceId);
}

function syncAfterCrossSpaceMove(sourceSpaceId, targetSpaceId) {
  searchRepo.rebuildWorkspaceSearchIndex();

  const spaceIds = [...new Set([sourceSpaceId, targetSpaceId].filter(Boolean))];
  spaceIds.forEach((spaceId) => rebuildBacklinksForSpace(spaceId));
}

function removeDocumentSearchEntry(documentId) {
  if (!documentId) {
    return;
  }

  searchRepo.removeSearchEntry(documentId);
  searchRepo.removeDocumentBlockSearchEntries(documentId);
}

function removeUploadsForDocumentIds(documentIds) {
  if (!uploadStorage || !Array.isArray(documentIds)) {
    return;
  }

  documentIds.forEach((documentId) => {
    if (!documentId) {
      return;
    }

    if (typeof uploadStorage.removeDocumentUploadDir === 'function') {
      uploadStorage.removeDocumentUploadDir(documentId);
      return;
    }

    fs.rmSync(uploadStorage.getDocumentUploadDir(documentId), { recursive: true, force: true });
  });
}

function listWorkspaceTrash(spaceId) {
  const folderItems = foldersRepo.listTrashedFolderRoots(spaceId).map((folder) => ({
    id: folder.id,
    trashRootId: folder.trashRootId ?? folder.id,
    kind: 'folder',
    spaceId: folder.spaceId,
    title: folder.name,
    deletedAt: folder.deletedAt ?? '',
    ...foldersRepo.getFolderPackageStats(spaceId, folder.id),
  }));
  const documentItems = documentsRepo.listTrashedDocumentRoots(spaceId).map((document) => ({
    id: document.id,
    trashRootId: document.trashRootId ?? document.id,
    kind: 'document',
    spaceId: document.spaceId,
    title: document.title,
    deletedAt: document.deletedAt ?? '',
    folderId: document.folderId,
  }));

  return [...folderItems, ...documentItems].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

function restoreTrashItem(spaceId, trashRootId) {
  const restoredFolder = foldersRepo.restoreFolderTrashRoot(spaceId, trashRootId);
  if (restoredFolder) {
    syncSearchAndBacklinksForSpace(spaceId, { rebuildSearch: true });
    return true;
  }

  const restoredDocument = documentsRepo.restoreDocumentTrashRoot(spaceId, trashRootId);
  if (restoredDocument) {
    syncSearchAndBacklinksForSpace(spaceId, { rebuildSearch: true });
    return true;
  }

  return false;
}

function deleteTrashItem(spaceId, trashRootId) {
  const documentIds = documentsRepo.listDocumentIdsForTrashRoot(spaceId, trashRootId);
  const deletedFolder = foldersRepo.deleteFolderTrashRoot(spaceId, trashRootId);
  if (deletedFolder) {
    removeUploadsForDocumentIds(documentIds);
    syncSearchAndBacklinksForSpace(spaceId, { rebuildSearch: true });
    return true;
  }

  const deletedDocument = documentsRepo.deleteDocumentTrashRoot(spaceId, trashRootId);
  if (deletedDocument) {
    removeUploadsForDocumentIds(documentIds);
    syncSearchAndBacklinksForSpace(spaceId, { rebuildSearch: true });
    return true;
  }

  return false;
}

function getLocalShareUrl(share) {
  if (!share || !shareServerRuntime) {
    return '';
  }

  return shareServerRuntime.getPublicUrl(share.token);
}

function getTunnelPublicShareUrl(share) {
  const runtime = share?.documentId ? publicShareTunnelRuntimes.get(share.documentId) : null;
  if (!runtime?.publicUrl || !share?.publicToken) {
    return '';
  }

  return `${runtime.publicUrl}/public/share/${share.publicToken}`;
}

async function handleUnexpectedPublicShareTunnelExit(documentId, detail = {}) {
  const runtime = publicShareTunnelRuntimes.get(documentId);
  if (runtime?.expiresTimer) {
    clearTimeout(runtime.expiresTimer);
  }
  publicShareTunnelRuntimes.delete(documentId);
  try {
    disablePublicShare(documentId);
  } catch (error) {
    console.error('[Share] Failed to disable public share after tunnel exit:', error, detail);
  }
}

function attachLocalShareUrl(share) {
  if (!share || !shareServerRuntime) {
    return share;
  }

  const localUrl = getLocalShareUrl(share);
  return {
    ...share,
    localUrl,
    publicUrl: localUrl,
  };
}

function attachShareUrls(share) {
  if (!share || !shareServerRuntime) {
    return share;
  }

  const localUrl = getLocalShareUrl(share);
  const publicUrl = getTunnelPublicShareUrl(share) || localUrl;
  return {
    ...share,
    localUrl,
    publicUrl,
  };
}

function attachWorkspaceShareUrls(share) {
  if (!share || !shareServerRuntime) {
    return share;
  }

  return {
    ...share,
    localUrl: share.enabled ? getLocalShareUrl(share) : '',
    publicUrl: share.publicEnabled ? getTunnelPublicShareUrl(share) : '',
  };
}

async function closePublicShareTunnel(documentId) {
  const runtime = publicShareTunnelRuntimes.get(documentId);
  publicShareTunnelRuntimes.delete(documentId);
  if (runtime?.expiresTimer) {
    clearTimeout(runtime.expiresTimer);
  }
  if (runtime?.close) {
    await runtime.close();
  }
}

function schedulePublicShareExpiry(documentId, expiresAt) {
  const delay = getPublicShareExpiryDelay(expiresAt);
  if (delay === null) {
    return null;
  }

  return setTimeout(() => {
    disableTemporaryPublicShare(documentId).catch((error) => {
      console.error('[Share] Failed to auto-close expired public share:', error);
    });
  }, delay);
}

async function createTemporaryPublicShare(documentId, options = {}) {
  if (!shareServerRuntime) {
    throw new Error('Local share server is not ready');
  }

  const share = createPublicShare(documentId, options);
  try {
    await closePublicShareTunnel(documentId);
    const tunnelRuntime = await startCloudflareTunnel({
      localUrl: `http://127.0.0.1:${shareServerRuntime.port}`,
      onUnexpectedExit: (detail) => {
        void handleUnexpectedPublicShareTunnelExit(documentId, detail);
      },
    });
    publicShareTunnelRuntimes.set(documentId, {
      ...tunnelRuntime,
      expiresTimer: schedulePublicShareExpiry(documentId, share.publicExpiresAt),
    });
    return attachShareUrls(share);
  } catch (error) {
    disablePublicShare(documentId);
    throw error;
  }
}

async function disableTemporaryPublicShare(documentId) {
  await closePublicShareTunnel(documentId);
  return attachShareUrls(disablePublicShare(documentId));
}

async function disableWorkspaceShares(spaceId) {
  const shares = listSharesForSpace(spaceId);
  await Promise.all(shares.map((share) => closePublicShareTunnel(share.documentId)));
  return disableSharesForSpace(spaceId);
}

async function resolveExportPayloadPath({
  dialogApi,
  browserWindow,
  payload,
  title,
  defaultExtension,
  filters,
}) {
  const explicitPath = String(payload?.outputPath || payload?.savePath || '').trim();
  if (explicitPath) {
    return explicitPath;
  }

  const explicitDefaultPath = String(payload?.defaultPath || payload?.fileName || '').trim();
  const defaultName = sanitizeExportFileName(payload?.title || title || 'WorkKnowlage Export');
  const resolvedDefaultPath = explicitDefaultPath || `${defaultName}.${defaultExtension}`;
  const result = await dialogApi.showSaveDialog(browserWindow ?? undefined, {
    title,
    defaultPath: resolvedDefaultPath,
    filters,
  });

  return result?.canceled ? '' : String(result?.filePath || '').trim();
}

function toExportActionResult(result, successMessage) {
  if (!result || result.canceled || !result.path) {
    return {
      success: false,
      message: '已取消导出',
    };
  }

  return {
    success: true,
    message: successMessage,
    path: result.path,
  };
}

function getBinaryExportDialogMeta(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  if (normalized.endsWith('.docx')) {
    return {
      title: '导出 Word',
      filters: [{ name: 'Word', extensions: ['docx'] }],
    };
  }
  if (normalized.endsWith('.xlsx')) {
    return {
      title: '导出 Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    };
  }

  return {
    title: '导出文件',
    filters: [{ name: 'Binary', extensions: ['bin'] }],
  };
}

function registerExportIpcHandlers({
  ipc = ipcMain,
  dialogApi = dialog,
  browserWindow = null,
} = {}) {
  ipc.handle('exports:saveText', async (event, payload = {}) => {
    const eventWindow = event?.sender ? BrowserWindow.fromWebContents(event.sender) ?? browserWindow : browserWindow;
    const savePath = await resolveExportPayloadPath({
      dialogApi,
      browserWindow: eventWindow,
      payload,
      title: '导出 Markdown',
      defaultExtension: 'md',
      filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }],
    });

    if (!savePath) {
      return { success: false, message: '已取消导出' };
    }

    const result = await saveTextFile({
      outputPath: savePath,
      content: payload.content ?? payload.text ?? '',
      encoding: payload.encoding || 'utf8',
    });

    return toExportActionResult(result, 'Markdown 已导出');
  });

  ipc.handle('exports:saveBinary', async (event, payload = {}) => {
    const eventWindow = event?.sender ? BrowserWindow.fromWebContents(event.sender) ?? browserWindow : browserWindow;
    const dialogMeta = getBinaryExportDialogMeta(payload.fileName);
    const savePath = await resolveExportPayloadPath({
      dialogApi,
      browserWindow: eventWindow,
      payload,
      title: dialogMeta.title,
      defaultExtension: 'bin',
      filters: dialogMeta.filters,
    });

    if (!savePath) {
      return { success: false, message: '已取消导出' };
    }

    const result = await saveBinaryFile({
      outputPath: savePath,
      bytes: payload.bytes ?? payload.data ?? [],
    });

    const successMessage = dialogMeta.title === '导出 Word'
      ? 'Word 已导出'
      : dialogMeta.title === '导出 Excel'
        ? 'Excel 已导出'
        : '文件已导出';

    return toExportActionResult(result, successMessage);
  });

  ipc.handle('exports:savePdfFromHtml', async (event, payload = {}) => {
    const eventWindow = event?.sender ? BrowserWindow.fromWebContents(event.sender) ?? browserWindow : browserWindow;
    const savePath = await resolveExportPayloadPath({
      dialogApi,
      browserWindow: eventWindow,
      payload,
      title: '导出 PDF',
      defaultExtension: 'pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (!savePath) {
      return { success: false, message: '已取消导出' };
    }

    const result = await savePdfFromHtml({
      html: payload.html ?? payload.content ?? '',
      outputPath: savePath,
      title: payload.title || 'WorkKnowlage Export',
      windowFactory: payload.windowFactory,
    });

    return toExportActionResult(result, 'PDF 已导出');
  });
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#eef3f9',
    title: 'WorkKnowlage',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    return;
  }

  void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};

function normalizeExternalMarkdownFilePath(filePath) {
  if (!isExternalMarkdownFilePath(filePath)) {
    return '';
  }

  return path.resolve(String(filePath).trim());
}

function loadRendererRoute(window, routeSearchParams = '') {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    const routeUrl = new URL(devServerUrl);
    routeUrl.search = routeSearchParams;
    void window.loadURL(routeUrl.toString());
    return;
  }

  void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    search: routeSearchParams,
  });
}

function createExternalMarkdownFileWindow(filePath) {
  const normalizedFilePath = normalizeExternalMarkdownFilePath(filePath);
  if (!normalizedFilePath) {
    return null;
  }

  const existingWindow = externalFileWindowsByPath.get(normalizedFilePath);
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus();
    return existingWindow;
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    backgroundColor: '#f7f9fc',
    title: `${path.basename(normalizedFilePath)} - WorkKnowlage`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  externalFileWindowsByPath.set(normalizedFilePath, window);
  externalFilePathsByWebContentsId.set(window.webContents.id, normalizedFilePath);
  window.on('closed', () => {
    externalFileWindowsByPath.delete(normalizedFilePath);
    externalFilePathsByWebContentsId.delete(window.webContents.id);
  });

  loadRendererRoute(window, 'view=external-file');
  return window;
}

function openExternalMarkdownFile(filePath) {
  const normalizedFilePath = normalizeExternalMarkdownFilePath(filePath);
  if (!normalizedFilePath) {
    return null;
  }

  if (!externalFileHandlingReady) {
    pendingExternalMarkdownFilePaths.push(normalizedFilePath);
    return null;
  }

  return createExternalMarkdownFileWindow(normalizedFilePath);
}

function openExternalMarkdownFiles(filePaths = []) {
  return filePaths
    .map((filePath) => openExternalMarkdownFile(filePath))
    .filter(Boolean);
}

function flushPendingExternalMarkdownFilePaths() {
  const filePaths = pendingExternalMarkdownFilePaths.splice(0, pendingExternalMarkdownFilePaths.length);
  openExternalMarkdownFiles(filePaths);
}

function drainStartupExternalMarkdownFilePaths(argv = process.argv) {
  const filePaths = [
    ...pendingExternalMarkdownFilePaths.splice(0, pendingExternalMarkdownFilePaths.length),
    ...findExternalMarkdownFilePaths(argv),
  ]
    .map((filePath) => normalizeExternalMarkdownFilePath(filePath))
    .filter(Boolean);

  return [...new Set(filePaths)];
}

function getExternalMarkdownFilePathForEvent(event) {
  const filePath = externalFilePathsByWebContentsId.get(event.sender.id);
  if (!filePath) {
    throw new Error('当前窗口没有绑定外部 Markdown 文件。');
  }

  return filePath;
}

function registerIpcHandlers() {
  registerExportIpcHandlers();

  ipcMain.handle('meta:getStorageInfo', () => ({
    storagePath: getDbPath(),
    scopeLabel: '空间、文件夹、文档、快记',
  }));

  // ─── Spaces ───────────────────────────────────────────
  ipcMain.handle('spaces:list', () => spacesRepo.listSpaces());
  ipcMain.handle('spaces:create', (_event, data) => spacesRepo.createSpace(data));
  ipcMain.handle('spaces:update', (_event, id, data) => spacesRepo.updateSpace(id, data));
  ipcMain.handle('spaces:delete', (_event, id) => {
    const result = spacesRepo.deleteSpace(id);
    searchRepo.rebuildWorkspaceSearchIndex();
    rebuildBacklinksForAllSpaces();
    return result;
  });

  // ─── Folders ──────────────────────────────────────────
  ipcMain.handle('folders:list', (_event, spaceId) => foldersRepo.listFolders(spaceId));
  ipcMain.handle('folders:create', (_event, data) => foldersRepo.createFolder(data));
  ipcMain.handle('folders:rename', (_event, id, name) => foldersRepo.renameFolder(id, name));
  ipcMain.handle('folders:move', (_event, id, newParentId) => foldersRepo.moveFolder(id, newParentId));
  ipcMain.handle('folders:moveToSpace', (_event, id, targetSpaceId) => {
    const result = foldersRepo.moveFolderToSpace(id, targetSpaceId);
    syncAfterCrossSpaceMove(result?.sourceSpaceId, result?.targetSpaceId);
    return result;
  });
  ipcMain.handle('folders:trash', (_event, id) => {
    const folder = foldersRepo.trashFolder(id);
    if (folder?.spaceId) {
      syncSearchAndBacklinksForSpace(folder.spaceId, { rebuildSearch: true });
    }
    return folder;
  });
  ipcMain.handle('folders:delete', (_event, id) => {
    const result = foldersRepo.deleteFolder(id);
    searchRepo.rebuildWorkspaceSearchIndex();
    rebuildBacklinksForAllSpaces();
    return result;
  });

  // ─── Documents ────────────────────────────────────────
  ipcMain.handle('documents:list', (_event, spaceId, folderId) => documentsRepo.listDocuments(spaceId, folderId));
  ipcMain.handle('documents:getById', (_event, id) => documentsRepo.getDocumentById(id));
  ipcMain.handle('documents:create', (_event, data) => {
    const document = documentsRepo.createDocument(data);
    syncSearchAndBacklinksForSpace(document.spaceId, { upsertDocument: document });
    return document;
  });
  ipcMain.handle('documents:update', (_event, id, data) => {
    const document = documentsRepo.updateDocument(id, data);
    syncSearchAndBacklinksForSpace(document?.spaceId, { upsertDocument: document });
    return document;
  });
  ipcMain.handle('documents:move', (_event, id, targetFolderId) => {
    const document = documentsRepo.moveDocument(id, targetFolderId);
    syncSearchAndBacklinksForSpace(document?.spaceId, { upsertDocument: document });
    return document;
  });
  ipcMain.handle('documents:moveToSpace', (_event, id, targetSpaceId) => {
    const result = documentsRepo.moveDocumentToSpace(id, targetSpaceId);
    syncAfterCrossSpaceMove(result?.sourceSpaceId, result?.targetSpaceId);
    return result?.document ?? null;
  });
  ipcMain.handle('documents:trash', (_event, id) => {
    const document = documentsRepo.trashDocument(id);
    if (document) {
      syncSearchAndBacklinksForSpace(document.spaceId, { rebuildSearch: true });
    }
    return document;
  });
  ipcMain.handle('documents:delete', (_event, id) => {
    const document = documentsRepo.getDocumentById(id, { includeDeleted: true });
    const result = documentsRepo.deleteDocument(id);
    if (document?.spaceId) {
      syncSearchAndBacklinksForSpace(document.spaceId, { rebuildSearch: true });
    }
    return result;
  });

  // ─── Spreadsheets ────────────────────────────────────
  ipcMain.handle('spreadsheets:get', (_event, documentId) =>
    spreadsheetsRepo.getSpreadsheetWorkbook(documentId)
  );
  ipcMain.handle('spreadsheets:update', (_event, documentId, workbookJson) =>
    spreadsheetsRepo.updateSpreadsheetWorkbook(documentId, workbookJson)
  );

  // ─── Quick notes ──────────────────────────────────────
  ipcMain.handle('quickNotes:get', (_event, noteDateOrSpaceId, maybeNoteDate) =>
    quickNotesRepo.getQuickNote(maybeNoteDate ?? noteDateOrSpaceId)
  );
  ipcMain.handle('quickNotes:upsert', (_event, data) => {
    const quickNote = quickNotesRepo.upsertQuickNote(data);
    if (quickNote) {
      searchRepo.upsertSearchEntry({
        id: quickNote.id,
        kind: 'quick-note',
        spaceId: quickNote.spaceId ?? '__global-quick-notes__',
        noteDate: quickNote.noteDate,
        title: quickNote.title,
        contentJson: quickNote.contentJson,
      });
    }
    return quickNote;
  });
  ipcMain.handle('quickNotes:listMonth', (_event, monthKeyOrSpaceId, maybeMonthKey) =>
    quickNotesRepo.listMonthQuickNotes(maybeMonthKey ?? monthKeyOrSpaceId)
  );
  ipcMain.handle('quickNotes:assets:upload', (_event, noteId, assets) => {
    if (!shareServerRuntime || !uploadStorage) {
      throw new Error('Local share server is not ready');
    }

    return uploadStorage.storeAssets(noteId, assets).map((asset) => ({
      documentId: asset.documentId,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      fileName: asset.fileName,
      url: shareServerRuntime.getUploadUrl(asset.documentId, asset.fileName),
    }));
  });

  // ─── Search ───────────────────────────────────────────
  ipcMain.handle('search:query', (_event, data) => searchRepo.searchWorkspace(data));
  ipcMain.handle('search:rebuild', () => {
    searchRepo.rebuildWorkspaceSearchIndex();
    rebuildBacklinksForAllSpaces();
    return true;
  });

  // ─── Workspace snapshot ───────────────────────────────
  ipcMain.handle('workspace:getSnapshot', (_event, spaceId) => ({
    folders: foldersRepo.listFolders(spaceId),
    documents: documentsRepo.listDocumentsForSpace(spaceId),
  }));
  ipcMain.handle('workspace:reorderTreeNode', (_event, input) => {
    treeOrderRepo.reorderTreeNode(input);
  });
  ipcMain.handle('workspace:getTrash', (_event, spaceId) => listWorkspaceTrash(spaceId));
  ipcMain.handle('workspace:restoreTrashItem', (_event, spaceId, trashRootId) => restoreTrashItem(spaceId, trashRootId));
  ipcMain.handle('workspace:deleteTrashItem', (_event, spaceId, trashRootId) => deleteTrashItem(spaceId, trashRootId));
  ipcMain.handle('workspace:emptyTrash', (_event, spaceId) => {
    const trashItems = listWorkspaceTrash(spaceId);
    const deletedRoots = trashItems.reduce((deletedRoots, item) => (
      deleteTrashItem(spaceId, item.trashRootId) ? deletedRoots + 1 : deletedRoots
    ), 0);
    syncSearchAndBacklinksForSpace(spaceId, { rebuildSearch: true });
    return deletedRoots;
  });

  ipcMain.handle('maintenance:openDataDirectory', async () => {
    const dataDir = getUserDataDir();
    const openError = await shell.openPath(dataDir);

    return openError
      ? { success: false, message: `打开数据目录失败：${openError}`, path: dataDir }
      : { success: true, message: '已打开数据目录', path: dataDir };
  });

  ipcMain.handle('maintenance:createBackup', async () => {
    const selection = await dialog.showOpenDialog({
      title: '选择备份保存目录',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (selection.canceled || !selection.filePaths[0]) {
      return { success: false, message: '已取消创建备份' };
    }

    reopenDatabase();
    closeDatabase();

    try {
      const result = createBackupSnapshot({
        appVersion: app.getVersion(),
        userDataDir: getUserDataDir(),
        dbPath: getDbPath(),
        destinationRootDir: selection.filePaths[0],
      });

      return result;
    } finally {
      initDatabase();
    }
  });

  ipcMain.handle('maintenance:restoreBackup', async () => {
    const selection = await dialog.showOpenDialog({
      title: '选择要恢复的备份目录',
      properties: ['openDirectory'],
    });

    if (selection.canceled || !selection.filePaths[0]) {
      return { success: false, message: '已取消恢复备份' };
    }

    closeDatabase();

    try {
      const result = restoreBackupSnapshot({
        backupDir: selection.filePaths[0],
        userDataDir: getUserDataDir(),
        dbPath: getDbPath(),
      });

      initDatabase();
      searchRepo.rebuildWorkspaceSearchIndex();
      rebuildBacklinksForAllSpaces();
      return result;
    } catch (error) {
      initDatabase();
      rebuildBacklinksForAllSpaces();
      throw error;
    }
  });

  ipcMain.handle('maintenance:rebuildSearchIndex', () => {
    searchRepo.rebuildWorkspaceSearchIndex();
    rebuildBacklinksForAllSpaces();
    return {
      success: true,
      message: '搜索索引已重建',
    };
  });

  ipcMain.handle('maintenance:cleanupOrphanAttachments', () =>
    cleanupOrphanAttachments({
      uploadsRootDir: uploadStorage?.uploadsRootDir ?? path.join(getUserDataDir(), 'uploads'),
    })
  );
  ipcMain.handle('maintenance:inspectDocumentContentHealth', () => inspectDocumentContentHealth());

  // ─── Local assets ─────────────────────────────────────
  ipcMain.handle('assets:upload', (_event, documentId, assets) => {
    if (!shareServerRuntime || !uploadStorage) {
      throw new Error('Local share server is not ready');
    }

    return uploadStorage.storeAssets(documentId, assets).map((asset) => ({
      documentId: asset.documentId,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      fileName: asset.fileName,
      url: shareServerRuntime.getUploadUrl(asset.documentId, asset.fileName),
    }));
  });

  // ─── Local shares ─────────────────────────────────────
  ipcMain.handle('shares:get', (_event, documentId) => attachShareUrls(getShareByDocumentId(documentId)));
  ipcMain.handle('shares:create', (_event, documentId) => attachLocalShareUrl(createShare(documentId)));
  ipcMain.handle('shares:regenerate', (_event, documentId) => attachLocalShareUrl(regenerateShare(documentId)));
  ipcMain.handle('shares:disable', (_event, documentId) => attachShareUrls(disableShare(documentId)));
  ipcMain.handle('shares:createPublic', (_event, documentId, options) => createTemporaryPublicShare(documentId, options));
  ipcMain.handle('shares:disablePublic', (_event, documentId) => disableTemporaryPublicShare(documentId));
  ipcMain.handle('shares:listForSpace', (_event, spaceId) =>
    listSharesForSpace(spaceId).map((share) => attachWorkspaceShareUrls(share))
  );
  ipcMain.handle('shares:disableAllForSpace', (_event, spaceId) => disableWorkspaceShares(spaceId));
  ipcMain.handle('shares:getPublicUrl', (_event, token) =>
    shareServerRuntime ? shareServerRuntime.getPublicUrl(token) : ''
  );

  // ─── External Markdown files ─────────────────────────
  ipcMain.handle('externalFiles:getInitial', (event) =>
    readExternalMarkdownFile(getExternalMarkdownFilePathForEvent(event))
  );
  ipcMain.handle('externalFiles:saveMarkdown', (event, markdown) =>
    saveExternalMarkdownFile(getExternalMarkdownFilePathForEvent(event), markdown)
  );
  ipcMain.handle('externalFiles:revealInFinder', (event) => {
    shell.showItemInFolder(getExternalMarkdownFilePathForEvent(event));
    return true;
  });
  ipcMain.handle('externalFiles:importToWorkspace', (event, payload) =>
    importExternalMarkdownFile({
      title: payload?.title || path.basename(getExternalMarkdownFilePathForEvent(event)),
      contentJson: payload?.contentJson ?? '[]',
    }, {
      spacesRepo,
      documentsRepo,
      syncSearchAndBacklinksForSpace,
    })
  );

  // ─── Tags ─────────────────────────────────────────────
  ipcMain.handle('tags:listForDocument', (_event, docId) => tagsRepo.listTagsForDocument(docId));
  ipcMain.handle('tags:addToDocument', (_event, docId, data) => tagsRepo.addTagToDocument(docId, data));
  ipcMain.handle('tags:removeFromDocument', (_event, docId, tagId) => tagsRepo.removeTagFromDocument(docId, tagId));
}

async function bootstrap() {
  initDatabase();
  searchRepo.rebuildWorkspaceSearchIndex();
  rebuildBacklinksForAllSpaces();

  const userDataDir = app.getPath('userData');
  uploadStorage = createUploadStorage({ userDataDir });
  const shareRepository = require('./share/repository.cjs');
  shareServerRuntime = await startShareServer({
    documentsRepo,
    shareRepository,
    spreadsheetsRepo,
    uploadStorage,
    userDataDir,
  });

  registerIpcHandlers();
  externalFileHandlingReady = true;
  const startupExternalFilePaths = drainStartupExternalMarkdownFilePaths(process.argv);
  if (startupExternalFilePaths.length > 0) {
    openExternalMarkdownFiles(startupExternalFilePaths);
  } else {
    createWindow();
    flushPendingExternalMarkdownFilePaths();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

if (app && typeof app.whenReady === 'function' && require.main === module) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, argv) => {
      openExternalMarkdownFiles(findExternalMarkdownFilePaths(argv));
    });

    app.on('open-file', (event, filePath) => {
      event.preventDefault();
      openExternalMarkdownFile(filePath);
    });

    app.whenReady().then(() => {
      void bootstrap().catch((error) => {
        console.error('[App] Failed to bootstrap WorkKnowlage:', error);
        app.quit();
      });
    });
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    if (shareServerRuntime?.close) {
      void shareServerRuntime.close().catch((error) => {
        console.error('[App] Failed to close share server:', error);
      });
    }
    publicShareTunnelRuntimes.forEach((runtime) => {
      void runtime.close?.().catch((error) => {
        console.error('[App] Failed to close public share tunnel:', error);
      });
    });
    publicShareTunnelRuntimes.clear();
    closeDatabase();
  });
}

module.exports = {
  bootstrap,
  registerIpcHandlers,
  registerExportIpcHandlers,
  createExternalMarkdownFileWindow,
  drainStartupExternalMarkdownFilePaths,
  findExternalMarkdownFilePaths,
  normalizeExternalMarkdownFilePath,
  openExternalMarkdownFile,
};
