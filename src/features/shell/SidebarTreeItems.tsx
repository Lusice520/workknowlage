import { type DragEvent } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
import { getChildDocuments, getChildFolders, getTreeItemsForContainer } from '../../shared/lib/workspaceSelectors';
import type { DocumentCreateOptions, DocumentRecord, FolderNode, TreeNodeKind, TreeReorderInput, WorkspaceState } from '../../shared/types/workspace';
import {
  createDocumentDragState,
  createFolderDragState,
  type TreeDragState,
  type TreeNodeDropTarget,
  treeDragDataMime,
} from './sidebarTreeDnd';
import { SidebarActionMenu } from './SidebarActionMenu';
import { SidebarInlineEditInput } from './SidebarInlineEditInput';

const folderRowClass =
  'group flex w-full items-center rounded-[10px] px-2 py-1.5 transition-all duration-200';
const documentRowClass =
  'group flex w-full items-center rounded-[10px] px-2 py-1.5 transition-all duration-200 relative';
const activeDocRowClass =
  'bg-[rgba(238,243,255,0.96)] text-blue-700 shadow-[inset_0_0_0_1px_rgba(147,197,253,0.34)]';
const inactiveDocRowClass =
  'text-slate-500 hover:bg-slate-100/50 hover:text-slate-800';
const childTreeClass =
  'relative ml-3 space-y-0.5 border-l border-slate-200/60 pl-2 pt-0.5 transition-all duration-300';
const treeRowContentClass =
  'grid min-w-0 flex-1 grid-cols-[16px_16px_minmax(0,1fr)] items-center gap-x-2';
const treeChevronSlotClass =
  'flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 transition-colors';
const treeIconSlotClass =
  'flex h-4 w-4 shrink-0 items-center justify-center';
const treeLabelClass =
  'truncate text-[12px] leading-[1.25] tracking-[0.01em]';
const treeActionGroupClass =
  'flex shrink-0 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto';

const getDropPositionClass = (
  dropTarget: TreeNodeDropTarget | null,
  kind: TreeNodeDropTarget['kind'],
  id: string,
) => {
  if (!dropTarget || dropTarget.kind !== kind || dropTarget.id !== id) {
    return '';
  }

  if (dropTarget.position === 'before') {
    return 'border-t-2 border-blue-400';
  }

  if (dropTarget.position === 'after') {
    return 'border-b-2 border-blue-400';
  }

  return '';
};

interface SubtreeExitDropTargetProps {
  kind: TreeNodeKind;
  id: string;
  dropTarget: TreeNodeDropTarget | null;
  onTreeNodeAfterDragOver: (event: DragEvent<HTMLElement>, targetKind: TreeNodeKind, targetId: string) => void;
  onTreeNodeAfterDrop: (event: DragEvent<HTMLElement>, targetKind: TreeNodeKind, targetId: string) => Promise<void>;
}

function SubtreeExitDropTarget({
  kind,
  id,
  dropTarget,
  onTreeNodeAfterDragOver,
  onTreeNodeAfterDrop,
}: SubtreeExitDropTargetProps): JSX.Element {
  const isActive = dropTarget?.kind === kind && dropTarget.id === id && dropTarget.position === 'after';

  return (
    <div
      data-testid={`tree-node-${kind}-${id}-exit-drop`}
      className={`my-0.5 h-2 rounded-full transition-colors ${
        isActive ? 'bg-blue-300/80' : 'bg-transparent hover:bg-blue-100/70'
      }`}
      onDragOver={(event) => onTreeNodeAfterDragOver(event, kind, id)}
      onDrop={(event) => {
        void onTreeNodeAfterDrop(event, kind, id);
      }}
    />
  );
}

