const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workKnowlage', {
  meta: {
    version: '0.1.0',
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
    trash:    (id)          => ipcRenderer.invoke('documents:trash', id),
    delete:   (id)          => ipcRenderer.invoke('documents:delete', id),
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
    getPublicUrl: (token)     => ipcRenderer.invoke('shares:getPublicUrl', token),
  },

  // ─── Tags ─────────────────────────────────────────────
  tags: {
    listForDocument:     (docId)          => ipcRenderer.invoke('tags:listForDocument', docId),
    addToDocument:       (docId, data)    => ipcRenderer.invoke('tags:addToDocument', docId, data),
    removeFromDocument:  (docId, tagId)   => ipcRenderer.invoke('tags:removeFromDocument', docId, tagId),
  },
});
