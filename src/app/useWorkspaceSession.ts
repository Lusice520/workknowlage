import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateKey } from '../shared/lib/quickNotes';
import { type WorkKnowlageRuntimeStatus } from '../shared/lib/workKnowlageApi';
import { loadWorkspaceState } from '../shared/lib/workspaceSelectors';
import type { WorkKnowlageStorageInfo } from '../shared/types/preload';
import type { WorkspaceCollectionView, WorkspaceState } from '../shared/types/workspace';
import { useWorkspaceDiagnostics } from './useWorkspaceDiagnostics';
import { useWorkspaceSessionActions } from './useWorkspaceSessionActions';
import type { WorkspaceSessionActionsState } from './workspaceSessionActionTypes';
import type { WorkspaceReloadOptions } from './workspaceSessionTypes';

export interface WorkspaceSessionState {
  workspaceState: WorkspaceState | null;
  loading: boolean;
  editingId: string | null;
  activeQuickNoteDate: string | null;
  selectedQuickNoteDate: string;
  quickNoteRefreshKey: number;
  storageInfo: WorkKnowlageStorageInfo | null;
  persistenceFeedback: string;
  lastPersistedAt: string | null;
  activeCollectionView: WorkspaceCollectionView;
  reloadWorkspaceState: (options?: WorkspaceReloadOptions) => Promise<WorkspaceState>;
  openDocument: WorkspaceSessionActionsState['openDocument'];
  selectCollectionView: WorkspaceSessionActionsState['selectCollectionView'];
  selectQuickNoteDate: WorkspaceSessionActionsState['selectQuickNoteDate'];
  toggleFolder: WorkspaceSessionActionsState['toggleFolder'];
  createDocument: WorkspaceSessionActionsState['createDocument'];
  createFolder: WorkspaceSessionActionsState['createFolder'];
  moveFolder: WorkspaceSessionActionsState['moveFolder'];
  renameFolder: WorkspaceSessionActionsState['renameFolder'];
  renameDocument: WorkspaceSessionActionsState['renameDocument'];
  moveDocument: WorkspaceSessionActionsState['moveDocument'];
  startEditing: WorkspaceSessionActionsState['startEditing'];
  cancelEditing: WorkspaceSessionActionsState['cancelEditing'];
  deleteDocument: WorkspaceSessionActionsState['deleteDocument'];
  deleteFolder: WorkspaceSessionActionsState['deleteFolder'];
  createSpace: WorkspaceSessionActionsState['createSpace'];
  renameSpace: WorkspaceSessionActionsState['renameSpace'];
  deleteSpace: WorkspaceSessionActionsState['deleteSpace'];
  switchSpace: WorkspaceSessionActionsState['switchSpace'];
  addTagToDocument: WorkspaceSessionActionsState['addTagToDocument'];
  removeTagFromDocument: WorkspaceSessionActionsState['removeTagFromDocument'];
  setDocumentFavorite: WorkspaceSessionActionsState['setDocumentFavorite'];
  saveDocumentContent: WorkspaceSessionActionsState['saveDocumentContent'];
  saveQuickNoteContent: WorkspaceSessionActionsState['saveQuickNoteContent'];
  captureQuickNoteToDocument: WorkspaceSessionActionsState['captureQuickNoteToDocument'];
  uploadFiles: WorkspaceSessionActionsState['uploadFiles'];
  uploadQuickNoteFiles: WorkspaceSessionActionsState['uploadQuickNoteFiles'];
}

export function useWorkspaceSession(
  runtimeStatus: WorkKnowlageRuntimeStatus,
): WorkspaceSessionState {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeQuickNoteDate, setActiveQuickNoteDate] = useState<string | null>(null);
  const [selectedQuickNoteDate, setSelectedQuickNoteDate] = useState(() => formatDateKey(new Date()));
  const [quickNoteRefreshKey, setQuickNoteRefreshKey] = useState(0);
  const workspaceStateRef = useRef<WorkspaceState | null>(null);

  useEffect(() => {
    workspaceStateRef.current = workspaceState;
  }, [workspaceState]);

  const { storageInfo, persistenceFeedback, lastPersistedAt, markPersistenceFeedback } =
    useWorkspaceDiagnostics(runtimeStatus);

  const reloadWorkspaceState = useCallback(
    async (options: WorkspaceReloadOptions = {}): Promise<WorkspaceState> => {
      const currentWorkspaceState = workspaceStateRef.current;
      const nextState = await loadWorkspaceState({
        activeDocumentId: options.activeDocumentId ?? currentWorkspaceState?.activeDocumentId,
        activeSpaceId: options.activeSpaceId ?? currentWorkspaceState?.activeSpaceId,
        ensureExpandedFolderIds: options.ensureExpandedFolderIds ?? [],
        expandedFolderIds: options.expandedFolderIds ?? currentWorkspaceState?.expandedFolderIds ?? [],
        activeCollectionView: options.activeCollectionView ?? currentWorkspaceState?.activeCollectionView ?? 'tree',
      });

      setWorkspaceState(nextState);
      return nextState;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    reloadWorkspaceState()
      .then(() => {
        if (!cancelled) {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('[App] Failed to load workspace state:', error);
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadWorkspaceState]);

  const actions = useWorkspaceSessionActions({
    workspaceState,
    reloadWorkspaceState,
    markPersistenceFeedback,
    setWorkspaceState,
    setEditingId,
    setActiveQuickNoteDate,
    setSelectedQuickNoteDate,
    setQuickNoteRefreshKey,
  });

  return {
    workspaceState,
    loading,
    editingId,
    activeQuickNoteDate,
    selectedQuickNoteDate,
    quickNoteRefreshKey,
    activeCollectionView: workspaceState?.activeCollectionView ?? 'tree',
    storageInfo,
    persistenceFeedback,
    lastPersistedAt,
    reloadWorkspaceState,
    openDocument: actions.openDocument,
    selectCollectionView: actions.selectCollectionView,
    selectQuickNoteDate: actions.selectQuickNoteDate,
    toggleFolder: actions.toggleFolder,
    createDocument: actions.createDocument,
    createFolder: actions.createFolder,
    moveFolder: actions.moveFolder,
    renameFolder: actions.renameFolder,
    renameDocument: actions.renameDocument,
    moveDocument: actions.moveDocument,
    startEditing: actions.startEditing,
    cancelEditing: actions.cancelEditing,
    deleteDocument: actions.deleteDocument,
    deleteFolder: actions.deleteFolder,
    createSpace: actions.createSpace,
    renameSpace: actions.renameSpace,
    deleteSpace: actions.deleteSpace,
    switchSpace: actions.switchSpace,
    addTagToDocument: actions.addTagToDocument,
    removeTagFromDocument: actions.removeTagFromDocument,
    setDocumentFavorite: actions.setDocumentFavorite,
    saveDocumentContent: actions.saveDocumentContent,
    saveQuickNoteContent: actions.saveQuickNoteContent,
    captureQuickNoteToDocument: actions.captureQuickNoteToDocument,
    uploadFiles: actions.uploadFiles,
    uploadQuickNoteFiles: actions.uploadQuickNoteFiles,
  };
}
