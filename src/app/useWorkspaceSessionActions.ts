import { startTransition, useCallback } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import { useWorkspaceContentActions } from './useWorkspaceContentActions';
import { useWorkspaceSpaceActions } from './useWorkspaceSpaceActions';
import type { WorkspaceSessionActionsOptions, WorkspaceSessionActionsState } from './workspaceSessionActionTypes';

export function useWorkspaceSessionActions({
  workspaceState,
  reloadWorkspaceState,
  markPersistenceFeedback,
  setWorkspaceState,
  setEditingId,
  setActiveQuickNoteDate,
  setSelectedQuickNoteDate,
  setQuickNoteRefreshKey,
}: WorkspaceSessionActionsOptions): WorkspaceSessionActionsState {
  const openDocument = useCallback(
    async (documentId: string, options: { ensureExpandedFolderIds?: string[] } = {}) => {
      setActiveQuickNoteDate(null);

      if ((options.ensureExpandedFolderIds?.length ?? 0) > 0) {
        await reloadWorkspaceState({
          activeDocumentId: documentId,
          ensureExpandedFolderIds: options.ensureExpandedFolderIds,
          activeCollectionView: 'tree',
        });
        return;
      }

      const latestDocument = await getWorkKnowlageApi().documents.getById(documentId);

      startTransition(() => {
        setWorkspaceState((prev) => (
          prev
            ? {
                ...prev,
                activeDocumentId: documentId,
                activeCollectionView: 'tree',
                seed: {
                  ...prev.seed,
                  documents: latestDocument
                    ? prev.seed.documents.map((document) => (
                      document.id === documentId ? latestDocument : document
                    ))
                    : prev.seed.documents,
                },
              }
            : prev
        ));
      });
    },
    [reloadWorkspaceState, setActiveQuickNoteDate, setWorkspaceState],
  );

  const selectCollectionView = useCallback((view: 'all-notes' | 'favorites' | 'trash') => {
    setActiveQuickNoteDate(null);
    setWorkspaceState((prev) => (prev ? { ...prev, activeCollectionView: view } : prev));
  }, [setActiveQuickNoteDate, setWorkspaceState]);

  const selectQuickNoteDate = useCallback((noteDate: string) => {
    setSelectedQuickNoteDate(noteDate);
    setActiveQuickNoteDate(noteDate);
    setWorkspaceState((prev) => (prev ? { ...prev, activeCollectionView: 'tree' } : prev));
  }, [setActiveQuickNoteDate, setSelectedQuickNoteDate, setWorkspaceState]);

  const toggleFolder = useCallback((folderId: string) => {
    setWorkspaceState((prev) => {
      if (!prev) {
        return prev;
      }

      const isExpanded = prev.expandedFolderIds.includes(folderId);
      return {
        ...prev,
        expandedFolderIds: isExpanded
          ? prev.expandedFolderIds.filter((item) => item !== folderId)
          : [...prev.expandedFolderIds, folderId],
      };
    });
  }, [setWorkspaceState]);

  const createDocument = useCallback(
    async (folderId: string | null) => {
      if (!workspaceState) {
        return;
      }

      const api = getWorkKnowlageApi();
      const document = await api.documents.create({
        spaceId: workspaceState.activeSpaceId,
        folderId,
        title: '无标题文档',
      });

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId,
        activeDocumentId: document.id,
        ensureExpandedFolderIds: folderId ? [folderId] : [],
      });
      markPersistenceFeedback('新建文件');
      setActiveQuickNoteDate(null);
      setEditingId(document.id);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setActiveQuickNoteDate, setEditingId, workspaceState],
  );

  const createFolder = useCallback(
    async (parentId: string | null) => {
      if (!workspaceState) {
        return;
      }

      const api = getWorkKnowlageApi();
      const folder = await api.folders.create({
        spaceId: workspaceState.activeSpaceId,
        parentId,
        name: '新文件夹',
      });

      const expandedFolderIds = [
        ...workspaceState.expandedFolderIds,
        ...(parentId ? [parentId] : []),
        folder.id,
      ];

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId,
        activeDocumentId: workspaceState.activeDocumentId,
        ensureExpandedFolderIds: [...new Set(expandedFolderIds)],
      });
      markPersistenceFeedback('新建文件夹');
      setEditingId(folder.id);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId, workspaceState],
  );

  const renameFolder = useCallback(
    async (folderId: string, newName: string) => {
      const api = getWorkKnowlageApi();
      await api.folders.rename(folderId, newName);

      await reloadWorkspaceState();
      markPersistenceFeedback('重命名文件夹');
      setEditingId(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId],
  );

  const moveFolder = useCallback(
    async (folderId: string, newParentId: string | null) => {
      if (!workspaceState) {
        return;
      }

      const api = getWorkKnowlageApi();
      await api.folders.move(folderId, newParentId);

      await reloadWorkspaceState({
        activeDocumentId: workspaceState.activeDocumentId,
        ensureExpandedFolderIds: [folderId, ...(newParentId ? [newParentId] : [])],
      });
      markPersistenceFeedback('移动文件夹');
    },
    [markPersistenceFeedback, reloadWorkspaceState, workspaceState],
  );

  const renameDocument = useCallback(
    async (documentId: string, newTitle: string) => {
      const api = getWorkKnowlageApi();
      await api.documents.update(documentId, { title: newTitle });

      await reloadWorkspaceState({
        activeDocumentId: documentId,
      });
      markPersistenceFeedback('重命名文档');
      setEditingId(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId],
  );

  const moveDocument = useCallback(
    async (documentId: string, targetFolderId: string | null) => {
      const api = getWorkKnowlageApi();
      await api.documents.move(documentId, targetFolderId);

      await reloadWorkspaceState({
        activeDocumentId: documentId,
        ensureExpandedFolderIds: targetFolderId ? [targetFolderId] : [],
      });
      markPersistenceFeedback('移动文档');
    },
    [markPersistenceFeedback, reloadWorkspaceState],
  );

  const startEditing = useCallback((id: string) => {
    setEditingId(id);
  }, [setEditingId]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
  }, [setEditingId]);

  const contentActions = useWorkspaceContentActions({
    workspaceState,
    reloadWorkspaceState,
    markPersistenceFeedback,
    setWorkspaceState,
    setEditingId,
    setActiveQuickNoteDate,
    setSelectedQuickNoteDate,
    setQuickNoteRefreshKey,
  });

  const spaceActions = useWorkspaceSpaceActions({
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
    openDocument,
    selectCollectionView,
    selectQuickNoteDate,
    toggleFolder,
    ...contentActions,
    startEditing,
    cancelEditing,
    ...spaceActions,
  };
}
