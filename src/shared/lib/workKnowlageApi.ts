import { workspaceSeed } from '../mocks/workspace';
import type {
  DataToolActionResult,
  DocumentShareRecord,
  ExportActionResult,
  TrashItemRecord,
  UploadAssetInput,
  UploadedAssetRecord,
  WorkKnowlageDesktopApi,
  WorkKnowlageStorageInfo,
  WorkspaceSnapshotRecord,
  WorkspaceSearchResultRecord,
} from '../types/preload';
import type {
  DocumentRecord,
  FolderNode,
  QuickNoteMonthEntry,
  QuickNoteRecord,
  WorkspaceSeed,
} from '../types/workspace';
import { buildDerivedDocumentContent } from './documentContent';
import { extractDocumentMentions } from './documentMentions';

type RuntimeMode = 'electron-sqlite' | 'browser-mock';
type PersistenceMode = 'disk' | 'memory';

export interface WorkKnowlageRuntimeStatus {
  storageLabel: string;
  summary: string;
  detail: string;
  isPersistent: boolean;
  tone: 'positive' | 'warning';
}

const DEFAULT_STORAGE_SCOPE_LABEL = '空间、文件夹、文档、快记';
const DEFAULT_BROWSER_STORAGE_PATH = '浏览器会话内存';
const SEARCH_PREVIEW_LENGTH = 72;
const FALLBACK_MAINTENANCE_MESSAGE = '浏览器 Mock 环境不执行真实数据工具操作';
const FALLBACK_EXPORT_ROOT = '浏览器会话导出';

interface MutableFallbackState {
  seed: WorkspaceSeed;
  shares: Record<string, DocumentShareRecord>;
  uploadedAssets: Record<string, UploadedAssetRecord[]>;
  quickNotes: QuickNoteRecord[];
}

const cloneWorkspaceSeed = (): WorkspaceSeed => JSON.parse(JSON.stringify(workspaceSeed));

