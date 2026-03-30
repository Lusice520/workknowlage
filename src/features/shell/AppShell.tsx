import type { EditorHostShareInfo } from '../editor-host/EditorHost';
import type { WorkKnowlageRuntimeStatus } from '../../shared/lib/workKnowlageApi';
import type {
  TrashItemRecord,
  WorkKnowlageStorageInfo,
  WorkspaceSearchResultRecord,
} from '../../shared/types/preload';
import { LeftSidebar } from './LeftSidebar';
import { CenterPane } from './CenterPane';
import { RightSidebar } from './RightSidebar';
import { SettingsModal } from './SettingsModal';
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

interface AppShellProps {
  activeDocument: DocumentRecord | null;
  activeQuickNote: QuickNoteRecord | null;
  activeQuickNoteDate: string | null;
  activeFolder: FolderNode | null;
  activeSpace: Space | null;
  state: WorkspaceState;
  editingId: string | null;
  documentFocusTarget?: DocumentFocusTarget | null;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
  onSaveQuickNoteContent: (noteDate: string, contentJson: string) => Promise<QuickNoteRecord>;
  onCaptureQuickNote: (noteDate: string) => Promise<unknown>;
  onUploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  onUploadQuickNoteFiles: (quickNoteId: string, files: File[]) => Promise<string[]>;
  onShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onRegenerateShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onDisableShareDocument: (documentId: string) => Promise<void> | void;
  onExportMarkdown: () => Promise<void> | void;
  onExportPdf: () => Promise<void> | void;
  onExportWord: () => Promise<void> | void;
  exportBusy: boolean;
  exportStatusText?: string | null;
  onActiveDocumentContentSnapshotReady?: (getContentJson: () => string) => void;
  shareInfo?: EditorHostShareInfo | null;
  shareBusy?: boolean;
  shareLoading?: boolean;
  shareStatusText?: string | null;
  runtimeStatus: WorkKnowlageRuntimeStatus;
  storageInfo?: WorkKnowlageStorageInfo | null;
  persistenceFeedback: string;
  lastPersistedAt?: string | null;
  dataToolsFeedback?: string | null;
  runningDataTool?: string | null;
  trashItems: TrashItemRecord[];
  settingsOpen: boolean;
  quickNoteRefreshKey?: number;
  selectedQuickNoteDate: string;
  searchQuery: string;
  searchResults: WorkspaceSearchResultRecord[];
  searchLoading: boolean;
  onSelectDocument: (documentId: string) => void;
  onSelectCollectionView: (view: Exclude<WorkspaceCollectionView, 'tree'>) => void;
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
  onOpenDataDirectory: () => Promise<void>;
  onCreateBackup: () => Promise<void>;
  onRestoreBackup: () => Promise<void>;
  onRebuildSearchIndex: () => Promise<void>;
  onCleanupOrphanAttachments: () => Promise<void>;
  onOpenTrash: () => Promise<void> | void;
  onRestoreTrashItem: (trashRootId: string) => Promise<void> | void;
  onDeleteTrashItem: (trashRootId: string) => Promise<void> | void;
  onEmptyTrash: () => Promise<void> | void;
  onOpenSettings: () => Promise<void> | void;
  onCloseSettings: () => Promise<void> | void;
  onAddTagToDocument: (documentId: string, label: string) => Promise<void>;
  onRemoveTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  onSetDocumentFavorite: (documentId: string, isFavorite: boolean) => Promise<void>;
  onOpenBacklinkDocument: (target: DocumentNavigationTarget) => void;
}

