import { useState, type DragEvent } from 'react';
import { MantineProvider } from '@mantine/core';
import { ChevronsUpDown, FileText, Star } from 'lucide-react';
import { getRootDocuments, getRootFolders } from '../../shared/lib/workspaceSelectors';
import type { WorkspaceSearchResultRecord } from '../../shared/types/preload';
import type { Space, WorkspaceCollectionView, WorkspaceState } from '../../shared/types/workspace';
import { SidebarQuickNotePanel } from './SidebarQuickNotePanel';
import { SidebarRootSection } from './SidebarRootSection';
import { SpaceSwitcher } from './SpaceSwitcher';
import { WorkspaceSearch, type WorkspaceSearchResult } from './WorkspaceSearch';
import {
  isInvalidDocumentDropTarget,
  isInvalidFolderDropTarget,
  isInvalidRootDropTarget,
  readTreeDragState,
  type TreeDragState,
} from './sidebarTreeDnd';

const navRowClass =
  'group flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-[12px] font-medium leading-none tracking-[-0.01em] transition-all duration-300 relative overflow-hidden';
const activeNavRowClass =
  'bg-blue-50/80 text-blue-700 shadow-sm before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-r-full before:bg-blue-500 before:content-[""]';
const inactiveNavRowClass =
  'text-slate-600 hover:bg-slate-100/60 hover:text-slate-900';
const compactTextStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};
interface LeftSidebarProps {
  activeSpace: Space | null;
  state: WorkspaceState;
  editingId: string | null;
  quickNoteRefreshKey?: number;
  selectedQuickNoteDate: string;
  searchQuery: string;
  searchResults: WorkspaceSearchResultRecord[];
  searchLoading: boolean;
  onSelectDocument: (documentId: string) => void;
  onSelectCollectionView?: (view: Exclude<WorkspaceCollectionView, 'tree'>) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectSearchResult: (result: WorkspaceSearchResultRecord) => void;
  onSelectQuickNoteDate: (dateKey: string) => void;
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
  onCreateSpace: (name: string) => Promise<void>;
  onRenameSpace: (spaceId: string, newName: string) => Promise<void>;
  onDeleteSpace: (spaceId: string) => Promise<void>;
  onSwitchSpace: (spaceId: string) => Promise<void>;
  onOpenTrash?: () => Promise<void> | void;
  onOpenSettings?: () => Promise<void> | void;
}

