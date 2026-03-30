import { useCallback } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type { WorkspaceSessionActionsOptions, WorkspaceSessionActionsState } from './workspaceSessionActionTypes';

type WorkspaceSpaceActionsState = Pick<
  WorkspaceSessionActionsState,
  'createSpace' | 'renameSpace' | 'deleteSpace' | 'switchSpace'
>;

export function useWorkspaceSpaceActions({
  workspaceState,
  reloadWorkspaceState,
  markPersistenceFeedback,
  setActiveQuickNoteDate,
}: WorkspaceSessionActionsOptions): WorkspaceSpaceActionsState {
  const createSpace = useCallback(
    async (name: string) => {
      const space = await getWorkKnowlageApi().spaces.create({ name, label: 'WORKSPACE' });

      await reloadWorkspaceState({
        activeSpaceId: space.id,
        activeDocumentId: '',
        expandedFolderIds: [],
        activeCollectionView: 'tree',
      });
      markPersistenceFeedback('新建空间');
      setActiveQuickNoteDate(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setActiveQuickNoteDate],
  );

  const renameSpace = useCallback(
    async (spaceId: string, newName: string) => {
      if (!workspaceState) {
        return;
      }

      await getWorkKnowlageApi().spaces.update(spaceId, { name: newName });

      await reloadWorkspaceState({
        activeSpaceId: spaceId,
        activeDocumentId: workspaceState.activeDocumentId,
      });
      markPersistenceFeedback('重命名空间');
    },
    [markPersistenceFeedback, reloadWorkspaceState, workspaceState],
  );

  const deleteSpace = useCallback(
    async (spaceId: string) => {
      if (!workspaceState) {
        return;
      }

      const remainingSpaceId = workspaceState.seed.spaces.find((space) => space.id !== spaceId)?.id ?? '';

      if (!remainingSpaceId && workspaceState.seed.spaces.some((space) => space.id === spaceId)) {
        return;
      }

      await getWorkKnowlageApi().spaces.delete(spaceId);

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId === spaceId ? remainingSpaceId : workspaceState.activeSpaceId,
        activeDocumentId: '',
        expandedFolderIds: [],
        activeCollectionView: 'tree',
      });
      markPersistenceFeedback('删除空间');
      setActiveQuickNoteDate(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setActiveQuickNoteDate, workspaceState],
  );

  const switchSpace = useCallback(
    async (spaceId: string) => {
      await reloadWorkspaceState({
        activeSpaceId: spaceId,
        activeDocumentId: '',
        expandedFolderIds: [],
        activeCollectionView: 'tree',
      });
      setActiveQuickNoteDate(null);
    },
    [reloadWorkspaceState, setActiveQuickNoteDate],
  );

  return {
    createSpace,
    renameSpace,
    deleteSpace,
    switchSpace,
  };
}
