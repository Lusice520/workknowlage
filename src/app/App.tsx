import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorHostFocusDiagnostic } from '../features/editor-host/EditorHost';
import { AppShell } from '../features/shell/AppShell';
import { prefetchQuickNoteRecord } from '../shared/lib/quickNoteRecords';
import { getActiveDocument, getActiveSpace, getFolderById } from '../shared/lib/workspaceSelectors';
import { getWorkKnowlageApi, getWorkKnowlageRuntimeStatus } from '../shared/lib/workKnowlageApi';
import type {
  DataToolActionDetailItem,
  DataToolActionResult,
  SpreadsheetWorkbookRecord,
  TrashItemRecord,
  WorkspaceSearchResultRecord,
} from '../shared/types/preload';
import type {
  DocumentFocusTarget,
  DocumentNavigationTarget,
  QuickNoteRecord,
} from '../shared/types/workspace';
import { useDocumentShare } from './useDocumentShare';
import { useDocumentExport } from './useDocumentExport';
import { useWorkspaceSearch } from './useWorkspaceSearch';
import { useWorkspaceSession } from './useWorkspaceSession';
import { WorkspaceSessionContextProvider, type WorkspaceSessionContextValue } from './contexts/WorkspaceSessionContext';
import { SearchContextProvider } from './contexts/SearchContext';
import { ShareContextProvider } from './contexts/ShareContext';
import { ExportContextProvider } from './contexts/ExportContext';
import { DataToolsContextProvider } from './contexts/DataToolsContext';

