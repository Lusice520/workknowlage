import type { Dispatch, SetStateAction } from 'react';
import type {
  DocumentRecord,
  QuickNoteRecord,
  WorkspaceCollectionView,
  WorkspaceState,
} from '../shared/types/workspace';
import type { WorkspaceReloadOptions } from './workspaceSessionTypes';

export interface WorkspaceSessionActionsOptions {
  workspaceState: WorkspaceState | null;
  reloadWorkspaceState: (options?: WorkspaceReloadOptions) => Promise<WorkspaceState>;
  markPersistenceFeedback: (actionLabel: string) => void;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState | null>>;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  setActiveQuickNoteDate: Dispatch<SetStateAction<string | null>>;
  setSelectedQuickNoteDate: Dispatch<SetStateAction<string>>;
  setQuickNoteRefreshKey: Dispatch<SetStateAction<number>>;
}

export interface WorkspaceSessionActionsState {
  openDocument: (documentId: string, options?: { ensureExpandedFolderIds?: string[] }) => Promise<void>;
  selectCollectionView: (view: Exclude<WorkspaceCollectionView, 'tree'>) => void;
  selectQuickNoteDate: (noteDate: string) => void;
  toggleFolder: (folderId: string) => void;
  createDocument: (folderId: string | null) => Promise<void>;
  createFolder: (parentId: string | null) => Promise<void>;
  moveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  renameDocument: (documentId: string, newTitle: string) => Promise<void>;
  moveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
  startEditing: (id: string) => void;
  cancelEditing: () => void;
  deleteDocument: (documentId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  createSpace: (name: string) => Promise<void>;
  renameSpace: (spaceId: string, newName: string) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  switchSpace: (spaceId: string) => Promise<void>;
  addTagToDocument: (documentId: string, label: string) => Promise<void>;
  removeTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  setDocumentFavorite: (documentId: string, isFavorite: boolean) => Promise<void>;
  saveDocumentContent: (documentId: string, contentJson: string) => Promise<DocumentRecord>;
  saveQuickNoteContent: (noteDate: string, contentJson: string) => Promise<QuickNoteRecord>;
  captureQuickNoteToDocument: (noteDate: string) => Promise<DocumentRecord | null>;
  uploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  uploadQuickNoteFiles: (quickNoteId: string, files: File[]) => Promise<string[]>;
}

export const updateDocumentInState = (
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState | null>>,
  documentId: string,
  updater: (document: DocumentRecord) => DocumentRecord,
): void => {
  setWorkspaceState((prev) => {
    if (!prev) {
      return prev;
    }

    return {
      ...prev,
      seed: {
        ...prev.seed,
        documents: prev.seed.documents.map((document) =>
          document.id === documentId ? updater(document) : document
        ),
      },
    };
  });
};
