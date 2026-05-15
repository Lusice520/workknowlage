import { createContext, useContext } from 'react';
import type {
  DocumentFocusTarget,
  DocumentNavigationTarget,
  DocumentRecord,
  FolderNode,
  QuickNoteRecord,
  Space,
  WorkspaceCollectionView,
  WorkspaceState,
} from '../../shared/types/workspace';
import type { TrashItemRecord } from '../../shared/types/preload';
import type { EditorHostFocusDiagnostic } from '../../features/editor-host/EditorHost';

export interface WorkspaceSessionContextValue {
  activeDocument: DocumentRecord | null;
  activeQuickNote: QuickNoteRecord | null;
  activeQuickNoteDate: string | null;
  activeFolder: FolderNode | null;
  activeSpace: Space | null;
  state: WorkspaceState;
  editingId: string | null;
  quickNoteRefreshKey: number | undefined;
  selectedQuickNoteDate: string;
  documentFocusTarget: DocumentFocusTarget | null | undefined;
  trashItems: TrashItemRecord[];
  onSelectDocument: (documentId: string) => void;
  onSelectCollectionView: (view: Exclude<WorkspaceCollectionView, 'tree'>) => void;
  onSelectQuickNoteDate: (dateKey: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateDocument: (folderId: string | null) => Promise<void>;
  onCreateFolder: (parentId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  onMoveFolderToSpace: (folderId: string, targetSpaceId: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onRenameDocument: (documentId: string, newTitle: string) => Promise<void>;
  onMoveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
  onMoveDocumentToSpace: (documentId: string, targetSpaceId: string) => Promise<void>;
  onStartEditing: (id: string) => void;
  onCancelEditing: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onCreateSpace: (name: string) => Promise<void>;
  onRenameSpace: (spaceId: string, newName: string) => Promise<void>;
  onDeleteSpace: (spaceId: string) => Promise<void>;
  onSwitchSpace: (spaceId: string) => Promise<void>;
  onOpenTrash: () => Promise<void> | void;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
  onSaveQuickNoteContent: (noteDate: string, contentJson: string) => Promise<QuickNoteRecord>;
  onCaptureQuickNote: (noteDate: string) => Promise<unknown>;
  onUploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  onUploadQuickNoteFiles: (quickNoteId: string, files: File[]) => Promise<string[]>;
  onSetDocumentFavorite: (documentId: string, isFavorite: boolean) => Promise<void>;
  onRestoreTrashItem: (trashRootId: string) => Promise<void> | void;
  onDeleteTrashItem: (trashRootId: string) => Promise<void> | void;
  onEmptyTrash: () => Promise<void> | void;
  onActiveDocumentContentSnapshotReady: ((getContentJson: () => string) => void) | undefined;
  onDocumentFocusDiagnostic: ((diagnostic: EditorHostFocusDiagnostic) => void) | undefined;
  onDocumentFocusTargetConsumed: (requestKey: number) => void;
  onAddTagToDocument: (documentId: string, label: string) => Promise<void>;
  onRemoveTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  onOpenBacklinkDocument: (target: DocumentNavigationTarget) => void;
}

const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | null>(null);

export const WorkspaceSessionContextProvider = WorkspaceSessionContext.Provider;

export const useWorkspaceSessionContext = (): WorkspaceSessionContextValue => {
  const ctx = useContext(WorkspaceSessionContext);
  if (!ctx) throw new Error('useWorkspaceSessionContext 必须在 WorkspaceSessionContextProvider 内使用');
  return ctx;
};
