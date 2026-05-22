import { type DragEvent } from 'react';
import type { DocumentCreateOptions, DocumentRecord, FolderNode, TreeNodeKind, TreeReorderInput, WorkspaceState } from '../../shared/types/workspace';
import { DocumentTreeItem, FolderSection } from './SidebarTreeItems';
import type { TreeDragState, TreeNodeDropTarget } from './sidebarTreeDnd';
export interface SidebarTreeProps {
  state: WorkspaceState;
  editingId: string | null;
  activeDocumentId: string;
  rootDocuments: DocumentRecord[];
  rootFolders: FolderNode[];
  dragState: TreeDragState;
  dropTarget: TreeNodeDropTarget | null;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateDocument: (folderId: string | null, options?: DocumentCreateOptions) => Promise<void>;
  onCreateFolder: (parentId: string | null) => Promise<void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  onReorderTreeNode: (input: TreeReorderInput) => Promise<void>;
  onRequestMoveFolderToSpace: (folderId: string, folderName: string) => void;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onRenameDocument: (documentId: string, newTitle: string) => Promise<void>;
  onMoveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
  onRequestMoveDocumentToSpace: (documentId: string, documentTitle: string) => void;
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
  onTreeNodeAfterDragOver: (event: DragEvent<HTMLElement>, targetKind: TreeNodeKind, targetId: string) => void;
  onTreeNodeAfterDrop: (event: DragEvent<HTMLElement>, targetKind: TreeNodeKind, targetId: string) => Promise<void>;
}

export function SidebarTree({
  state,
  editingId,
  activeDocumentId,
  rootDocuments,
  rootFolders,
  dragState,
  dropTarget,
  onSelectDocument,
  onToggleFolder,
  onCreateDocument,
  onCreateFolder,
  onMoveFolder,
  onReorderTreeNode,
  onRequestMoveFolderToSpace,
  onRenameFolder,
  onRenameDocument,
  onMoveDocument,
  onRequestMoveDocumentToSpace,
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
  onTreeNodeAfterDragOver,
  onTreeNodeAfterDrop,
}: SidebarTreeProps): JSX.Element {
  return (
    <div data-testid="sidebar-root-tree" className="space-y-1.5">
      {[
        ...rootFolders.map((folder) => ({ kind: 'folder' as const, node: folder })),
        ...rootDocuments.map((document) => ({ kind: 'document' as const, node: document })),
      ]
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
          const sortDiff = (left.item.node.sortOrder ?? 0) - (right.item.node.sortOrder ?? 0);
          return sortDiff === 0 ? left.index - right.index : sortDiff;
        })
        .map(({ item }) => (
          item.kind === 'folder' ? (
            <FolderSection
              key={item.node.id}
              folder={item.node}
              state={state}
              editingId={editingId}
              dragState={dragState}
              dropTarget={dropTarget}
              onSelectDocument={onSelectDocument}
              onToggleFolder={onToggleFolder}
              onCreateDocument={onCreateDocument}
              onCreateFolder={onCreateFolder}
              onMoveFolder={onMoveFolder}
              onReorderTreeNode={onReorderTreeNode}
              onRequestMoveFolderToSpace={onRequestMoveFolderToSpace}
              onRenameFolder={onRenameFolder}
              onRenameDocument={onRenameDocument}
              onMoveDocument={onMoveDocument}
              onRequestMoveDocumentToSpace={onRequestMoveDocumentToSpace}
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
              onTreeNodeAfterDragOver={onTreeNodeAfterDragOver}
              onTreeNodeAfterDrop={onTreeNodeAfterDrop}
            />
          ) : (
            <DocumentTreeItem
              key={item.node.id}
              state={state}
              document={item.node}
              activeDocumentId={activeDocumentId}
              editingId={editingId}
              sourceFolderId={null}
              dragState={dragState}
              dropTarget={dropTarget}
              onSelectDocument={onSelectDocument}
              onToggleFolder={onToggleFolder}
              onCreateDocument={onCreateDocument}
              onCreateFolder={onCreateFolder}
              onMoveFolder={onMoveFolder}
              onReorderTreeNode={onReorderTreeNode}
              onRequestMoveFolderToSpace={onRequestMoveFolderToSpace}
              onRenameFolder={onRenameFolder}
              onRenameDocument={onRenameDocument}
              onMoveDocument={onMoveDocument}
              onRequestMoveDocumentToSpace={onRequestMoveDocumentToSpace}
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
              onTreeNodeAfterDragOver={onTreeNodeAfterDragOver}
              onTreeNodeAfterDrop={onTreeNodeAfterDrop}
            />
          )
        ))}
    </div>
  );
}