export default function App() {
  const runtimeStatus = getWorkKnowlageRuntimeStatus();
  const session = useWorkspaceSession(runtimeStatus);
  const [dataToolsFeedback, setDataToolsFeedback] = useState<string | null>(null);
  const [dataToolsDetails, setDataToolsDetails] = useState<DataToolActionDetailItem[]>([]);
  const [runningDataTool, setRunningDataTool] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItemRecord[]>([]);
  const [activeQuickNote, setActiveQuickNote] = useState<QuickNoteRecord | null>(null);
  const [documentFocusTarget, setDocumentFocusTarget] = useState<DocumentFocusTarget | null>(null);
  const [activeDocumentContentSnapshotGetter, setActiveDocumentContentSnapshotGetter] = useState<(() => string) | null>(null);
  const [documentNavigationFeedback, setDocumentNavigationFeedback] = useState<string | null>(null);
  const documentFocusRequestKeyRef = useRef(0);
  const workspaceState = session.workspaceState;
  const activeCollectionView = workspaceState?.activeCollectionView ?? 'tree';
  const selectedDocument = workspaceState ? getActiveDocument(workspaceState) : null;
  const activeDocument = session.activeQuickNoteDate || activeCollectionView !== 'tree'
    ? null
    : selectedDocument;
  const activeFolder = activeDocument?.folderId && workspaceState
    ? getFolderById(workspaceState, activeDocument.folderId)
    : null;
  const search = useWorkspaceSearch({
    activeSpaceId: workspaceState?.activeSpaceId,
    documents: workspaceState?.seed.documents,
    refreshKey: session.quickNoteRefreshKey,
  });
  const share = useDocumentShare({
    activeDocumentId: session.activeQuickNoteDate
      ? null
      : session.workspaceState?.activeDocumentId ?? null,
    activeDocumentKind: selectedDocument?.kind ?? 'note',
    activeQuickNoteDate: session.activeQuickNoteDate,
    onSaveDocumentContent: session.saveDocumentContent,
  });
  const activeSpaceId = workspaceState?.activeSpaceId ?? null;

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

  const exportState = useDocumentExport({
    activeDocumentId: activeDocument?.id ?? null,
    activeDocumentKind: activeDocument?.kind ?? 'note',
    activeDocumentTitle: activeDocument?.title ?? null,
    activeQuickNoteDate: session.activeQuickNoteDate,
    getCurrentContentJson: activeDocumentContentSnapshotGetter ?? (() => activeDocument?.contentJson ?? '[]'),
    onSaveDocumentContent: session.saveDocumentContent,
  });

  const handleActiveDocumentContentSnapshotReady = useCallback((getContentJson: () => string) => {
    setActiveDocumentContentSnapshotGetter(() => getContentJson);
  }, []);

  const handleLoadSpreadsheetWorkbook = useCallback(async (documentId: string): Promise<SpreadsheetWorkbookRecord | null> => {
    const spreadsheetApi = getWorkKnowlageApi().spreadsheets;
    if (!spreadsheetApi) {
      throw new Error('当前运行环境尚未提供表格存储接口');
    }

    return spreadsheetApi.get(documentId);
  }, []);

  const handleSaveSpreadsheetWorkbook = useCallback(async (
    documentId: string,
    workbookJson: string,
  ): Promise<SpreadsheetWorkbookRecord> => {
    const spreadsheetApi = getWorkKnowlageApi().spreadsheets;
    if (!spreadsheetApi) {
      throw new Error('当前运行环境尚未提供表格存储接口');
    }

    return spreadsheetApi.update(documentId, workbookJson);
  }, []);

  useEffect(() => {
    setActiveDocumentContentSnapshotGetter(() => () => activeDocument?.contentJson ?? '[]');
  }, [activeDocument?.contentJson, activeDocument?.id]);

  useEffect(() => {
    if (!documentNavigationFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDocumentNavigationFeedback(null);
    }, 3600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [documentNavigationFeedback]);

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
        fallbackText: target.fallbackText,
        highlightQuery: target.highlightQuery,
        requestKey: documentFocusRequestKeyRef.current,
      });
    } else {
      clearDocumentFocusTarget();
    }

    void session.openDocument(target.documentId, options);
  };

  const handleDocumentFocusDiagnostic = (diagnostic: EditorHostFocusDiagnostic) => {
    setDocumentNavigationFeedback(diagnostic.message);
  };

  const handleDocumentFocusTargetConsumed = (requestKey: number) => {
    setDocumentFocusTarget((current) => {
      if (!current || current.requestKey !== requestKey) {
        return current;
      }

      return null;
    });
  };

  const handleSelectSearchResult = (result: WorkspaceSearchResultRecord) => {
    const nextHighlightQuery = search.searchQuery.trim();
    search.clearSearch();

    if (result.kind === 'quick-note' && result.noteDate) {
      session.selectQuickNoteDate(result.noteDate);
      return;
    }

    const nextDocumentId = result.documentId ?? result.id;
    if (result.kind === 'document-block' && result.documentId && result.blockId) {
      handleOpenDocumentTarget(
        {
          documentId: result.documentId,
          blockId: result.blockId,
          fallbackText: result.fallbackText,
          highlightQuery: nextHighlightQuery || undefined,
        },
        result.folderId
          ? {
              ensureExpandedFolderIds: [result.folderId],
            }
          : undefined,
      );
      return;
    }

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
    action: () => Promise<DataToolActionResult | null | undefined> | undefined,
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
      setDataToolsDetails(result?.details ?? []);
    } catch (error) {
      setDataToolsFeedback(error instanceof Error ? error.message : `${label}失败`);
      setDataToolsDetails([]);
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

  const handleInspectDocumentContentHealth = async () => {
    await runDataTool('检查文稿格式', () => getWorkKnowlageApi().maintenance?.inspectDocumentContentHealth());
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

  const workspaceSessionValue: WorkspaceSessionContextValue = {
    activeDocument,
    activeQuickNote,
    activeQuickNoteDate: session.activeQuickNoteDate,
    activeFolder,
    activeSpace,
    state: workspaceState,
    editingId: session.editingId,
    quickNoteRefreshKey: session.quickNoteRefreshKey,
    selectedQuickNoteDate: session.selectedQuickNoteDate,
    documentFocusTarget,
    trashItems,
    onSelectDocument: handleOpenDocument,
    onSelectCollectionView: session.selectCollectionView,
    onSelectQuickNoteDate: session.selectQuickNoteDate,
    onToggleFolder: session.toggleFolder,
    onCreateDocument: session.createDocument,
    onCreateFolder: session.createFolder,
    onMoveFolder: session.moveFolder,
    onReorderTreeNode: session.reorderTreeNode,
    onMoveFolderToSpace: session.moveFolderToSpace,
    onRenameFolder: session.renameFolder,
    onRenameDocument: session.renameDocument,
    onMoveDocument: session.moveDocument,
    onMoveDocumentToSpace: session.moveDocumentToSpace,
    onStartEditing: session.startEditing,
    onCancelEditing: session.cancelEditing,
    onDeleteDocument: session.deleteDocument,
    onDeleteFolder: session.deleteFolder,
    onCreateSpace: handleCreateSpace,
    onRenameSpace: session.renameSpace,
    onDeleteSpace: handleDeleteSpace,
    onSwitchSpace: handleSwitchSpace,
    onOpenTrash: handleOpenTrash,
    onSaveDocumentContent: session.saveDocumentContent,
    onLoadSpreadsheetWorkbook: handleLoadSpreadsheetWorkbook,
    onSaveSpreadsheetWorkbook: handleSaveSpreadsheetWorkbook,
    onSaveQuickNoteContent: handleSaveQuickNoteContent,
    onCaptureQuickNote: handleCaptureQuickNote,
    onUploadFiles: session.uploadFiles,
    onUploadQuickNoteFiles: session.uploadQuickNoteFiles,
    onSetDocumentFavorite: session.setDocumentFavorite,
    onRestoreTrashItem: handleRestoreTrashItem,
    onDeleteTrashItem: handleDeleteTrashItem,
    onEmptyTrash: handleEmptyTrash,
    onActiveDocumentContentSnapshotReady: handleActiveDocumentContentSnapshotReady,
    onDocumentFocusDiagnostic: handleDocumentFocusDiagnostic,
    onDocumentFocusTargetConsumed: handleDocumentFocusTargetConsumed,
    onAddTagToDocument: session.addTagToDocument,
    onRemoveTagFromDocument: session.removeTagFromDocument,
    onOpenBacklinkDocument: handleOpenDocumentTarget,
  };

  const searchValue = {
    searchQuery: search.searchQuery,
    searchResults: search.searchResults,
    searchLoading: search.searchLoading,
    onSearchQueryChange: search.setSearchQuery,
    onSelectSearchResult: handleSelectSearchResult,
  };

  const shareValue = {
    shareInfo: share.shareInfo ? {
      token: share.shareInfo.token,
      url: share.shareInfo.publicUrl,
      enabled: share.shareInfo.enabled,
      localUrl: share.shareInfo.localUrl,
      publicToken: share.shareInfo.publicToken,
      publicEnabled: share.shareInfo.publicEnabled,
      publicUrl: share.shareInfo.publicUrl,
      publicPassword: share.shareInfo.publicPassword,
      publicExpiresAt: share.shareInfo.publicExpiresAt,
    } : null,
    shareBusy: share.shareBusy,
    shareLoading: share.shareLoading,
    shareStatusText: share.shareStatusText,
    shareCanCopyPublicPassword: share.shareCanCopyPublicPassword,
    onShareDocument: share.shareDocument,
    onSharePublicDocument: share.sharePublicDocument,
    onRegenerateShareDocument: share.regenerateShareDocument,
    onDisableShareDocument: share.disableShareDocument,
    onDisablePublicShareDocument: share.disablePublicShareDocument,
    onCopyLocalShareLink: share.copyLocalShareLink,
    onCopyPublicShareLink: share.copyPublicShareLink,
    onCopyPublicShareLinkWithPassword: share.copyPublicShareLinkWithPassword,
    onListSharesForSpace: share.listSharesForSpace,
    onResetPublicShare: share.resetPublicShareDocument,
    onDisableAllSharesForSpace: share.disableAllSharesForSpace,
  };

  const exportValue = {
    exportBusy: exportState.exportBusy,
    exportStatusText: exportState.exportStatusText,
    onExportMarkdown: exportState.exportMarkdown,
    onExportPdf: exportState.exportPdf,
    onExportSpreadsheet: exportState.exportSpreadsheet,
    onExportWord: exportState.exportWord,
  };

  const dataToolsValue = {
    runtimeStatus,
    storageInfo: session.storageInfo,
    persistenceFeedback: session.persistenceFeedback,
    lastPersistedAt: session.lastPersistedAt,
    dataToolsFeedback,
    dataToolsDetails,
    runningDataTool,
    settingsOpen,
    onOpenSettings: () => setSettingsOpen(true),
    onCloseSettings: () => setSettingsOpen(false),
    onOpenDataDirectory: handleOpenDataDirectory,
    onCreateBackup: handleCreateBackup,
    onRestoreBackup: handleRestoreBackup,
    onRebuildSearchIndex: handleRebuildSearchIndex,
    onInspectDocumentContentHealth: handleInspectDocumentContentHealth,
    onCleanupOrphanAttachments: handleCleanupOrphanAttachments,
  };

  return (
    <WorkspaceSessionContextProvider value={workspaceSessionValue}>
      <SearchContextProvider value={searchValue}>
        <ShareContextProvider value={shareValue}>
          <ExportContextProvider value={exportValue}>
            <DataToolsContextProvider value={dataToolsValue}>
              <AppShell documentNavigationFeedback={documentNavigationFeedback} />
            </DataToolsContextProvider>
          </ExportContextProvider>
        </ShareContextProvider>
      </SearchContextProvider>
    </WorkspaceSessionContextProvider>
  );
}