interface DocumentTreeItemProps {
  state: WorkspaceState;
  document: DocumentRecord;
  activeDocumentId: string;
  editingId: string | null;
  sourceFolderId: string | null;
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

export function DocumentTreeItem({
  state,
  document,
  activeDocumentId,
  editingId,
  sourceFolderId,
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
}: DocumentTreeItemProps): JSX.Element {
  const isActive = document.id === activeDocumentId;
  const isDocEditing = editingId === document.id;
  const childFolders = getChildFolders(state, document.id);
  const childDocuments = getChildDocuments(state, document.id);
  const hasChildren = childFolders.length > 0 || childDocuments.length > 0;
  const isExpanded = state.expandedFolderIds.includes(document.id);
  const isDropTarget = dropTarget?.kind === 'document' && dropTarget.id === document.id && dropTarget.position === 'inside';
  const DocumentIcon = document.kind === 'spreadsheet' ? Table2 : FileText;

  return (
    <section className="space-y-0.5">
      <div
        data-testid={`tree-node-document-${document.id}`}
        role="button"
        tabIndex={0}
        draggable={!isDocEditing}
        className={`${documentRowClass} items-center justify-between cursor-pointer ${getDropPositionClass(dropTarget, 'document', document.id)} ${
          isDropTarget
            ? 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-200'
            : isActive
              ? activeDocRowClass
              : inactiveDocRowClass
        }`}
        onClick={() => onSelectDocument(document.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onSelectDocument(document.id);
          }
        }}
        onDragStart={(event) => {
          if (isDocEditing) {
            return;
          }

          const nextDragState = createDocumentDragState(document.id, sourceFolderId);
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(treeDragDataMime, JSON.stringify(nextDragState));
          onTreeDragStart(nextDragState);
        }}
        onDragEnd={onTreeDragEnd}
        onDragOver={(event) => onDocumentDragOver(event, document.id)}
        onDrop={(event) => {
          void onDocumentDrop(event, document.id);
        }}
      >
        <div className={treeRowContentClass}>
          <button
            type="button"
            aria-label={hasChildren ? `${document.title} ${isExpanded ? '折叠' : '展开'}` : `${document.title} 无子级`}
            className={`${treeChevronSlotClass} ${
              hasChildren ? 'hover:bg-slate-200/60 hover:text-slate-600' : 'pointer-events-none opacity-0'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) {
                onToggleFolder(document.id);
              }
            }}
            tabIndex={hasChildren ? 0 : -1}
          >
            {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </button>
          <span className={treeIconSlotClass}>
            <DocumentIcon
              size={14}
              className={`shrink-0 transition-colors duration-200 ${
                document.kind === 'spreadsheet'
                  ? isActive
                    ? 'text-emerald-600'
                    : 'text-emerald-500/75 group-hover:text-emerald-600'
                  : isActive
                    ? 'text-blue-500'
                    : 'text-slate-400 group-hover:text-slate-500'
              }`}
            />
          </span>
          {isDocEditing ? (
            <SidebarInlineEditInput
              defaultValue={document.title}
              onConfirm={(title) => onRenameDocument(document.id, title)}
              onCancel={onCancelEditing}
            />
          ) : (
            <span
              className={`${treeLabelClass} ${isActive ? 'font-semibold text-slate-700' : 'font-medium'}`}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartEditing(document.id);
              }}
            >
              {document.title}
            </span>
          )}
        </div>
        {!isDocEditing ? (
          <div
            data-testid={`document-actions-${document.id}`}
            className={treeActionGroupClass}
            onClick={(event) => event.stopPropagation()}
          >
            <SidebarActionMenu
              triggerLabel={`${document.title} 新建操作`}
              triggerTitle="新建"
              triggerIcon={<Plus size={13} />}
              items={[
                {
                  label: '新建文件',
                  icon: FilePlus2,
                  onClick: () => {
                    void onCreateDocument(document.id);
                  },
                },
                {
                  label: '新建 Excel',
                  icon: Table2,
                  onClick: () => {
                    void onCreateDocument(document.id, { kind: 'spreadsheet' });
                  },
                },
                {
                  label: '新建文件夹',
                  icon: FolderPlus,
                  onClick: () => {
                    void onCreateFolder(document.id);
                  },
                },
              ]}
            />
            <SidebarActionMenu
              triggerLabel={`${document.title} 更多操作`}
              triggerTitle="更多操作"
              triggerIcon={<Ellipsis size={13} />}
              items={[
                {
                  label: '重命名',
                  icon: Pencil,
                  onClick: () => onStartEditing(document.id),
                },
                {
                  label: '移动到空间',
                  icon: ArrowRightLeft,
                  onClick: () => onRequestMoveDocumentToSpace(document.id, document.title),
                },
                {
                  label: '删除',
                  icon: Trash2,
                  destructive: true,
                  onClick: () => {
                    if (window.confirm(`确定删除文档「${document.title}」吗？`)) {
                      void onDeleteDocument(document.id);
                    }
                  },
                },
              ]}
            />
          </div>
        ) : null}
      </div>
      {hasChildren && isExpanded ? (
        <div className={childTreeClass}>
          {getTreeItemsForContainer(state, document.id).map((item) => (
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
                sourceFolderId={document.id}
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
          {dragState ? (
            <SubtreeExitDropTarget
              kind="document"
              id={document.id}
              dropTarget={dropTarget}
              onTreeNodeAfterDragOver={onTreeNodeAfterDragOver}
              onTreeNodeAfterDrop={onTreeNodeAfterDrop}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface FolderSectionProps {
  folder: FolderNode;
  state: WorkspaceState;
  editingId: string | null;
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

export function FolderSection({
  folder,
  state,
  editingId,
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
}: FolderSectionProps): JSX.Element {
  const isExpanded = state.expandedFolderIds.includes(folder.id);
  const isEditing = editingId === folder.id;
  const isDropTarget = dropTarget?.kind === 'folder' && dropTarget.id === folder.id && dropTarget.position === 'inside';

  return (
    <section className="space-y-0.5">
      <div
        data-testid={`tree-node-folder-${folder.id}`}
        role="button"
        tabIndex={0}
        draggable={!isEditing}
        className={`${folderRowClass} ${getDropPositionClass(dropTarget, 'folder', folder.id)} ${
          isDropTarget
            ? 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-200'
            : 'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900'
        } justify-between cursor-pointer`}
        onClick={() => onToggleFolder(folder.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onToggleFolder(folder.id);
          }
        }}
        onDragStart={(event) => {
          if (isEditing) {
            return;
          }

          const nextDragState = createFolderDragState(folder.id);
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData(treeDragDataMime, JSON.stringify(nextDragState));
          onTreeDragStart(nextDragState);
        }}
        onDragEnd={onTreeDragEnd}
        onDragOver={(event) => onFolderDragOver(event, folder.id)}
        onDrop={(event) => {
          void onFolderDrop(event, folder.id);
        }}
      >
        <div className={treeRowContentClass}>
          <span className={`${treeChevronSlotClass} group-hover:text-slate-600`}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className={treeIconSlotClass}>
            <Folder
              size={14}
              className="shrink-0 text-amber-400 drop-shadow-sm transition-transform group-hover:scale-110"
              fill="currentColor"
              fillOpacity={0.2}
            />
          </span>
          {isEditing ? (
            <SidebarInlineEditInput
              defaultValue={folder.name}
              onConfirm={(name) => onRenameFolder(folder.id, name)}
              onCancel={onCancelEditing}
            />
          ) : (
            <span
              className={`${treeLabelClass} font-medium`}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartEditing(folder.id);
              }}
            >
              {folder.name}
            </span>
          )}
        </div>
        {!isEditing ? (
          <div
            data-testid={`folder-actions-${folder.id}`}
            className={treeActionGroupClass}
            onClick={(event) => event.stopPropagation()}
          >
            <SidebarActionMenu
              triggerLabel={`${folder.name} 新建操作`}
              triggerTitle="新建"
              triggerIcon={<Plus size={13} />}
              items={[
                {
                  label: '新建文件',
                  icon: FilePlus2,
                  onClick: () => {
                    void onCreateDocument(folder.id);
                  },
                },
                {
                  label: '新建 Excel',
                  icon: Table2,
                  onClick: () => {
                    void onCreateDocument(folder.id, { kind: 'spreadsheet' });
                  },
                },
                {
                  label: '新建文件夹',
                  icon: FolderPlus,
                  onClick: () => {
                    void onCreateFolder(folder.id);
                  },
                },
              ]}
            />
            <SidebarActionMenu
              triggerLabel={`${folder.name} 更多操作`}
              triggerTitle="更多操作"
              triggerIcon={<Ellipsis size={13} />}
              items={[
                {
                  label: '重命名',
                  icon: Pencil,
                  onClick: () => onStartEditing(folder.id),
                },
                {
                  label: '移动到空间',
                  icon: ArrowRightLeft,
                  onClick: () => onRequestMoveFolderToSpace(folder.id, folder.name),
                },
                {
                  label: '删除',
                  icon: Trash2,
                  destructive: true,
                  onClick: () => {
                    if (window.confirm(`确定删除文件夹「${folder.name}」及其中所有内容吗？`)) {
                      void onDeleteFolder(folder.id);
                    }
                  },
                },
              ]}
            />
          </div>
        ) : null}
      </div>
      {isExpanded ? (
        <div className={childTreeClass}>
          {getTreeItemsForContainer(state, folder.id).map((item) => (
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
                activeDocumentId={state.activeDocumentId}
                editingId={editingId}
                sourceFolderId={folder.id}
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
          {dragState ? (
            <SubtreeExitDropTarget
              kind="folder"
              id={folder.id}
              dropTarget={dropTarget}
              onTreeNodeAfterDragOver={onTreeNodeAfterDragOver}
              onTreeNodeAfterDrop={onTreeNodeAfterDrop}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
