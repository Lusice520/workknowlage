import type { DragEvent } from 'react';
import { getChildDocuments, getChildFolders } from '../../shared/lib/workspaceSelectors';
import type { WorkspaceState } from '../../shared/types/workspace';

export type TreeDragState =
  | { kind: 'folder'; id: string }
  | { kind: 'document'; id: string; sourceFolderId: string | null }
  | null;

export const treeDragDataMime = 'application/x-workknowlage-tree-drag';

export const createFolderDragState = (folderId: string): Exclude<TreeDragState, null> => ({
  kind: 'folder',
  id: folderId,
});

export const createDocumentDragState = (
  documentId: string,
  sourceFolderId: string | null,
): Exclude<TreeDragState, null> => ({
  kind: 'document',
  id: documentId,
  sourceFolderId,
});

const isTreeDragState = (value: unknown): value is Exclude<TreeDragState, null> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'folder') {
    return typeof candidate.id === 'string';
  }

  if (candidate.kind === 'document') {
    return typeof candidate.id === 'string' && (typeof candidate.sourceFolderId === 'string' || candidate.sourceFolderId === null);
  }

  return false;
};

export const readTreeDragState = (
  event: DragEvent<HTMLElement>,
  fallbackState: TreeDragState,
): Exclude<TreeDragState, null> | null => {
  const serializedState = event.dataTransfer.getData(treeDragDataMime);
  if (!serializedState) {
    return fallbackState;
  }

  try {
    const parsedState = JSON.parse(serializedState);
    return isTreeDragState(parsedState) ? parsedState : fallbackState;
  } catch {
    return fallbackState;
  }
};

export const getDescendantTreeNodeIds = (state: WorkspaceState, nodeId: string): string[] => {
  const childFolders = getChildFolders(state, nodeId);
  const childDocuments = getChildDocuments(state, nodeId);

  return [
    ...childFolders.flatMap((folder) => [
      folder.id,
      ...getDescendantTreeNodeIds(state, folder.id),
    ]),
    ...childDocuments.flatMap((document) => [
      document.id,
      ...getDescendantTreeNodeIds(state, document.id),
    ]),
  ];
};

export const isInvalidTreeDropTarget = (
  state: WorkspaceState,
  nextDragState: Exclude<TreeDragState, null> | null,
  targetNodeId: string | null,
): boolean => {
  if (!nextDragState) {
    return true;
  }

  if (nextDragState.kind === 'document') {
    if (nextDragState.id === targetNodeId || nextDragState.sourceFolderId === targetNodeId) {
      return true;
    }

    return targetNodeId !== null && getDescendantTreeNodeIds(state, nextDragState.id).includes(targetNodeId);
  }

  if (nextDragState.id === targetNodeId) {
    return true;
  }

  if (targetNodeId === null) {
    const draggedFolder = state.seed.folders.find((folder) => folder.id === nextDragState.id);
    return !draggedFolder || draggedFolder.parentId === null;
  }

  return getDescendantTreeNodeIds(state, nextDragState.id).includes(targetNodeId);
};

export const isInvalidFolderDropTarget = (
  state: WorkspaceState,
  nextDragState: Exclude<TreeDragState, null> | null,
  folderId: string,
): boolean => isInvalidTreeDropTarget(state, nextDragState, folderId);

export const isInvalidDocumentDropTarget = (
  state: WorkspaceState,
  nextDragState: Exclude<TreeDragState, null> | null,
  documentId: string,
): boolean => isInvalidTreeDropTarget(state, nextDragState, documentId);

export const isInvalidRootDropTarget = (
  state: WorkspaceState,
  nextDragState: Exclude<TreeDragState, null> | null,
): boolean => isInvalidTreeDropTarget(state, nextDragState, null);
