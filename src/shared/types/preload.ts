import type {
  DocumentRecord,
  DocumentUpdateInput,
  FolderNode,
  QuickNoteMonthEntry,
  QuickNoteRecord,
  Space,
  TagRecord,
} from './workspace';

export interface UploadAssetInput {
  name: string;
  mimeType: string;
  bytes: ArrayBuffer | Uint8Array | number[];
}

export interface UploadedAssetRecord {
  documentId: string;
  name: string;
  mimeType: string;
  size: number;
  fileName: string;
  url: string;
}

export interface DocumentShareRecord {
  id: string;
  documentId: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  publicUrl?: string;
}

export interface WorkKnowlageStorageInfo {
  storagePath: string;
  scopeLabel: string;
}

export interface DataToolActionResult {
  success: boolean;
  message: string;
  path?: string;
  deletedFiles?: number;
  deletedDirectories?: number;
  reclaimedBytes?: number;
}

export interface ExportActionResult {
  success: boolean;
  message: string;
  path?: string;
}

export type TrashItemKind = 'document' | 'folder';

export interface TrashItemRecord {
  id: string;
  trashRootId: string;
  kind: TrashItemKind;
  spaceId: string;
  title: string;
  deletedAt: string;
  folderId?: string | null;
  childDocumentCount?: number;
  childFolderCount?: number;
}

export type WorkspaceSearchResultKind = 'document' | 'quick-note';

export interface WorkspaceSearchResultRecord {
  id: string;
  kind: WorkspaceSearchResultKind;
  title: string;
  preview: string;
  spaceId: string;
  documentId?: string;
  folderId?: string;
  noteDate?: string;
}

export interface WorkspaceSnapshotRecord {
  folders: FolderNode[];
  documents: DocumentRecord[];
}

export interface WorkKnowlageDesktopApi {
  meta: {
    version: string;
    runtime?: 'electron-sqlite' | 'browser-mock';
    persistence?: 'disk' | 'memory';
    storageLabel?: string;
    getStorageInfo?: () => Promise<WorkKnowlageStorageInfo>;
  };

  spaces: {
    list: () => Promise<Space[]>;
    create: (data: Omit<Space, 'id'>) => Promise<Space>;
    update: (id: string, data: Partial<Omit<Space, 'id'>>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  folders: {
    list: (spaceId: string) => Promise<FolderNode[]>;
    create: (data: Omit<FolderNode, 'id'>) => Promise<FolderNode>;
    rename: (id: string, name: string) => Promise<void>;
    move: (id: string, newParentId: string | null) => Promise<void>;
    delete: (id: string) => Promise<void>;
    trash?: (id: string) => Promise<FolderNode | null>;
  };

  documents: {
    list: (spaceId: string, folderId: string | null) => Promise<DocumentRecord[]>;
    getById: (id: string) => Promise<DocumentRecord | null>;
    create: (data: { spaceId: string; folderId: string | null; title: string }) => Promise<DocumentRecord>;
    update: (id: string, data: DocumentUpdateInput) => Promise<DocumentRecord>;
    move: (id: string, targetFolderId: string | null) => Promise<DocumentRecord>;
    delete: (id: string) => Promise<void>;
    trash?: (id: string) => Promise<DocumentRecord | null>;
  };

  quickNotes: {
    get: (noteDateOrSpaceId: string, noteDate?: string) => Promise<QuickNoteRecord | null>;
    upsert: (data: {
      noteDate: string;
      title: string;
      contentJson: string;
      spaceId?: string;
    }) => Promise<QuickNoteRecord>;
    listMonth: (monthKeyOrSpaceId: string, monthKey?: string) => Promise<QuickNoteMonthEntry[]>;
    assets: {
      upload: (noteId: string, assets: UploadAssetInput[]) => Promise<UploadedAssetRecord[]>;
    };
  };

  search?: {
    query: (spaceId: string, query: string) => Promise<WorkspaceSearchResultRecord[]>;
  };

  workspace?: {
    getSnapshot: (spaceId: string) => Promise<WorkspaceSnapshotRecord>;
    getTrash?: (spaceId: string) => Promise<TrashItemRecord[]>;
    restoreTrashItem?: (spaceId: string, trashRootId: string) => Promise<boolean>;
    deleteTrashItem?: (spaceId: string, trashRootId: string) => Promise<boolean>;
    emptyTrash?: (spaceId: string) => Promise<number>;
  };

  maintenance?: {
    openDataDirectory: () => Promise<DataToolActionResult>;
    createBackup: () => Promise<DataToolActionResult>;
    restoreBackup: () => Promise<DataToolActionResult>;
    rebuildSearchIndex: () => Promise<DataToolActionResult>;
    cleanupOrphanAttachments: () => Promise<DataToolActionResult>;
  };

  exports?: {
    saveText: (fileName: string, content: string) => Promise<ExportActionResult>;
    saveBinary: (
      fileName: string,
      bytes: ArrayBuffer | Uint8Array | number[],
    ) => Promise<ExportActionResult>;
    savePdfFromHtml: (fileName: string, html: string) => Promise<ExportActionResult>;
  };

  assets: {
    upload: (documentId: string, assets: UploadAssetInput[]) => Promise<UploadedAssetRecord[]>;
  };

  shares: {
    get: (documentId: string) => Promise<DocumentShareRecord | null>;
    create: (documentId: string) => Promise<DocumentShareRecord | null>;
    regenerate: (documentId: string) => Promise<DocumentShareRecord | null>;
    disable: (documentId: string) => Promise<DocumentShareRecord | null>;
    getPublicUrl: (token: string) => Promise<string>;
  };

  tags: {
    listForDocument: (documentId: string) => Promise<TagRecord[]>;
    addToDocument: (documentId: string, data: { label: string; tone?: 'primary' | 'neutral' }) => Promise<TagRecord>;
    removeFromDocument: (documentId: string, tagId: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    workKnowlage?: WorkKnowlageDesktopApi;
  }
}

export {};