export function AppShell({
  activeDocument,
  activeQuickNote,
  activeQuickNoteDate,
  activeFolder,
  activeSpace,
  state,
  editingId,
  documentFocusTarget,
  onSaveDocumentContent,
  onSaveQuickNoteContent,
  onCaptureQuickNote,
  onUploadFiles,
  onUploadQuickNoteFiles,
  onShareDocument,
  onRegenerateShareDocument,
  onDisableShareDocument,
  onExportMarkdown,
  onExportPdf,
  onExportWord,
  exportBusy,
  exportStatusText,
  onActiveDocumentContentSnapshotReady,
  shareInfo,
  shareBusy,
  shareLoading,
  shareStatusText,
  runtimeStatus,
  storageInfo,
  persistenceFeedback,
  lastPersistedAt,
  dataToolsFeedback,
  runningDataTool,
  trashItems,
  settingsOpen,
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
  onOpenDataDirectory,
  onCreateBackup,
  onRestoreBackup,
  onRebuildSearchIndex,
  onCleanupOrphanAttachments,
  onOpenTrash,
  onRestoreTrashItem,
  onDeleteTrashItem,
  onEmptyTrash,
  onOpenSettings,
  onCloseSettings,
  onAddTagToDocument,
  onRemoveTagFromDocument,
  onSetDocumentFavorite,
  onOpenBacklinkDocument,
}: AppShellProps) {
  return (
    <main
      data-testid="app-shell"
      data-scroll-mode="locked"
      data-shell-style="lightweight"
      data-typography="editorial-compact"
      className="relative h-screen overflow-hidden bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] p-2 text-slate-800"
    >
      <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[40%] w-[30%] rounded-full bg-blue-300/20 blur-[120px]"></div>
      <div className="pointer-events-none absolute -bottom-[10%] -right-[5%] h-[40%] w-[30%] rounded-full bg-indigo-300/20 blur-[120px]"></div>
      <div className="relative z-10 h-full">
        <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_320px] gap-2">
          <LeftSidebar
            activeSpace={activeSpace}
            state={state}
            editingId={editingId}
            quickNoteRefreshKey={quickNoteRefreshKey}
            selectedQuickNoteDate={selectedQuickNoteDate}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searchLoading={searchLoading}
            onSelectDocument={onSelectDocument}
            onSelectCollectionView={onSelectCollectionView}
            onSearchQueryChange={onSearchQueryChange}
            onSelectSearchResult={onSelectSearchResult}
            onSelectQuickNoteDate={onSelectQuickNoteDate}
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
            onCreateSpace={onCreateSpace}
            onRenameSpace={onRenameSpace}
            onDeleteSpace={onDeleteSpace}
            onSwitchSpace={onSwitchSpace}
            onOpenTrash={onOpenTrash}
            onOpenSettings={onOpenSettings}
          />
          <CenterPane
            activeDocument={activeDocument}
            activeQuickNoteDate={activeQuickNoteDate}
            selectedQuickNoteDate={selectedQuickNoteDate}
            activeFolder={activeFolder}
            activeSpace={activeSpace}
            activeCollectionView={state.activeCollectionView ?? 'tree'}
            documents={state.seed.documents}
            folders={state.seed.folders}
            trashItems={trashItems}
            onSaveDocumentContent={onSaveDocumentContent}
            onSaveQuickNoteContent={onSaveQuickNoteContent}
            onCaptureQuickNote={onCaptureQuickNote}
            onUploadFiles={onUploadFiles}
            onUploadQuickNoteFiles={onUploadQuickNoteFiles}
            onOpenDocument={onSelectDocument}
            onSetDocumentFavorite={onSetDocumentFavorite}
            onRestoreTrashItem={onRestoreTrashItem}
            onDeleteTrashItem={onDeleteTrashItem}
            onEmptyTrash={onEmptyTrash}
            onShareDocument={onShareDocument}
            onRegenerateShareDocument={onRegenerateShareDocument}
            onDisableShareDocument={onDisableShareDocument}
            onExportMarkdown={onExportMarkdown}
            onExportPdf={onExportPdf}
            onExportWord={onExportWord}
            exportBusy={exportBusy}
            exportStatusText={exportStatusText}
            onActiveDocumentContentSnapshotReady={onActiveDocumentContentSnapshotReady}
            shareInfo={shareInfo}
            shareBusy={shareBusy}
            shareLoading={shareLoading}
            shareStatusText={shareStatusText}
            documentFocusTarget={documentFocusTarget}
          />
          <RightSidebar
            activeDocument={activeDocument}
            activeQuickNote={activeQuickNote}
            activeFolder={activeFolder}
            activeSpace={activeSpace}
            onAddTagToDocument={onAddTagToDocument}
            onRemoveTagFromDocument={onRemoveTagFromDocument}
            onOpenBacklinkDocument={onOpenBacklinkDocument}
          />
        </div>
      </div>
      <SettingsModal
        open={settingsOpen}
        runtimeStatus={runtimeStatus}
        persistenceFeedback={persistenceFeedback}
        storageInfo={storageInfo}
        lastPersistedAt={lastPersistedAt}
        dataToolsFeedback={dataToolsFeedback}
        runningDataTool={runningDataTool}
        onClose={onCloseSettings}
        onOpenDataDirectory={onOpenDataDirectory}
        onCreateBackup={onCreateBackup}
        onRestoreBackup={onRestoreBackup}
        onRebuildSearchIndex={onRebuildSearchIndex}
        onCleanupOrphanAttachments={onCleanupOrphanAttachments}
      />
    </main>
  );
}
