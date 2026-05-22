import type { DragEvent } from 'react';
import { getChildDocuments, getChildFolders } from '../../shared/lib/workspaceSelectors';
import type { TreeNodeKind, TreeReorderInput, TreeReorderPosition, WorkspaceState } from '../../shared/types/workspace';

export type TreeDragState =
  | { kind: 'folder'; id: string }
  | { kind: 'document'; id: string; sourceFolderId: string | null }
  | null;

export const treeDragDataMime = 'application/x-workknowlage-tree-drag';
export const treeDropPositionMime = 'application/x-workknowlage-tree-drop-position';

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

export type TreeNodeDropPosition = 'inside' | TreeReorderPosition;

export interface TreeNodeDropTarget {
  kind: TreeNodeKind;
  id: string;
  position: TreeNodeDropPosition;
}

export const getTreeNodeDropPosition = (event: DragEvent<HTMLElement>): TreeNodeDropPosition => {
  const forcedPosition = event.dataTransfer.getData(treeDropPositionMime);
  if (forcedPosition === 'before' || forcedPosition === 'after' || forcedPosition === 'inside') {
    return forcedPosition;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const nativeOffsetY = (event.nativeEvent as DragEvent<HTMLElement>['nativeEvent'] & { offsetY?: number }).offsetY;
  if (rect.height <= 0) {
    const fallbackOffsetY = typeof nativeOffsetY === 'number' && nativeOffsetY > 0 ? nativeOffsetY : event.clientY;
    if (fallbackOffsetY < 8) {
      return 'before';
    }
    if (fallbackOffsetY > 24) {
      return 'after';
    }

    return 'inside';
  }

  const clientOffsetY = event.clientY - rect.top;
  const offsetY = Number.isFinite(clientOffsetY)
    ? clientOffsetY
    : nativeOffsetY;

  if (typeof offsetY !== 'number' || !Number.isFinite(offsetY)) {
    return 'inside';
  }

  if (offsetY < rect.height * 0.28) {
    return 'before';
  }
  if (offsetY > rect.height * 0.72) {
    return 'after';
  }

  return 'inside';
};

export const isInvalidTreeReorderTarget = (
  state: WorkspaceState,
  nextDragState: Exclude<TreeDragState, null> | null,
  targetKind: TreeNodeKind,
  targetId: string,
): boolean => {
  if (!nextDragState || nextDragState.id === targetId) {
    return true;
  }

  return targetId !== null && getDescendantTreeNodeIds(state, nextDragState.id).includes(targetId);
};

export const createTreeReorderInput = (
  dragState: Exclude<TreeDragState, null>,
  targetKind: TreeNodeKind,
  targetId: string,
  position: TreeReorderPosition,
): TreeReorderInput => ({
  draggedKind: dragState.kind,
  draggedId: dragState.id,
  targetKind,
  targetId,
  position,
});
