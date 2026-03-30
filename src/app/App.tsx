import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../features/shell/AppShell';
import { prefetchQuickNoteRecord } from '../features/shell/quickNoteCache';
import { getActiveDocument, getActiveSpace, getFolderById } from '../shared/lib/workspaceSelectors';
import { getWorkKnowlageApi, getWorkKnowlageRuntimeStatus } from '../shared/lib/workKnowlageApi';
import type { TrashItemRecord, WorkspaceSearchResultRecord } from '../shared/types/preload';
import type {
  DocumentFocusTarget,
  DocumentNavigationTarget,
  QuickNoteRecord,
} from '../shared/types/workspace';
import { useDocumentShare } from './useDocumentShare';
import { useDocumentExport } from './useDocumentExport';
import { useWorkspaceSearch } from './useWorkspaceSearch';
import { useWorkspaceSession } from './useWorkspaceSession';

export default function App() {
  const runtimeStatus = getWorkKnowlageRuntimeStatus();
  const session = useWorkspaceSession(runtimeStatus);
  const [dataToolsFeedback, setDataToolsFeedback] = useState<string | null>(null);
  const [runningDataTool, setRunningDataTool] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItemRecord[]>([]);
  const [activeQuickNote, setActiveQuickNote] = useState<QuickNoteRecord | null>(null);
  const [documentFocusTarget, setDocumentFocusTarget] = useState<DocumentFocusTarget | null>(null);
  const [activeDocumentContentSnapshotGetter, setActiveDocumentContentSnapshotGetter] = useState<(() => string) | null>(null);
  const documentFocusRequestKeyRef = useRef(0);
  const search = useWorkspaceSearch({
    activeSpaceId: session.workspaceState?.activeSpaceId,
    documents: session.workspaceState?.seed.documents,
    refreshKey: session.quickNoteRefreshKey,
  });
  const share = useDocumentShare({
    activeDocumentId: session.activeQuickNoteDate
      ? null
      : session.workspaceState?.activeDocumentId ?? null,
    activeQuickNoteDate: session.activeQuickNoteDate,
    onSaveDocumentContent: session.saveDocumentContent,
  });
  const activeSpaceId = session.workspaceState?.activeSpaceId ?? null;

  const loadTrashItems = async (spaceId: string | null) => {
    if (!spaceId) {
      setTrashItems([]);
      return [];
    }

    const nextItems = await getWorkKnowlageApi().workspace?.getTrash?.(spaceId) ?? [];
    setTrashItems(nextItems);
    return nextItems;
  };

  useEffect(() => {
    void loadTrashItems(activeSpaceId);
  }, [activeSpaceId]);

  useEffect(() => {
    if (!session.activeQuickNoteDate) {
      setActiveQuickNote(null);
      return;
    }

    let cancelled = false;
    void prefetchQuickNoteRecord(session.activeQuickNoteDate)
      .then((note) => {
        if (!cancelled) {
          setActiveQuickNote(note);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveQuickNote(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session.activeQuickNoteDate, session.quickNoteRefreshKey]);

  const workspaceState = session.workspaceState;
  const activeCollectionView = workspaceState?.activeCollectionView ?? 'tree';
  const selectedDocument = workspaceState ? getActiveDocument(workspaceState) : null;
  const activeDocument = session.activeQuickNoteDate || activeCollectionView !== 'tree'
    ? null
    : selectedDocument;
  const activeFolder = activeDocument?.folderId && workspaceState
    ? getFolderById(workspaceState, activeDocument.folderId)
    : null;
  const exportState = useDocumentExport({
    activeDocumentId: activeDocument?.id ?? null,
    activeDocumentTitle: activeDocument?.title ?? null,
    activeQuickNoteDate: session.activeQuickNoteDate,
    getCurrentContentJson: activeDocumentContentSnapshotGetter ?? (() => activeDocument?.contentJson ?? '[]'),
    onSaveDocumentContent: session.saveDocumentContent,
  });

  const handleActiveDocumentContentSnapshotReady = useCallback((getContentJson: () => string) => {
    setActiveDocumentContentSnapshotGetter(() => getContentJson);
  }, []);

  useEffect(() => {
    setActiveDocumentContentSnapshotGetter(() => () => activeDocument?.contentJson ?? '[]');
  }, [activeDocument?.contentJson, activeDocument?.id]);

  if (session.loading || !workspaceState) {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">正在加载工作空间...</p>
        </div>
      </main>
    );
  }

  const activeSpace = getActiveSpace(workspaceState);

  const clearDocumentFocusTarget = () => {
    setDocumentFocusTarget(null);
  };

  const handleOpenDocument = (
    documentId: string,
    options?: Parameters<typeof session.openDocument>[1],
  ) => {
    clearDocumentFocusTarget();
    void session.openDocument(documentId, options);
  };

  const handleOpenDocumentTarget = (
    target: DocumentNavigationTarget,
    options?: Parameters<typeof session.openDocument>[1],
  ) => {
    if (target.blockId) {
      documentFocusRequestKeyRef.current += 1;
      setDocumentFocusTarget({
        documentId: target.documentId,
        blockId: target.blockId,
        requestKey: documentFocusRequestKeyRef.current,
      });
    } else {
      clearDocumentFocusTarget();
    }

    void session.openDocument(target.documentId, options);
  };

  const handleSelectSearchResult = (result: WorkspaceSearchResultRecord) => {
    search.clearSearch();

    if (result.kind === 'quick-note' && result.noteDate) {
      session.selectQuickNoteDate(result.noteDate);
      return;
    }

    const nextDocumentId = result.documentId ?? result.id;
    if (result.folderId) {
      handleOpenDocument(nextDocumentId, {
        ensureExpandedFolderIds: [result.folderId],
      });
      return;
    }

    handleOpenDocument(nextDocumentId);
  };

  const handleCreateSpace = async (name: string) => {
    await session.createSpace(name);
    search.clearSearch();
    clearDocumentFocusTarget();
  };

  const handleSaveQuickNoteContent = async (noteDate: string, contentJson: string) => {
    const nextNote = await session.saveQuickNoteContent(noteDate, contentJson);
    setActiveQuickNote(nextNote);
    return nextNote;
  };

  const handleCaptureQuickNote = async (noteDate: string) => {
    const nextDocument = await session.captureQuickNoteToDocument(noteDate);
    if (nextDocument) {
      setActiveQuickNote(null);
    }
    return nextDocument;
  };

  const handleDeleteSpace = async (spaceId: string) => {
    await session.deleteSpace(spaceId);
    search.clearSearch();
    clearDocumentFocusTarget();
  };

  const handleSwitchSpace = async (spaceId: string) => {
    await session.switchSpace(spaceId);
    search.clearSearch();
    setSettingsOpen(false);
    clearDocumentFocusTarget();
  };

  const runDataTool = async (
    label: string,
    action: () => Promise<{ message: string } | null | undefined> | undefined,
    options: {
      reloadWorkspace?: boolean;
      clearSearch?: boolean;
    } = {},
  ) => {
    setRunningDataTool(label);

    try {
      const result = await action();
      if (options.reloadWorkspace) {
        const nextState = await session.reloadWorkspaceState({
          activeCollectionView: 'tree',
        });
        await loadTrashItems(nextState.activeSpaceId);
      }
      if (options.clearSearch) {
        search.clearSearch();
      }
      setDataToolsFeedback(result?.message ?? `${label}已完成`);
    } catch (error) {
      setDataToolsFeedback(error instanceof Error ? error.message : `${label}失败`);
    } finally {
      setRunningDataTool(null);
    }
  };

  const handleOpenDataDirectory = async () => {
    await runDataTool('打开数据目录', () => getWorkKnowlageApi().maintenance?.openDataDirectory());
  };

  const handleCreateBackup = async () => {
    await runDataTool('创建备份', () => getWorkKnowlageApi().maintenance?.createBackup());
  };

  const handleRestoreBackup = async () => {
    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('从备份恢复会整包覆盖当前本地数据，确定继续吗？')
    ) {
      return;
    }

    await runDataTool(
      '从备份恢复',
      () => getWorkKnowlageApi().maintenance?.restoreBackup(),
      { reloadWorkspace: true, clearSearch: true },
    );
  };

  const handleRebuildSearchIndex = async () => {
    await runDataTool('重建搜索索引', () => getWorkKnowlageApi().maintenance?.rebuildSearchIndex());
  };

  const handleCleanupOrphanAttachments = async () => {
    await runDataTool('清理孤儿附件', () => getWorkKnowlageApi().maintenance?.cleanupOrphanAttachments());
  };

  const handleOpenTrash = async () => {
    await loadTrashItems(activeSpaceId);
    session.selectCollectionView('trash');
    setSettingsOpen(false);
  };

  const handleRestoreTrashItem = async (trashRootId: string) => {
    if (!activeSpaceId) {
      return;
    }

    await getWorkKnowlageApi().workspace?.restoreTrashItem?.(activeSpaceId, trashRootId);
    await session.reloadWorkspaceState({ activeCollectionView: 'trash' });
    await loadTrashItems(activeSpaceId);
  };

  const handleDeleteTrashItem = async (trashRootId: string) => {
    if (!activeSpaceId) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('彻底删除后将无法恢复，相关附件也会一并清理，确定继续吗？')
    ) {
      return;
    }

    await getWorkKnowlageApi().workspace?.deleteTrashItem?.(activeSpaceId, trashRootId);
    await session.reloadWorkspaceState({ activeCollectionView: 'trash' });
    await loadTrashItems(activeSpaceId);
  };

  const handleEmptyTrash = async () => {
    if (!activeSpaceId) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('清空回收站后将无法恢复，相关附件也会一并清理，确定继续吗？')
    ) {
      return;
    }

    await getWorkKnowlageApi().workspace?.emptyTrash?.(activeSpaceId);
    await session.reloadWorkspaceState({ activeCollectionView: 'trash' });
    await loadTrashItems(activeSpaceId);
  };

  return (
    <AppShell
      activeDocument={activeDocument}
      activeQuickNote={activeQuickNote}
      activeQuickNoteDate={session.activeQuickNoteDate}
      activeFolder={activeFolder}
      activeSpace={activeSpace}
      state={workspaceState}
      editingId={session.editingId}
      documentFocusTarget={documentFocusTarget}
      onSaveQuickNoteContent={handleSaveQuickNoteContent}
      onCaptureQuickNote={handleCaptureQuickNote}
      onSaveDocumentContent={session.saveDocumentContent}
      onUploadFiles={session.uploadFiles}
      onUploadQuickNoteFiles={session.uploadQuickNoteFiles}
      onShareDocument={share.shareDocument}
      onRegenerateShareDocument={share.regenerateShareDocument}
      onDisableShareDocument={share.disableShareDocument}
      onExportMarkdown={exportState.exportMarkdown}
      onExportPdf={exportState.exportPdf}
      onExportWord={exportState.exportWord}
      exportBusy={exportState.exportBusy}
      exportStatusText={exportState.exportStatusText}
      shareInfo={share.shareInfo ? { token: share.shareInfo.token, url: share.shareInfo.publicUrl } : null}
      shareBusy={share.shareBusy}
      shareLoading={share.shareLoading}
      shareStatusText={share.shareStatusText}
      runtimeStatus={runtimeStatus}
      storageInfo={session.storageInfo}
      persistenceFeedback={session.persistenceFeedback}
      lastPersistedAt={session.lastPersistedAt}
      dataToolsFeedback={dataToolsFeedback}
      runningDataTool={runningDataTool}
      trashItems={trashItems}
      settingsOpen={settingsOpen}
      quickNoteRefreshKey={session.quickNoteRefreshKey}
      searchQuery={search.searchQuery}
      searchResults={search.searchResults}
      searchLoading={search.searchLoading}
      onSelectDocument={handleOpenDocument}
      onSelectCollectionView={session.selectCollectionView}
      onSearchQueryChange={search.setSearchQuery}
      onSelectSearchResult={handleSelectSearchResult}
      onSelectQuickNoteDate={session.selectQuickNoteDate}
      selectedQuickNoteDate={session.selectedQuickNoteDate}
      onToggleFolder={session.toggleFolder}
      onCreateDocument={session.createDocument}
      onCreateFolder={session.createFolder}
      onMoveFolder={session.moveFolder}
      onRenameFolder={session.renameFolder}
      onRenameDocument={session.renameDocument}
      onMoveDocument={session.moveDocument}
      onStartEditing={session.startEditing}
      onCancelEditing={session.cancelEditing}
      onDeleteDocument={session.deleteDocument}
      onDeleteFolder={session.deleteFolder}
      onCreateSpace={handleCreateSpace}
      onRenameSpace={session.renameSpace}
      onDeleteSpace={handleDeleteSpace}
      onSwitchSpace={handleSwitchSpace}
      onOpenDataDirectory={handleOpenDataDirectory}
      onCreateBackup={handleCreateBackup}
      onRestoreBackup={handleRestoreBackup}
      onRebuildSearchIndex={handleRebuildSearchIndex}
      onCleanupOrphanAttachments={handleCleanupOrphanAttachments}
      onOpenTrash={handleOpenTrash}
      onRestoreTrashItem={handleRestoreTrashItem}
      onDeleteTrashItem={handleDeleteTrashItem}
      onEmptyTrash={handleEmptyTrash}
      onOpenSettings={() => setSettingsOpen(true)}
      onCloseSettings={() => setSettingsOpen(false)}
      onAddTagToDocument={session.addTagToDocument}
      onRemoveTagFromDocument={session.removeTagFromDocument}
      onSetDocumentFavorite={session.setDocumentFavorite}
      onOpenBacklinkDocument={handleOpenDocumentTarget}
      onActiveDocumentContentSnapshotReady={handleActiveDocumentContentSnapshotReady}
    />
  );
}