const createToken = () => `share-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const getDescendantFolderIds = (folders: FolderNode[], folderId: string): string[] => {
  const childFolderIds = folders
    .filter((folder) => folder.parentId === folderId)
    .map((folder) => folder.id);

  return childFolderIds.flatMap((childFolderId) => [
    childFolderId,
    ...getDescendantFolderIds(folders, childFolderId),
  ]);
};

const isFolderActive = (folder: FolderNode): boolean => !folder.deletedAt;
const isDocumentActive = (document: DocumentRecord): boolean => !document.deletedAt;

const getActiveFolders = (folders: FolderNode[], spaceId?: string): FolderNode[] =>
  folders.filter((folder) => isFolderActive(folder) && (spaceId ? folder.spaceId === spaceId : true));

const getActiveDocuments = (documents: DocumentRecord[], spaceId?: string): DocumentRecord[] =>
  documents.filter((document) => isDocumentActive(document) && (spaceId ? document.spaceId === spaceId : true));

const getTrashedFolderRoots = (folders: FolderNode[], spaceId: string): FolderNode[] =>
  folders.filter(
    (folder) =>
      folder.spaceId === spaceId &&
      Boolean(folder.deletedAt) &&
      folder.trashRootId === folder.id
  );

const getTrashedDocumentRoots = (documents: DocumentRecord[], spaceId: string): DocumentRecord[] =>
  documents.filter(
    (document) =>
      document.spaceId === spaceId &&
      Boolean(document.deletedAt) &&
      document.trashRootId === document.id
  );

const getFallbackTrashItems = (
  folders: FolderNode[],
  documents: DocumentRecord[],
  spaceId: string,
): TrashItemRecord[] => {
  const folderItems = getTrashedFolderRoots(folders, spaceId).map<TrashItemRecord>((folder) => {
    const packageFolderIds = [folder.id, ...getDescendantFolderIds(folders, folder.id)];

    return {
      id: folder.id,
      trashRootId: folder.id,
      kind: 'folder',
      spaceId: folder.spaceId,
      title: folder.name,
      deletedAt: folder.deletedAt ?? '',
      childFolderCount: packageFolderIds.length - 1,
      childDocumentCount: documents.filter(
        (document) =>
          document.spaceId === folder.spaceId &&
          Boolean(document.deletedAt) &&
          document.trashRootId === folder.id
      ).length,
    };
  });

  const documentItems = getTrashedDocumentRoots(documents, spaceId).map<TrashItemRecord>((document) => ({
    id: document.id,
    trashRootId: document.id,
    kind: 'document',
    spaceId: document.spaceId,
    title: document.title,
    deletedAt: document.deletedAt ?? '',
    folderId: document.folderId,
  }));

  return [...folderItems, ...documentItems].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
};

const ensureFolderMoveIsValid = (folders: FolderNode[], folderId: string, newParentId: string | null) => {
  const activeFolders = getActiveFolders(folders);

  if (newParentId === null) {
    return;
  }

  if (folderId === newParentId) {
    throw new Error('Cannot move a folder into itself or its descendant.');
  }

  const descendantFolderIds = new Set(getDescendantFolderIds(activeFolders, folderId));
  if (descendantFolderIds.has(newParentId)) {
    throw new Error('Cannot move a folder into itself or its descendant.');
  }

  const folder = activeFolders.find((item) => item.id === folderId);
  const parentFolder = activeFolders.find((item) => item.id === newParentId);

  if (!folder || !parentFolder || folder.spaceId !== parentFolder.spaceId) {
    throw new Error('Folder move target is invalid.');
  }
};

const ensureDocumentMoveIsValid = (
  documents: DocumentRecord[],
  folders: FolderNode[],
  documentId: string,
  targetFolderId: string | null,
) => {
  const document = getActiveDocuments(documents).find((item) => item.id === documentId);

  if (!document) {
    throw new Error('Document move target is invalid.');
  }

  if (targetFolderId === null) {
    return;
  }

  const targetFolder = getActiveFolders(folders).find((item) => item.id === targetFolderId);
  if (!targetFolder || document.spaceId !== targetFolder.spaceId) {
    throw new Error('Document move target is invalid.');
  }
};

const hydrateDocumentRecord = (document: Omit<DocumentRecord, 'contentJson' | 'outline' | 'sections' | 'wordCountLabel'> & {
  contentJson?: string;
  sections?: DocumentRecord['sections'];
  outline?: DocumentRecord['outline'];
  wordCountLabel?: string;
}): DocumentRecord => {
  const derivedContent = buildDerivedDocumentContent({
    contentJson: document.contentJson,
    sections: document.sections,
  });

  return {
    ...document,
    contentJson: derivedContent.contentJson,
    updatedAt: document.updatedAt ?? '',
    updatedAtLabel: document.updatedAtLabel ?? document.updatedAt ?? '',
    outline: derivedContent.outline,
    sections: derivedContent.sections,
    wordCountLabel: derivedContent.wordCountLabel,
    isFavorite: document.isFavorite ?? false,
  };
};

const createFallbackAssetUrl = (asset: UploadAssetInput): string => {
  const mimeType = asset.mimeType || 'application/octet-stream';
  const blobBytes = Array.isArray(asset.bytes)
    ? new Uint8Array(asset.bytes)
    : asset.bytes instanceof Uint8Array
      ? new Uint8Array(asset.bytes)
      : new Uint8Array(asset.bytes);
  const blob = new Blob([blobBytes as unknown as BlobPart], { type: mimeType });

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }

  return '';
};

const createFallbackExportResult = (fileName: string): ExportActionResult => ({
  success: true,
  message: `已导出 ${fileName}`,
  path: `${FALLBACK_EXPORT_ROOT}/${fileName}`,
});

const tokenizeSearchQuery = (query: string): string[] =>
  query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

const collectSearchStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSearchStrings(item));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, nestedValue]) => {
    if (typeof nestedValue === 'string') {
      return ['text', 'title', 'content', 'caption', 'label', 'name'].includes(key)
        ? [nestedValue]
        : [];
    }

    return collectSearchStrings(nestedValue);
  });
};

const extractSearchableText = (contentJson: string): string =>
  collectSearchStrings((() => {
    try {
      return JSON.parse(contentJson);
    } catch {
      return [];
    }
  })())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const includesAllTokens = (value: string, tokens: string[]): boolean => {
  const normalizedValue = value.toLocaleLowerCase();
  return tokens.every((token) => normalizedValue.includes(token));
};

const buildSearchPreview = (title: string, bodyText: string, query: string): string => {
  const fallbackText = bodyText.trim() || title.trim();
  if (!fallbackText) {
    return '没有可预览的正文内容';
  }

  const normalizedText = fallbackText.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchIndex = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;

  if (matchIndex < 0) {
    return fallbackText.slice(0, SEARCH_PREVIEW_LENGTH);
  }

  const start = Math.max(0, matchIndex - 16);
  const end = Math.min(fallbackText.length, start + SEARCH_PREVIEW_LENGTH);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < fallbackText.length ? '...' : '';
  return `${prefix}${fallbackText.slice(start, end)}${suffix}`;
};

const scoreSearchResult = (title: string, bodyText: string, query: string): number => {
  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedBody = bodyText.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();

  let score = 0;
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 5;
  }
  if (normalizedBody.includes(normalizedQuery)) {
    score += 2;
  }

  return score;
};

type FallbackSearchCandidate = WorkspaceSearchResultRecord & {
  score: number;
  searchableText: string;
};

const createMutableFallbackDesktopApi = ({
  seed,
  shares,
  uploadedAssets,
  quickNotes,
}: MutableFallbackState): WorkKnowlageDesktopApi => {
  let mutableQuickNotes = quickNotes;
  const resolveQuickNoteDate = (noteDateOrSpaceId: string, maybeNoteDate?: string) =>
    maybeNoteDate ?? noteDateOrSpaceId;
  const resolveQuickNoteMonthKey = (monthKeyOrSpaceId: string, maybeMonthKey?: string) =>
    maybeMonthKey ?? monthKeyOrSpaceId;
  const findQuickNoteByDate = (noteDate: string): QuickNoteRecord | null =>
    mutableQuickNotes.find((note) => note.noteDate === noteDate) ?? null;
  const getFolderPackageIds = (folderId: string): string[] => [folderId, ...getDescendantFolderIds(seed.folders, folderId)];
  const getDocumentById = (documentId: string, options: { includeDeleted?: boolean } = {}): DocumentRecord | null => {
    const document = seed.documents.find((item) => item.id === documentId) ?? null;
    if (!document) {
      return null;
    }

    if (!options.includeDeleted && !isDocumentActive(document)) {
      return null;
    }

    return document;
  };
  const getFolderById = (folderId: string, options: { includeDeleted?: boolean } = {}): FolderNode | null => {
    const folder = seed.folders.find((item) => item.id === folderId) ?? null;
    if (!folder) {
      return null;
    }

    if (!options.includeDeleted && !isFolderActive(folder)) {
      return null;
    }

    return folder;
  };
  const rebuildBacklinksForSpace = (spaceId: string) => {
    const activeDocuments = getActiveDocuments(seed.documents, spaceId);
    const activeDocumentIds = new Set(activeDocuments.map((document) => document.id));
    const backlinksByTarget = new Map<string, DocumentRecord['backlinks']>();

    activeDocuments.forEach((document) => {
      const seenTargetIds = new Set<string>();
      const mentions = extractDocumentMentions(document.contentJson, document.id);

      mentions.forEach((mention) => {
        if (!activeDocumentIds.has(mention.targetDocumentId) || seenTargetIds.has(mention.targetDocumentId)) {
          return;
        }

        seenTargetIds.add(mention.targetDocumentId);
        const backlinks = backlinksByTarget.get(mention.targetDocumentId) ?? [];
        backlinks.push({
          id: `backlink-${document.id}-${mention.targetDocumentId}`,
          sourceDocumentId: document.id,
          sourceBlockId: mention.sourceBlockId,
          title: document.title,
          description: mention.description,
        });
        backlinksByTarget.set(mention.targetDocumentId, backlinks);
      });
    });

    seed.documents = seed.documents.map((document) => {
      if (document.spaceId !== spaceId) {
        return document;
      }

      return {
        ...document,
        backlinks: document.deletedAt ? [] : (backlinksByTarget.get(document.id) ?? []),
      };
    });
  };
  const trashDocument = (documentId: string): DocumentRecord | null => {
    const currentDocument = getDocumentById(documentId);
    if (!currentDocument) {
      return null;
    }

    const deletedAt = new Date().toISOString();
    const nextDocument = {
      ...currentDocument,
      deletedAt,
      trashRootId: currentDocument.id,
      updatedAt: deletedAt,
      updatedAtLabel: new Date(deletedAt).toLocaleDateString('zh-CN'),
    };

    seed.documents = seed.documents.map((document) =>
      document.id === documentId ? nextDocument : document
    );
    delete shares[documentId];
    rebuildBacklinksForSpace(currentDocument.spaceId);
    return seed.documents.find((document) => document.id === documentId) ?? nextDocument;
  };
  const trashFolder = (folderId: string): FolderNode | null => {
    const currentFolder = getFolderById(folderId);
    if (!currentFolder) {
      return null;
    }

    const deletedAt = new Date().toISOString();
    const packageFolderIds = new Set(getFolderPackageIds(folderId));

    seed.folders = seed.folders.map((folder) =>
      packageFolderIds.has(folder.id)
        ? {
            ...folder,
            deletedAt,
            trashRootId: folderId,
          }
        : folder
    );
    seed.documents = seed.documents.map((document) => {
      if (document.folderId === null || !packageFolderIds.has(document.folderId)) {
        return document;
      }

      delete shares[document.id];
      return {
        ...document,
        deletedAt,
        trashRootId: folderId,
        updatedAt: deletedAt,
        updatedAtLabel: new Date(deletedAt).toLocaleDateString('zh-CN'),
      };
    });

    rebuildBacklinksForSpace(currentFolder.spaceId);
    return getFolderById(folderId, { includeDeleted: true });
  };
  const restoreTrashItem = (spaceId: string, trashRootId: string): boolean => {
    const trashedDocument = seed.documents.find(
      (document) =>
        document.spaceId === spaceId &&
        document.id === trashRootId &&
        document.trashRootId === trashRootId &&
        Boolean(document.deletedAt)
    );

    if (trashedDocument) {
      seed.documents = seed.documents.map((document) =>
        document.id === trashRootId
          ? {
              ...document,
              folderId: document.folderId && getFolderById(document.folderId) ? document.folderId : null,
              deletedAt: null,
              trashRootId: null,
            }
          : document
      );
      rebuildBacklinksForSpace(spaceId);
      return true;
    }

    const trashedFolder = seed.folders.find(
      (folder) =>
        folder.spaceId === spaceId &&
        folder.id === trashRootId &&
        folder.trashRootId === trashRootId &&
        Boolean(folder.deletedAt)
    );

    if (!trashedFolder) {
      return false;
    }

    seed.folders = seed.folders.map((folder) =>
      folder.spaceId === spaceId && folder.trashRootId === trashRootId
        ? {
            ...folder,
            deletedAt: null,
            trashRootId: null,
          }
        : folder
    );
    seed.documents = seed.documents.map((document) =>
      document.spaceId === spaceId && document.trashRootId === trashRootId
        ? {
            ...document,
            deletedAt: null,
            trashRootId: null,
          }
        : document
    );
    rebuildBacklinksForSpace(spaceId);
    return true;
  };
  const deleteTrashItem = (spaceId: string, trashRootId: string): boolean => {
    const trashedDocument = seed.documents.find(
      (document) =>
        document.spaceId === spaceId &&
        document.id === trashRootId &&
        document.trashRootId === trashRootId &&
        Boolean(document.deletedAt)
    );

    if (trashedDocument) {
      seed.documents = seed.documents.filter((document) => document.id !== trashRootId);
      delete shares[trashRootId];
      delete uploadedAssets[trashRootId];
      rebuildBacklinksForSpace(spaceId);
      return true;
    }

    const trashedFolder = seed.folders.find(
      (folder) =>
        folder.spaceId === spaceId &&
        folder.id === trashRootId &&
        folder.trashRootId === trashRootId &&
        Boolean(folder.deletedAt)
    );

    if (!trashedFolder) {
      return false;
    }

    const packageFolderIds = new Set(
      seed.folders
        .filter((folder) => folder.spaceId === spaceId && folder.trashRootId === trashRootId)
        .map((folder) => folder.id)
    );
    const packageDocumentIds = seed.documents
      .filter((document) => document.spaceId === spaceId && document.trashRootId === trashRootId)
      .map((document) => document.id);

    seed.folders = seed.folders.filter((folder) => !packageFolderIds.has(folder.id));
    seed.documents = seed.documents.filter((document) => !packageDocumentIds.includes(document.id));
    packageDocumentIds.forEach((documentId) => {
      delete shares[documentId];
      delete uploadedAssets[documentId];
    });
    rebuildBacklinksForSpace(spaceId);
    return true;
  };
  const emptyTrash = (spaceId: string): number => {
    const trashItems = getFallbackTrashItems(seed.folders, seed.documents, spaceId);
    trashItems.forEach((item) => {
      deleteTrashItem(spaceId, item.trashRootId);
    });
    return trashItems.length;
  };

  seed.spaces.forEach((space) => {
    rebuildBacklinksForSpace(space.id);
  });

  return ({
  meta: {
    version: '0.1.0',
    runtime: 'browser-mock',
    persistence: 'memory',
    storageLabel: '浏览器内存 Mock',
    getStorageInfo: async (): Promise<WorkKnowlageStorageInfo> => ({
      storagePath: DEFAULT_BROWSER_STORAGE_PATH,
      scopeLabel: DEFAULT_STORAGE_SCOPE_LABEL,
    }),
  },
  spaces: {
    list: async () => seed.spaces,
    create: async (data) => {
      const nextSpace = { id: `space-${Date.now()}`, ...data };
      seed.spaces.push(nextSpace);
      return nextSpace;
    },
    update: async (id, data) => {
      seed.spaces = seed.spaces.map((space) =>
        space.id === id ? { ...space, ...data } : space
      );
    },
    delete: async (id) => {
      const deletedSpaceIds = new Set([id]);
      seed.spaces = seed.spaces.filter((space) => space.id !== id);
      seed.folders = seed.folders.filter((folder) => folder.spaceId !== id);
      seed.documents = seed.documents.filter((document) => document.spaceId !== id);
      deletedSpaceIds.forEach((spaceId) => rebuildBacklinksForSpace(spaceId));
    },
  },
  folders: {
    list: async (spaceId) => getActiveFolders(seed.folders, spaceId),
    create: async (data) => {
      const nextFolder = { id: `folder-${Date.now()}`, ...data };
      seed.folders.push(nextFolder);
      return nextFolder;
    },
    rename: async (id, name) => {
      seed.folders = seed.folders.map((folder) =>
        folder.id === id ? { ...folder, name } : folder
      );
    },
    move: async (id, newParentId) => {
      ensureFolderMoveIsValid(seed.folders, id, newParentId);
      seed.folders = seed.folders.map((folder) =>
        folder.id === id ? { ...folder, parentId: newParentId } : folder
      );
    },
    trash: async (id) => trashFolder(id),
    delete: async (id) => {
      const folder = seed.folders.find((item) => item.id === id) ?? null;
      const removedFolderIds = new Set([id, ...getDescendantFolderIds(seed.folders, id)]);

      seed.folders = seed.folders.filter((folder) => !removedFolderIds.has(folder.id));
      seed.documents = seed.documents.filter(
        (document) =>
          document.folderId === null ||
          !removedFolderIds.has(document.folderId) ||
          Boolean(document.deletedAt)
      );
      if (folder) {
        rebuildBacklinksForSpace(folder.spaceId);
      }
    },
  },
  documents: {
    list: async (spaceId, folderId) => getActiveDocuments(seed.documents, spaceId).filter(
      (document) => document.folderId === folderId
    ),
    getById: async (documentId) => getDocumentById(documentId),
    create: async (data) => {
      const now = new Date().toISOString();
      const nextDocument = hydrateDocumentRecord({
        id: `doc-${Date.now()}`,
        ...data,
        title: data.title,
        updatedAt: now,
        updatedAtLabel: new Date(now).toLocaleDateString('zh-CN'),
        badgeLabel: '',
        tags: [],
        backlinks: [],
        sections: [],
        isFavorite: false,
      });

      seed.documents.push(nextDocument);
      rebuildBacklinksForSpace(data.spaceId);
      return getDocumentById(nextDocument.id) ?? nextDocument;
    },
    update: async (id, data) => {
      const currentDocument = seed.documents.find((document) => document.id === id);

      if (!currentDocument) {
        throw new Error(`Fallback document not found: ${id}`);
      }

      const now = new Date().toISOString();
      const nextDocument = hydrateDocumentRecord({
        ...currentDocument,
        ...data,
        updatedAt: now,
        updatedAtLabel: new Date(now).toLocaleDateString('zh-CN'),
      });

      seed.documents = seed.documents.map((document) =>
        document.id === id ? nextDocument : document
      );

      rebuildBacklinksForSpace(currentDocument.spaceId);
      return getDocumentById(id, { includeDeleted: true }) ?? nextDocument;
    },
    move: async (id, targetFolderId) => {
      ensureDocumentMoveIsValid(seed.documents, seed.folders, id, targetFolderId);
      const currentDocument = getDocumentById(id);

      if (!currentDocument) {
        throw new Error(`Fallback document not found: ${id}`);
      }

      const now = new Date().toISOString();
      const nextDocument = {
        ...currentDocument,
        folderId: targetFolderId,
        updatedAt: now,
        updatedAtLabel: new Date(now).toLocaleDateString('zh-CN'),
      };

      seed.documents = seed.documents.map((document) =>
        document.id === id ? nextDocument : document
      );

      rebuildBacklinksForSpace(currentDocument.spaceId);
      return getDocumentById(id) ?? nextDocument;
    },
    trash: async (id) => trashDocument(id),
    delete: async (id) => {
      const currentDocument = seed.documents.find((document) => document.id === id) ?? null;
      seed.documents = seed.documents.filter((document) => document.id !== id);
      delete shares[id];
      delete uploadedAssets[id];
      if (currentDocument) {
        rebuildBacklinksForSpace(currentDocument.spaceId);
      }
    },
  },
  quickNotes: {
    get: async (noteDateOrSpaceId, maybeNoteDate?: string) =>
      findQuickNoteByDate(resolveQuickNoteDate(noteDateOrSpaceId, maybeNoteDate)),
    upsert: async ({ noteDate, title, contentJson }) => {
      const now = new Date().toISOString();
      const existing = findQuickNoteByDate(noteDate);

      if (existing) {
        const nextNote: QuickNoteRecord = {
          ...existing,
          title,
          contentJson,
          updatedAt: now,
        };
        mutableQuickNotes = mutableQuickNotes.map((note) =>
          note.id === existing.id ? nextNote : note
        );
        return nextNote;
      }

      const nextNote: QuickNoteRecord = {
        id: `quick-note-${Date.now()}`,
        noteDate,
        title,
        contentJson,
        createdAt: now,
        updatedAt: now,
      };
      mutableQuickNotes.push(nextNote);
      return nextNote;
    },
    listMonth: async (monthKeyOrSpaceId, maybeMonthKey?: string) => mutableQuickNotes
      .filter((note) => note.noteDate.startsWith(`${resolveQuickNoteMonthKey(monthKeyOrSpaceId, maybeMonthKey)}-`))
      .sort((left, right) => left.noteDate.localeCompare(right.noteDate))
      .map<QuickNoteMonthEntry>((note) => ({
        noteDate: note.noteDate,
        updatedAt: note.updatedAt,
      })),
    assets: {
      upload: async (noteId, assets) => {
        const uploaded = assets.map((asset) => ({
          documentId: noteId,
          name: asset.name,
          mimeType: asset.mimeType,
          size: Array.isArray(asset.bytes)
            ? asset.bytes.length
            : asset.bytes instanceof Uint8Array
              ? asset.bytes.byteLength
              : asset.bytes instanceof ArrayBuffer
                ? asset.bytes.byteLength
                : 0,
          fileName: `${Date.now()}-${asset.name}`,
          url: createFallbackAssetUrl(asset),
        }));

        uploadedAssets[noteId] = [...(uploadedAssets[noteId] ?? []), ...uploaded];
        return uploaded;
      },
    },
  },
  search: {
    query: async (spaceId, query) => {
      const trimmedQuery = query.trim();
      const tokens = tokenizeSearchQuery(trimmedQuery);

      if (tokens.length === 0) {
        return [];
      }

      const documentCandidates: FallbackSearchCandidate[] = getActiveDocuments(seed.documents, spaceId)
        .map((document) => {
          const bodyText = [
            document.sections
              .flatMap((section) => [
                section.title ?? '',
                section.content ?? '',
                section.caption ?? '',
                ...(section.items ?? []),
              ])
              .join(' '),
            extractSearchableText(document.contentJson),
          ]
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          return {
            id: document.id,
            kind: 'document' as const,
            title: document.title,
            preview: buildSearchPreview(document.title, bodyText, trimmedQuery),
            spaceId: document.spaceId,
            documentId: document.id,
            ...(document.folderId ? { folderId: document.folderId } : {}),
            score: scoreSearchResult(document.title, bodyText, trimmedQuery),
            searchableText: `${document.title} ${bodyText}`.trim(),
          };
        })
      const documentHits: Array<WorkspaceSearchResultRecord & { score: number }> = documentCandidates
        .filter((record) => includesAllTokens(record.searchableText, tokens))
        .map(({ searchableText: _searchableText, ...record }) => record);

      const quickNoteCandidates: FallbackSearchCandidate[] = mutableQuickNotes
        .map((note) => {
          const bodyText = extractSearchableText(note.contentJson);

          return {
            id: note.id,
            kind: 'quick-note' as const,
            title: note.title,
            preview: buildSearchPreview(note.title, bodyText, trimmedQuery),
            spaceId,
            noteDate: note.noteDate,
            score: scoreSearchResult(note.title, bodyText, trimmedQuery),
            searchableText: `${note.title} ${bodyText}`.trim(),
          };
        })
      const quickNoteHits: Array<WorkspaceSearchResultRecord & { score: number }> = quickNoteCandidates
        .filter((record) => includesAllTokens(record.searchableText, tokens))
        .map(({ searchableText: _searchableText, ...record }) => record);

      return [...documentHits, ...quickNoteHits].sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.title.localeCompare(right.title, 'zh-CN');
      });
    },
  },
  workspace: {
    getSnapshot: async (spaceId): Promise<WorkspaceSnapshotRecord> => ({
      folders: getActiveFolders(seed.folders, spaceId),
      documents: getActiveDocuments(seed.documents, spaceId)
        .sort((left, right) => {
          const leftTime = Date.parse(left.updatedAt || '');
          const rightTime = Date.parse(right.updatedAt || '');

          if (!Number.isNaN(leftTime) || !Number.isNaN(rightTime)) {
            return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
          }

          return right.updatedAtLabel.localeCompare(left.updatedAtLabel, 'zh-CN');
        }),
    }),
    getTrash: async (spaceId) => getFallbackTrashItems(seed.folders, seed.documents, spaceId),
    restoreTrashItem: async (spaceId, trashRootId) => restoreTrashItem(spaceId, trashRootId),
    deleteTrashItem: async (spaceId, trashRootId) => deleteTrashItem(spaceId, trashRootId),
    emptyTrash: async (spaceId) => emptyTrash(spaceId),
  },
  maintenance: {
    openDataDirectory: async (): Promise<DataToolActionResult> => ({
      success: true,
      message: FALLBACK_MAINTENANCE_MESSAGE,
      path: DEFAULT_BROWSER_STORAGE_PATH,
    }),
    createBackup: async (): Promise<DataToolActionResult> => ({
      success: true,
      message: FALLBACK_MAINTENANCE_MESSAGE,
    }),
    restoreBackup: async (): Promise<DataToolActionResult> => ({
      success: true,
      message: FALLBACK_MAINTENANCE_MESSAGE,
    }),
    rebuildSearchIndex: async (): Promise<DataToolActionResult> => ({
      success: true,
      message: FALLBACK_MAINTENANCE_MESSAGE,
    }),
    cleanupOrphanAttachments: async (): Promise<DataToolActionResult> => ({
      success: true,
      message: FALLBACK_MAINTENANCE_MESSAGE,
      deletedFiles: 0,
      deletedDirectories: 0,
      reclaimedBytes: 0,
    }),
  },
  exports: {
    saveText: async (fileName) => createFallbackExportResult(fileName),
    saveBinary: async (fileName) => createFallbackExportResult(fileName),
    savePdfFromHtml: async (fileName) => createFallbackExportResult(fileName),
  },
  assets: {
    upload: async (documentId, assets) => {
      const uploaded = assets.map((asset) => ({
        documentId,
        name: asset.name,
        mimeType: asset.mimeType,
        size: Array.isArray(asset.bytes)
          ? asset.bytes.length
          : asset.bytes instanceof Uint8Array
            ? asset.bytes.byteLength
            : asset.bytes instanceof ArrayBuffer
              ? asset.bytes.byteLength
              : 0,
        fileName: `${Date.now()}-${asset.name}`,
        url: createFallbackAssetUrl(asset),
      }));

      uploadedAssets[documentId] = [...(uploadedAssets[documentId] ?? []), ...uploaded];
      return uploaded;
    },
  },
  shares: {
    get: async (documentId) => (getDocumentById(documentId) ? shares[documentId] ?? null : null),
    create: async (documentId) => {
      if (!getDocumentById(documentId)) {
        return null;
      }

      const existing = shares[documentId];
      if (existing) {
        shares[documentId] = {
          ...existing,
          enabled: true,
          updatedAt: new Date().toISOString(),
        };
        return shares[documentId];
      }

      const nextShare: DocumentShareRecord = {
        id: `share-${Date.now()}`,
        documentId,
        token: createToken(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      nextShare.publicUrl = `http://127.0.0.1:0/share/${nextShare.token}`;
      shares[documentId] = nextShare;
      return nextShare;
    },
    regenerate: async (documentId) => {
      if (!getDocumentById(documentId)) {
        return null;
      }

      const nextShare = await createMutableFallbackDesktopApi({
        seed,
        shares,
        uploadedAssets,
        quickNotes: mutableQuickNotes,
      }).shares.create(documentId);
      if (!nextShare) {
        return null;
      }

      nextShare.token = createToken();
      nextShare.updatedAt = new Date().toISOString();
      nextShare.publicUrl = `http://127.0.0.1:0/share/${nextShare.token}`;
      shares[documentId] = nextShare;
      return nextShare;
    },
    disable: async (documentId) => {
      if (!getDocumentById(documentId)) {
        return null;
      }

      const currentShare = shares[documentId];
      if (!currentShare) {
        return null;
      }

      shares[documentId] = {
        ...currentShare,
        enabled: false,
        updatedAt: new Date().toISOString(),
      };
      return shares[documentId];
    },
    getPublicUrl: async (token) => `http://127.0.0.1:0/share/${token}`,
  },
  tags: {
    listForDocument: async (documentId) =>
      seed.documents.find((document) => document.id === documentId)?.tags ?? [],
    addToDocument: async (documentId, data) => {
      const nextTag = {
        id: `tag-${Date.now()}`,
        label: data.label,
        tone: data.tone ?? 'neutral',
      } as const;

      seed.documents = seed.documents.map((document) =>
        document.id === documentId
          ? { ...document, tags: [...document.tags, nextTag] }
          : document
      );

      return nextTag;
    },
    removeFromDocument: async (documentId, tagId) => {
      seed.documents = seed.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              tags: document.tags.filter((tag) => tag.id !== tagId),
            }
          : document
      );
    },
  },
  });
};

