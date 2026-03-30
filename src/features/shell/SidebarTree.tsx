import { type DragEvent } from 'react';
import type { DocumentRecord, FolderNode, WorkspaceState } from '../../shared/types/workspace';
import { DocumentTreeItem, FolderSection } from './SidebarTreeItems';
import type { TreeDragState } from './sidebarTreeDnd';
export interface SidebarTreeProps {
  state: WorkspaceState;
  editingId: string | null;
  activeDocumentId: string;
  rootDocuments: DocumentRecord[];
  rootFolders: FolderNode[];
  dragState: TreeDragState;
  dropTargetFolderId: string | null;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateDocument: (folderId: string | null) => Promise<void>;
  onCreateFolder: (parentId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onRenameDocument: (documentId: string, newTitle: string) => Promise<void>;
  onMoveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
  onStartEditing: (id: string) => void;
  onCancelEditing: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onTreeDragStart: (dragState: Exclude<TreeDragState, null>) => void;
  onTreeDragEnd: () => void;
  onFolderDragOver: (event: DragEvent<HTMLElement>, folderId: string) => void;
  onFolderDrop: (event: DragEvent<HTMLElement>, folderId: string) => Promise<void>;
  onDocumentDragOver: (event: DragEvent<HTMLElement>, documentId: string) => void;
  onDocumentDrop: (event: DragEvent<HTMLElement>, documentId: string) => Promise<void>;
}

export function SidebarTree({
  state,
  editingId,
  activeDocumentId,
  rootDocuments,
  rootFolders,
  dragState,
  dropTargetFolderId,
  onSelectDocument,
  onToggleFolder,
  onCreateDocument,
  onCreateFolder,
  onMoveFolder,
  onRenameFolder,
  onRenameDocument,
  onMoveDocument,
  onStartEditing,
  onCancelEditing,
  onDeleteDocument,
  onDeleteFolder,
  onTreeDragStart,
  onTreeDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onDocumentDragOver,
  onDocumentDrop,
}: SidebarTreeProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      {rootDocuments.map((document) => (
        <DocumentTreeItem
          key={document.id}
          state={state}
          document={document}
          activeDocumentId={activeDocumentId}
          editingId={editingId}
          sourceFolderId={null}
          dragState={dragState}
          dropTargetFolderId={dropTargetFolderId}
          onSelectDocument={onSelectDocument}
          onToggleFolder={onToggleFolder}
          onCreateDocument={onCreateDocument}
          onCreateFolder={onCreateFolder}
          onMoveFolder={onMoveFolder}
          onRenameFolder={onRenameFolder}
          onRenameDocument={onRenameDocument}
          onMoveDocument={onMoveDocument}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onDeleteDocument={onDeleteDocument}
          onDeleteFolder={onDeleteFolder}
          onTreeDragStart={onTreeDragStart}
          onTreeDragEnd={onTreeDragEnd}
          onFolderDragOver={onFolderDragOver}
          onFolderDrop={onFolderDrop}
          onDocumentDragOver={onDocumentDragOver}
          onDocumentDrop={onDocumentDrop}
        />
      ))}
      {rootFolders.map((folder) => (
        <FolderSection
          key={folder.id}
          folder={folder}
          state={state}
          editingId={editingId}
          dragState={dragState}
          dropTargetFolderId={dropTargetFolderId}
          onSelectDocument={onSelectDocument}
          onToggleFolder={onToggleFolder}
          onCreateDocument={onCreateDocument}
          onCreateFolder={onCreateFolder}
          onMoveFolder={onMoveFolder}
          onRenameFolder={onRenameFolder}
          onRenameDocument={onRenameDocument}
          onMoveDocument={onMoveDocument}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onDeleteDocument={onDeleteDocument}
          onDeleteFolder={onDeleteFolder}
          onTreeDragStart={onTreeDragStart}
          onTreeDragEnd={onTreeDragEnd}
          onFolderDragOver={onFolderDragOver}
          onFolderDrop={onFolderDrop}
          onDocumentDragOver={onDocumentDragOver}
          onDocumentDrop={onDocumentDrop}
        />
      ))}
    </div>
  );
}