export function LeftSidebar({
  activeSpace,
  state,
  editingId,
  quickNoteRefreshKey,
  selectedQuickNoteDate,
  searchQuery,
  searchResults,
  searchLoading,
  onSelectDocument,
  onSelectCollectionView,
  onSearchQueryChange,
  onSelectSearchResult,
  onSelectQuickNoteDate,
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
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  onSwitchSpace,
  onOpenTrash = async () => {},
  onOpenSettings = async () => {},
}: LeftSidebarProps): JSX.Element {
  const rootDocuments = getRootDocuments(state);
  const rootFolders = getRootFolders(state);
  const [spaceSwitcherOpen, setSpaceSwitcherOpen] = useState(false);
  const [dragState, setDragState] = useState<TreeDragState>(null);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  const compactSearchResults: WorkspaceSearchResult[] = searchResults.map((result) => ({
    id: result.id,
    kind: result.kind,
    title: result.title,
    preview: result.preview,
  }));

  const handleSelectWorkspaceSearchResult = (result: WorkspaceSearchResult) => {
    const fullResult = searchResults.find((item) => item.id === result.id && item.kind === result.kind);
    if (fullResult) {
      onSelectSearchResult(fullResult);
    }
  };

  const resetTreeDragState = () => {
    setDragState(null);
    setDropTargetNodeId(null);
    setRootDropActive(false);
  };

  const handleTreeDragStart = (nextDragState: Exclude<TreeDragState, null>) => {
    setDragState(nextDragState);
    setDropTargetNodeId(null);
    setRootDropActive(false);
  };

  const handleCloseSpaceSwitcher = () => {
    setSpaceSwitcherOpen(false);
  };

  const handleFolderDragOver = (event: DragEvent<HTMLElement>, folderId: string) => {
    const nextDragState = readTreeDragState(event, dragState);
    event.stopPropagation();
    if (isInvalidFolderDropTarget(state, nextDragState, folderId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (!dragState) {
      setDragState(nextDragState);
    }
    if (dropTargetNodeId !== folderId) {
      setDropTargetNodeId(folderId);
    }
    if (rootDropActive) {
      setRootDropActive(false);
    }
  };

  const handleFolderDrop = async (event: DragEvent<HTMLElement>, folderId: string) => {
    const nextDragState = readTreeDragState(event, dragState);
    event.preventDefault();
    event.stopPropagation();
    if (isInvalidFolderDropTarget(state, nextDragState, folderId)) {
      resetTreeDragState();
      return;
    }

    resetTreeDragState();

    if (nextDragState?.kind === 'document') {
      await onMoveDocument(nextDragState.id, folderId);
      return;
    }

    if (nextDragState?.kind === 'folder') {
      await onMoveFolder(nextDragState.id, folderId);
    }
  };

  const handleDocumentDragOver = (event: DragEvent<HTMLElement>, documentId: string) => {
    const nextDragState = readTreeDragState(event, dragState);
    event.stopPropagation();
    if (isInvalidDocumentDropTarget(state, nextDragState, documentId)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (!dragState) {
      setDragState(nextDragState);
    }
    if (dropTargetNodeId !== documentId) {
      setDropTargetNodeId(documentId);
    }
    if (rootDropActive) {
      setRootDropActive(false);
    }
  };

  const handleDocumentDrop = async (event: DragEvent<HTMLElement>, documentId: string) => {
    const nextDragState = readTreeDragState(event, dragState);
    event.preventDefault();
    event.stopPropagation();
    if (isInvalidDocumentDropTarget(state, nextDragState, documentId)) {
      resetTreeDragState();
      return;
    }

    resetTreeDragState();

    if (nextDragState?.kind === 'document') {
      await onMoveDocument(nextDragState.id, documentId);
      return;
    }

    if (nextDragState?.kind === 'folder') {
      await onMoveFolder(nextDragState.id, documentId);
    }
  };

  const handleRootDragOver = (event: DragEvent<HTMLDivElement>) => {
    const nextDragState = readTreeDragState(event as DragEvent<HTMLElement>, dragState);
    if (isInvalidRootDropTarget(state, nextDragState)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    if (!dragState) {
      setDragState(nextDragState);
    }
    setDropTargetNodeId(null);
    if (!rootDropActive) {
      setRootDropActive(true);
    }
  };

  const handleRootDrop = async (event: DragEvent<HTMLDivElement>) => {
    const nextDragState = readTreeDragState(event as DragEvent<HTMLElement>, dragState);
    if (isInvalidRootDropTarget(state, nextDragState) || !nextDragState) {
      resetTreeDragState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resetTreeDragState();

    if (nextDragState.kind === 'document') {
      await onMoveDocument(nextDragState.id, null);
      return;
    }

    await onMoveFolder(nextDragState.id, null);
  };

  return (
    <MantineProvider>
      <aside
        data-testid="left-sidebar"
        className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/40 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/5 backdrop-blur-2xl transition-all"
      >
        <div className="relative">
          <button
            type="button"
            data-testid="space-switcher-trigger"
            className="group block w-full cursor-pointer rounded-[16px] border border-white/80 bg-white/70 p-3 text-left shadow-sm transition-all duration-300 hover:border-slate-200/60 hover:bg-white hover:shadow-md"
            onClick={() => setSpaceSwitcherOpen((current) => !current)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-blue-500/40">
                <span className="text-[14px] font-bold text-white drop-shadow-md">
                  {(activeSpace?.name ?? '个')[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold tracking-tight text-slate-800" style={compactTextStyle}>
                  {activeSpace?.name ?? '个人工作空间'}
                </p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {activeSpace?.label ?? 'WORKSPACE'}
                </p>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <ChevronsUpDown
                  size={14}
                  className={`transition-transform ${spaceSwitcherOpen ? 'rotate-180' : ''} group-hover:scale-110`}
                />
              </div>
            </div>
          </button>

          {spaceSwitcherOpen ? (
            <SpaceSwitcher
              spaces={state.seed.spaces}
              activeSpaceId={state.activeSpaceId}
              onSwitchSpace={onSwitchSpace}
              onCreateSpace={onCreateSpace}
              onRenameSpace={onRenameSpace}
              onDeleteSpace={onDeleteSpace}
              onOpenTrash={onOpenTrash}
              onOpenSettings={onOpenSettings}
              onClose={handleCloseSpaceSwitcher}
            />
          ) : null}
        </div>

        <div className="mt-4">
          <WorkspaceSearch
            query={searchQuery}
            results={compactSearchResults}
            isLoading={searchLoading}
            onQueryChange={onSearchQueryChange}
            onSelectResult={handleSelectWorkspaceSearchResult}
          />
        </div>

        <nav className="relative mt-4 space-y-1">
          {state.seed.quickLinks.map((item) => {
            const isActive = state.activeCollectionView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                className={`${navRowClass} ${isActive ? activeNavRowClass : inactiveNavRowClass}`}
                onClick={() => {
                  if (item.id === 'all-notes' || item.id === 'favorites') {
                    onSelectCollectionView?.(item.id);
                  }
                }}
              >
                <div
                  className={`flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'
                  }`}
                >
                  {item.id === 'favorites' ? (
                    <Star size={16} fill={isActive ? 'currentColor' : 'none'} />
                  ) : (
                    <FileText size={16} />
                  )}
                </div>
                <span className="truncate text-[12px] font-medium tracking-[0.01em]">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
          <SidebarRootSection
            rootDocuments={rootDocuments}
            rootFolders={rootFolders}
            rootDropActive={rootDropActive}
            onRootDragOver={handleRootDragOver}
            onRootDrop={(event) => {
              void handleRootDrop(event);
            }}
            state={state}
            editingId={editingId}
            activeDocumentId={state.activeDocumentId}
            dragState={dragState}
            dropTargetFolderId={dropTargetNodeId}
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
            onTreeDragStart={handleTreeDragStart}
            onTreeDragEnd={resetTreeDragState}
            onFolderDragOver={handleFolderDragOver}
            onFolderDrop={handleFolderDrop}
            onDocumentDragOver={handleDocumentDragOver}
            onDocumentDrop={handleDocumentDrop}
          />
        </div>

        <SidebarQuickNotePanel
          activeSpace={activeSpace}
          refreshKey={quickNoteRefreshKey}
          selectedDate={selectedQuickNoteDate}
          onSelectDate={onSelectQuickNoteDate}
        />
      </aside>
    </MantineProvider>
  );
}
