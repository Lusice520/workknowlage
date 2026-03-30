import { type DragEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { getChildDocuments, getChildFolders, getDocumentsForFolder } from '../../shared/lib/workspaceSelectors';
import type { DocumentRecord, FolderNode, WorkspaceState } from '../../shared/types/workspace';
import {
  createDocumentDragState,
  createFolderDragState,
  type TreeDragState,
  treeDragDataMime,
} from './sidebarTreeDnd';
import { SidebarActionMenu } from './SidebarActionMenu';
import { SidebarInlineEditInput } from './SidebarInlineEditInput';

const folderRowClass =
  'group flex w-full items-center gap-1.5 rounded-[10px] px-2 py-1.5 transition-all duration-200';
const documentRowClass =
  'group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-all duration-200 relative';
const activeDocRowClass =
  'bg-blue-50/60 text-blue-700 font-semibold before:absolute before:inset-y-1 before:left-[-6px] before:w-0.5 before:rounded-full before:bg-blue-500 before:content-[""]';
const inactiveDocRowClass =
  'text-slate-500 hover:bg-slate-100/50 hover:text-slate-800';
const treeActionGroupClass =
  'flex shrink-0 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto';

interface DocumentTreeItemProps {
  state: WorkspaceState;
  document: DocumentRecord;
  activeDocumentId: string;
  editingId: string | null;
  sourceFolderId: string | null;
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

export function DocumentTreeItem({
  state,
  document,
  activeDocumentId,
  editingId,
  sourceFolderId,
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
}: DocumentTreeItemProps): JSX.Element {
  const isActive = document.id === activeDocumentId;
  const isDocEditing = editingId === document.id;
  const childFolders = getChildFolders(state, document.id);
  const childDocuments = getChildDocuments(state, document.id);
  const hasChildren = childFolders.length > 0 || childDocuments.length > 0;
  const isExpanded = state.expandedFolderIds.includes(document.id);
  const isDropTarget = dropTargetFolderId === document.id;

  return (
    <section className="space-y-0.5">
      <div
        role="button"
        tabIndex={0}
        draggable={!isDocEditing}
        className={`${documentRowClass} items-center justify-between cursor-pointer ${
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            aria-label={hasChildren ? `${document.title} ${isExpanded ? '折叠' : '展开'}` : `${document.title} 无子级`}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 transition-colors ${
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
          <FileText
            size={14}
            className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'}`}
          />
          {isDocEditing ? (
            <SidebarInlineEditInput
              defaultValue={document.title}
              onConfirm={(title) => onRenameDocument(document.id, title)}
              onCancel={onCancelEditing}
            />
          ) : (
            <span
              className={`truncate text-[12px] leading-[1.25] tracking-[0.01em] ${isActive ? 'font-semibold' : 'font-medium'}`}
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
        <div className="relative ml-[15px] space-y-0.5 border-l border-slate-200/60 pl-2.5 pt-0.5 transition-all duration-300">
          {childFolders.map((childFolder) => (
            <FolderSection
              key={childFolder.id}
              folder={childFolder}
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
          {childDocuments.map((childDocument) => (
            <DocumentTreeItem
              key={childDocument.id}
              state={state}
              document={childDocument}
              activeDocumentId={activeDocumentId}
              editingId={editingId}
              sourceFolderId={document.id}
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
      ) : null}
    </section>
  );
}

interface FolderSectionProps {
  folder: FolderNode;
  state: WorkspaceState;
  editingId: string | null;
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

export function FolderSection({
  folder,
  state,
  editingId,
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
}: FolderSectionProps): JSX.Element {
  const isExpanded = state.expandedFolderIds.includes(folder.id);
  const documents = getDocumentsForFolder(state, folder.id);
  const isEditing = editingId === folder.id;
  const isDropTarget = dropTargetFolderId === folder.id;

  return (
    <section className="space-y-0.5">
      <div
        role="button"
        tabIndex={0}
        draggable={!isEditing}
        className={`${folderRowClass} ${
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
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-transform group-hover:text-slate-600">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Folder
            size={14}
            className="shrink-0 text-amber-400 drop-shadow-sm transition-transform group-hover:scale-110"
            fill="currentColor"
            fillOpacity={0.2}
          />
          {isEditing ? (
            <SidebarInlineEditInput
              defaultValue={folder.name}
              onConfirm={(name) => onRenameFolder(folder.id, name)}
              onCancel={onCancelEditing}
            />
          ) : (
            <span
              className="truncate text-[12px] font-medium leading-[1.25] tracking-[0.01em]"
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
        <div className="relative ml-[15px] space-y-0.5 border-l border-slate-200/60 pl-2.5 pt-0.5 transition-all duration-300">
          {getChildFolders(state, folder.id).map((childFolder) => (
            <FolderSection
              key={childFolder.id}
              folder={childFolder}
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
          {documents.map((document) => (
            <DocumentTreeItem
              key={document.id}
              state={state}
              document={document}
              activeDocumentId={state.activeDocumentId}
              editingId={editingId}
              sourceFolderId={folder.id}
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
      ) : null}
    </section>
  );
}
