const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workKnowlage', {
  meta: {
    version: '0.4.0',
    runtime: 'electron-sqlite',
    persistence: 'disk',
    storageLabel: 'SQLite 本地数据库',
    getStorageInfo: () => ipcRenderer.invoke('meta:getStorageInfo'),
  },

  // ─── Spaces ───────────────────────────────────────────
  spaces: {
    list:   ()           => ipcRenderer.invoke('spaces:list'),
    create: (data)       => ipcRenderer.invoke('spaces:create', data),
    update: (id, data)   => ipcRenderer.invoke('spaces:update', id, data),
    delete: (id)         => ipcRenderer.invoke('spaces:delete', id),
  },

  // ─── Folders ──────────────────────────────────────────
  folders: {
    list:   (spaceId)        => ipcRenderer.invoke('folders:list', spaceId),
    create: (data)           => ipcRenderer.invoke('folders:create', data),
    rename: (id, name)       => ipcRenderer.invoke('folders:rename', id, name),
    move:   (id, newParent)  => ipcRenderer.invoke('folders:move', id, newParent),
    moveToSpace: (id, targetSpaceId) => ipcRenderer.invoke('folders:moveToSpace', id, targetSpaceId),
    trash:  (id)             => ipcRenderer.invoke('folders:trash', id),
    delete: (id)             => ipcRenderer.invoke('folders:delete', id),
  },

  // ─── Documents ────────────────────────────────────────
  documents: {
    list:     (spaceId, folderId) => ipcRenderer.invoke('documents:list', spaceId, folderId),
    getById:  (id)          => ipcRenderer.invoke('documents:getById', id),
    create:   (data)        => ipcRenderer.invoke('documents:create', data),
    update:   (id, data)    => ipcRenderer.invoke('documents:update', id, data),
    move:     (id, targetFolderId) => ipcRenderer.invoke('documents:move', id, targetFolderId),
    moveToSpace: (id, targetSpaceId) => ipcRenderer.invoke('documents:moveToSpace', id, targetSpaceId),
    trash:    (id)          => ipcRenderer.invoke('documents:trash', id),
    delete:   (id)          => ipcRenderer.invoke('documents:delete', id),
  },

  spreadsheets: {
    get:    (documentId) => ipcRenderer.invoke('spreadsheets:get', documentId),
    update: (documentId, workbookJson) => ipcRenderer.invoke('spreadsheets:update', documentId, workbookJson),
  },

  quickNotes: {
    get:      (...args) => ipcRenderer.invoke('quickNotes:get', ...args),
    upsert:   (data)              => ipcRenderer.invoke('quickNotes:upsert', data),
    listMonth:(...args)           => ipcRenderer.invoke('quickNotes:listMonth', ...args),
    assets: {
      upload: (noteId, assets) => ipcRenderer.invoke('quickNotes:assets:upload', noteId, assets),
    },
  },

  search: {
    query:   (spaceId, query, limit) => ipcRenderer.invoke('search:query', { spaceId, query, limit }),
    rebuild: () => ipcRenderer.invoke('search:rebuild'),
  },

  workspace: {
    getSnapshot: (spaceId) => ipcRenderer.invoke('workspace:getSnapshot', spaceId),
    getTrash: (spaceId) => ipcRenderer.invoke('workspace:getTrash', spaceId),
    restoreTrashItem: (spaceId, trashRootId) => ipcRenderer.invoke('workspace:restoreTrashItem', spaceId, trashRootId),
    deleteTrashItem: (spaceId, trashRootId) => ipcRenderer.invoke('workspace:deleteTrashItem', spaceId, trashRootId),
    emptyTrash: (spaceId) => ipcRenderer.invoke('workspace:emptyTrash', spaceId),
  },

  maintenance: {
    openDataDirectory: () => ipcRenderer.invoke('maintenance:openDataDirectory'),
    createBackup: () => ipcRenderer.invoke('maintenance:createBackup'),
    restoreBackup: () => ipcRenderer.invoke('maintenance:restoreBackup'),
    rebuildSearchIndex: () => ipcRenderer.invoke('maintenance:rebuildSearchIndex'),
    inspectDocumentContentHealth: () => ipcRenderer.invoke('maintenance:inspectDocumentContentHealth'),
    cleanupOrphanAttachments: () => ipcRenderer.invoke('maintenance:cleanupOrphanAttachments'),
  },

  exports: {
    saveText: (fileName, content) => ipcRenderer.invoke('exports:saveText', {
      fileName,
      content,
    }),
    saveBinary: (fileName, bytes) => ipcRenderer.invoke('exports:saveBinary', {
      fileName,
      bytes,
    }),
    savePdfFromHtml: (fileName, html) => ipcRenderer.invoke('exports:savePdfFromHtml', {
      fileName,
      html,
      title: fileName,
    }),
  },

  // ─── External Markdown files ─────────────────────────
  externalFiles: {
    getInitial: () => ipcRenderer.invoke('externalFiles:getInitial'),
    saveMarkdown: (markdown) => ipcRenderer.invoke('externalFiles:saveMarkdown', markdown),
    revealInFinder: () => ipcRenderer.invoke('externalFiles:revealInFinder'),
    importToWorkspace: (payload) => ipcRenderer.invoke('externalFiles:importToWorkspace', payload),
  },

  // ─── Local assets ─────────────────────────────────────
  assets: {
    upload: (documentId, assets) => ipcRenderer.invoke('assets:upload', documentId, assets),
  },

  // ─── Local shares ─────────────────────────────────────
  shares: {
    get:         (documentId) => ipcRenderer.invoke('shares:get', documentId),
    create:      (documentId) => ipcRenderer.invoke('shares:create', documentId),
    regenerate:  (documentId) => ipcRenderer.invoke('shares:regenerate', documentId),
    disable:     (documentId) => ipcRenderer.invoke('shares:disable', documentId),
    createPublic: (documentId, options) => ipcRenderer.invoke('shares:createPublic', documentId, options),
    disablePublic: (documentId) => ipcRenderer.invoke('shares:disablePublic', documentId),
    listForSpace: (spaceId) => ipcRenderer.invoke('shares:listForSpace', spaceId),
    disableAllForSpace: (spaceId) => ipcRenderer.invoke('shares:disableAllForSpace', spaceId),
    getPublicUrl: (token)     => ipcRenderer.invoke('shares:getPublicUrl', token),
  },

  // ─── Tags ─────────────────────────────────────────────
  tags: {
    listForDocument:     (docId)          => ipcRenderer.invoke('tags:listForDocument', docId),
    addToDocument:       (docId, data)    => ipcRenderer.invoke('tags:addToDocument', docId, data),
    removeFromDocument:  (docId, tagId)   => ipcRenderer.invoke('tags:removeFromDocument', docId, tagId),
  },
});