/**
 * Fallback API used when running in browser mode (outside Electron).
 * Returns a fresh mutable mock store so tests can create isolated API instances.
 */
export const createFallbackDesktopApi = (): WorkKnowlageDesktopApi =>
  createMutableFallbackDesktopApi({
    seed: cloneWorkspaceSeed(),
    shares: {},
    uploadedAssets: {},
    quickNotes: [],
  });

const fallbackDesktopApi = createMutableFallbackDesktopApi({
  seed: cloneWorkspaceSeed(),
  shares: {},
  uploadedAssets: {},
  quickNotes: [],
});

export const getWorkKnowlageApi = (): WorkKnowlageDesktopApi => {
  if (typeof window !== 'undefined' && window.workKnowlage) {
    return window.workKnowlage;
  }

  return fallbackDesktopApi;
};

export const getWorkKnowlageRuntimeStatus = (
  api: WorkKnowlageDesktopApi = getWorkKnowlageApi()
): WorkKnowlageRuntimeStatus => {
  const runtime = (api.meta.runtime ?? 'browser-mock') as RuntimeMode;
  const persistence = (api.meta.persistence ?? (runtime === 'electron-sqlite' ? 'disk' : 'memory')) as PersistenceMode;
  const isPersistent = runtime === 'electron-sqlite' && persistence === 'disk';

  if (isPersistent) {
    return {
      storageLabel: api.meta.storageLabel ?? 'SQLite 本地数据库',
      summary: '会自动保存到本机',
      detail: '当前写入会持久化到本地数据库',
      isPersistent: true,
      tone: 'positive',
    };
  }

  return {
    storageLabel: api.meta.storageLabel ?? '浏览器内存 Mock',
    summary: '关闭页面后会丢失',
    detail: '当前仅保存在浏览器会话',
    isPersistent: false,
    tone: 'warning',
  };
};
