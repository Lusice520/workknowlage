import { workspaceSeed } from '../mocks/workspace';
import { getWorkKnowlageApi } from './workKnowlageApi';
import type {
  DocumentRecord,
  FolderNode,
  QuickLinkItem,
  Space,
  WorkspaceCollectionView,
  WorkspaceState,
} from '../types/workspace';

const DEFAULT_QUICK_LINKS: QuickLinkItem[] = [
  { id: 'all-notes', label: '所有笔记' },
  { id: 'favorites', label: '收藏夹' },
];

/**
 * Synchronous fallback (browser dev mode) — uses mock data.
 */
export const createInitialWorkspaceState = (): WorkspaceState => ({
  seed: workspaceSeed,
  activeSpaceId: workspaceSeed.spaces[0]?.id ?? '',
  activeDocumentId: workspaceSeed.documents[0]?.id ?? '',
  expandedFolderIds: ['folder-inspiration'],
  activeCollectionView: 'tree',
});

interface LoadWorkspaceStateOptions {
  activeDocumentId?: string;
  activeSpaceId?: string;
  ensureExpandedFolderIds?: string[];
  expandedFolderIds?: string[];
  activeCollectionView?: WorkspaceCollectionView;
}

const getNextExpandedFolderIds = (
  folders: FolderNode[],
  documents: DocumentRecord[],
  expandedFolderIds: string[] = [],
  ensureExpandedFolderIds: string[] = []
): string[] => {
  const availableTreeNodeIds = new Set([
    ...folders.map((folder) => folder.id),
    ...documents.map((document) => document.id),
  ]);
  const retainedExpandedFolderIds = expandedFolderIds.filter((folderId) => availableTreeNodeIds.has(folderId));
  const ensuredExpandedFolderIds = ensureExpandedFolderIds.filter((folderId) => availableTreeNodeIds.has(folderId));
  const nextExpandedFolderIds = [...new Set([...retainedExpandedFolderIds, ...ensuredExpandedFolderIds])];

  if (nextExpandedFolderIds.length > 0) {
    return nextExpandedFolderIds;
  }

  return folders[0] ? [folders[0].id] : [];
};

async function loadSpaceSnapshot(activeSpaceId: string) {
  const api = getWorkKnowlageApi();
  if (api.workspace?.getSnapshot) {
    return api.workspace.getSnapshot(activeSpaceId);
  }

  const folders = await api.folders.list(activeSpaceId);
  const documentsById = new Map<string, DocumentRecord>();
  const pendingContainerIds: Array<string | null> = [null, ...folders.map((folder) => folder.id)];
  const loadedContainerIds = new Set<string | null>();

  while (pendingContainerIds.length > 0) {
    const containerId = pendingContainerIds.shift() ?? null;
    if (loadedContainerIds.has(containerId)) {
      continue;
    }

    loadedContainerIds.add(containerId);
    const documents = await api.documents.list(activeSpaceId, containerId);

    documents.forEach((document) => {
      if (documentsById.has(document.id)) {
        return;
      }

      documentsById.set(document.id, document);
      pendingContainerIds.push(document.id);
    });
  }

  return {
    folders,
    documents: [...documentsById.values()],
  };
}

/**
 * Async loader — used in both Electron (SQLite) and browser (mock fallback) modes.
 * Loads from IPC when available, otherwise falls back to mock data.
 */
export const loadWorkspaceState = async (
  options: LoadWorkspaceStateOptions = {},
): Promise<WorkspaceState> => {
  const api = getWorkKnowlageApi();

  const spaces = await api.spaces.list();
  const preferredSpaceId = options.activeSpaceId ?? '';
  const activeSpaceId = spaces.some((space) => space.id === preferredSpaceId)
    ? preferredSpaceId
    : (spaces[0]?.id ?? '');

  let folders: FolderNode[] = [];
  let documents: DocumentRecord[] = [];

  if (activeSpaceId) {
    const snapshot = await loadSpaceSnapshot(activeSpaceId);
    folders = snapshot.folders;
    documents = snapshot.documents;
  }

  const activeDocumentId = documents.some((document) => document.id === options.activeDocumentId)
    ? (options.activeDocumentId ?? '')
    : (documents[0]?.id ?? '');

  return {
    seed: {
      spaces,
      folders,
      documents,
      quickLinks: DEFAULT_QUICK_LINKS,
    },
    activeSpaceId,
    activeDocumentId,
    expandedFolderIds: getNextExpandedFolderIds(
      folders,
      documents,
      options.expandedFolderIds,
      options.ensureExpandedFolderIds,
    ),
    activeCollectionView: options.activeCollectionView ?? 'tree',
  };
};

// ─── Pure selectors (unchanged) ─────────────────────────

export const getActiveSpace = (state: WorkspaceState): Space | null =>
  state.seed.spaces.find((space) => space.id === state.activeSpaceId) ?? null;

export const getActiveCollectionView = (state: WorkspaceState): WorkspaceCollectionView =>
  state.activeCollectionView ?? 'tree';

export const getActiveDocument = (state: WorkspaceState): DocumentRecord | null =>
  state.seed.documents.find((document) => document.id === state.activeDocumentId) ?? null;

const getDocumentTimestamp = (document: DocumentRecord): number => {
  const timestamp = Date.parse(document.updatedAt ?? '');
  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  const labelTimestamp = Date.parse(document.updatedAtLabel);
  return Number.isNaN(labelTimestamp) ? 0 : labelTimestamp;
};

export const sortDocumentsByRecentUpdate = (documents: DocumentRecord[]): DocumentRecord[] =>
  [...documents].sort((left, right) => {
    const timestampDiff = getDocumentTimestamp(right) - getDocumentTimestamp(left);
    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    return left.title.localeCompare(right.title, 'zh-CN');
  });

export const getDocumentsForCollectionView = (
  documents: DocumentRecord[],
  view: Exclude<WorkspaceCollectionView, 'tree' | 'trash'>,
): DocumentRecord[] =>
  sortDocumentsByRecentUpdate(
    view === 'favorites'
      ? documents.filter((document) => document.isFavorite)
      : documents
  );

export const getFoldersForActiveSpace = (state: WorkspaceState): FolderNode[] =>
  state.seed.folders.filter((folder) => folder.spaceId === state.activeSpaceId);

export const getRootFolders = (state: WorkspaceState): FolderNode[] =>
  state.seed.folders.filter(
    (folder) => folder.spaceId === state.activeSpaceId && folder.parentId === null
  );

export const getChildFolders = (state: WorkspaceState, parentId: string): FolderNode[] =>
  state.seed.folders.filter((folder) => folder.parentId === parentId);

export const getChildDocuments = (state: WorkspaceState, parentId: string): DocumentRecord[] =>
  state.seed.documents.filter((document) => document.folderId === parentId);

export const getDocumentsForFolder = (state: WorkspaceState, folderId: string | null): DocumentRecord[] =>
  state.seed.documents.filter((document) => document.folderId === folderId);

export const getRootDocuments = (state: WorkspaceState): DocumentRecord[] =>
  state.seed.documents.filter(
    (document) => document.spaceId === state.activeSpaceId && document.folderId === null
  );

export const getFolderById = (state: WorkspaceState, folderId: string): FolderNode | null =>
  state.seed.folders.find((folder) => folder.id === folderId) ?? null;
