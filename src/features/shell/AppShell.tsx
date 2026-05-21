import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspaceSessionContext } from '../../app/contexts/WorkspaceSessionContext';
import { useSearchContext } from '../../app/contexts/SearchContext';
import { useShareContext } from '../../app/contexts/ShareContext';
import { useExportContext } from '../../app/contexts/ExportContext';
import { useDataToolsContext } from '../../app/contexts/DataToolsContext';
import { useSidebarAssociations } from '../../app/useSidebarAssociations';
import {
  getActiveWikiRecommendationFeedback,
  setWikiRecommendationFeedback,
  type WikiRecommendationFeedbackStore,
} from '../../shared/lib/wikiRecommendationFeedback';
import { LeftSidebar } from './LeftSidebar';
import { CenterPane } from './CenterPane';
import { RightSidebar } from './RightSidebar';
import { MoveToSpaceModal } from './MoveToSpaceModal';
import { SettingsModal } from './SettingsModal';

interface AppShellProps {
  documentNavigationFeedback?: string | null;
}

export function AppShell({ documentNavigationFeedback }: AppShellProps) {
  const ws = useWorkspaceSessionContext();
  const search = useSearchContext();
  const share = useShareContext();
  const exp = useExportContext();
  const dt = useDataToolsContext();

  const [moveToSpaceToast, setMoveToSpaceToast] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [wikiRecommendationFeedback, setWikiRecommendationFeedbackState] = useState<WikiRecommendationFeedbackStore>({});
  const [focusedOutlineItemId, setFocusedOutlineItemId] = useState<string | null>(null);
  const [moveToSpaceRequest, setMoveToSpaceRequest] = useState<{
    kind: 'document' | 'folder';
    id: string;
    label: string;
  } | null>(null);
  const [moveToSpaceSubmitting, setMoveToSpaceSubmitting] = useState(false);

  useEffect(() => {
    if (!moveToSpaceToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMoveToSpaceToast(null);
    }, moveToSpaceToast.tone === 'error' ? 3200 : 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [moveToSpaceToast]);

  useEffect(() => {
    setFocusedOutlineItemId(null);
  }, [ws.activeDocument?.id]);

  const associationState = useSidebarAssociations({
    activeDocument: ws.activeDocument,
    documents: ws.state.seed.documents,
    folders: ws.state.seed.folders,
    focusedOutlineItemId,
  });
  const activeWikiRecommendationFeedback = useMemo(
    () => getActiveWikiRecommendationFeedback(wikiRecommendationFeedback, ws.activeDocument?.id),
    [wikiRecommendationFeedback, ws.activeDocument?.id],
  );
  const isSpreadsheetDocument = ws.activeDocument?.kind === 'spreadsheet' && !ws.activeQuickNote;
  const shellGridClassName = isSpreadsheetDocument
    ? 'grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] gap-2'
    : 'grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_320px] gap-2';

  const markWikiRecommendationUseful = useCallback((targetDocumentId: string) => {
    const sourceDocumentId = ws.activeDocument?.id;
    if (!sourceDocumentId) {
      return;
    }

    setWikiRecommendationFeedbackState((current) =>
      setWikiRecommendationFeedback(current, sourceDocumentId, targetDocumentId, 'useful'),
    );
  }, [ws.activeDocument?.id]);

  const showLessWikiRecommendationsLikeThis = useCallback((targetDocumentId: string) => {
    const sourceDocumentId = ws.activeDocument?.id;
    if (!sourceDocumentId) {
      return;
    }

    setWikiRecommendationFeedbackState((current) =>
      setWikiRecommendationFeedback(current, sourceDocumentId, targetDocumentId, 'less-like-this'),
    );
  }, [ws.activeDocument?.id]);

  const handleCloseMoveToSpace = () => {
    if (moveToSpaceSubmitting) {
      return;
    }

    setMoveToSpaceRequest(null);
  };

  const handleConfirmMoveToSpace = async (targetSpaceId: string) => {
    if (!moveToSpaceRequest || moveToSpaceSubmitting) {
      return;
    }

    const currentRequest = moveToSpaceRequest;
    const targetSpaceName = ws.state.seed.spaces.find((space) => space.id === targetSpaceId)?.name ?? '目标空间';

    setMoveToSpaceSubmitting(true);
    setMoveToSpaceToast(null);

    try {
      if (currentRequest.kind === 'document') {
        await ws.onMoveDocumentToSpace(currentRequest.id, targetSpaceId);
      } else {
        await ws.onMoveFolderToSpace(currentRequest.id, targetSpaceId);
      }

      setMoveToSpaceRequest(null);
      setMoveToSpaceToast({
        tone: 'success',
        message: `已移动到「${targetSpaceName}」`,
      });
    } catch (error) {
      const detail = error instanceof Error && error.message ? error.message : '请稍后再试';
      setMoveToSpaceToast({
        tone: 'error',
        message: `移动失败：${detail}`,
      });
    } finally {
      setMoveToSpaceSubmitting(false);
    }
  };

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
        <div className={shellGridClassName}>
          <LeftSidebar
            activeSpace={ws.activeSpace}
            state={ws.state}
            editingId={ws.editingId}
            quickNoteRefreshKey={ws.quickNoteRefreshKey}
            selectedQuickNoteDate={ws.selectedQuickNoteDate}
            searchQuery={search.searchQuery}
            searchResults={search.searchResults}
            searchLoading={search.searchLoading}
            onSelectDocument={ws.onSelectDocument}
            onSelectCollectionView={ws.onSelectCollectionView}
            onSearchQueryChange={search.onSearchQueryChange}
            onSelectSearchResult={search.onSelectSearchResult}
            onSelectQuickNoteDate={ws.onSelectQuickNoteDate}
            onToggleFolder={ws.onToggleFolder}
            onCreateDocument={ws.onCreateDocument}
            onCreateFolder={ws.onCreateFolder}
            onMoveFolder={ws.onMoveFolder}
            onRequestMoveFolderToSpace={(folderId, folderName) => {
              setMoveToSpaceRequest({ kind: 'folder', id: folderId, label: folderName });
            }}
            onRenameFolder={ws.onRenameFolder}
            onRenameDocument={ws.onRenameDocument}
            onMoveDocument={ws.onMoveDocument}
            onRequestMoveDocumentToSpace={(documentId, documentTitle) => {
              setMoveToSpaceRequest({ kind: 'document', id: documentId, label: documentTitle });
            }}
            onStartEditing={ws.onStartEditing}
            onCancelEditing={ws.onCancelEditing}
            onDeleteDocument={ws.onDeleteDocument}
            onDeleteFolder={ws.onDeleteFolder}
            onCreateSpace={ws.onCreateSpace}
            onRenameSpace={ws.onRenameSpace}
            onDeleteSpace={ws.onDeleteSpace}
            onSwitchSpace={ws.onSwitchSpace}
            onOpenTrash={ws.onOpenTrash}
            onOpenSettings={dt.onOpenSettings}
          />
          <CenterPane
            activeDocument={ws.activeDocument}
            activeQuickNoteDate={ws.activeQuickNoteDate}
            selectedQuickNoteDate={ws.selectedQuickNoteDate}
            activeFolder={ws.activeFolder}
            activeSpace={ws.activeSpace}
            activeCollectionView={ws.state.activeCollectionView ?? 'tree'}
            documents={ws.state.seed.documents}
            folders={ws.state.seed.folders}
            trashItems={ws.trashItems}
            onSaveDocumentContent={ws.onSaveDocumentContent}
            onSaveQuickNoteContent={ws.onSaveQuickNoteContent}
            onCaptureQuickNote={ws.onCaptureQuickNote}
            onUploadFiles={ws.onUploadFiles}
            onUploadQuickNoteFiles={ws.onUploadQuickNoteFiles}
            onOpenDocument={ws.onSelectDocument}
            onSetDocumentFavorite={ws.onSetDocumentFavorite}
            onRestoreTrashItem={ws.onRestoreTrashItem}
            onDeleteTrashItem={ws.onDeleteTrashItem}
            onEmptyTrash={ws.onEmptyTrash}
            onShareDocument={share.onShareDocument}
            onSharePublicDocument={share.onSharePublicDocument}
            onRegenerateShareDocument={share.onRegenerateShareDocument}
            onDisableShareDocument={share.onDisableShareDocument}
            onDisablePublicShareDocument={share.onDisablePublicShareDocument}
            onCopyLocalShareLink={share.onCopyLocalShareLink}
            onCopyPublicShareLink={share.onCopyPublicShareLink}
            onCopyPublicShareLinkWithPassword={share.onCopyPublicShareLinkWithPassword}
            onListSharesForSpace={share.onListSharesForSpace}
            onResetPublicShare={share.onResetPublicShare}
            onDisableAllSharesForSpace={share.onDisableAllSharesForSpace}
            onLoadSpreadsheetWorkbook={ws.onLoadSpreadsheetWorkbook}
            onSaveSpreadsheetWorkbook={ws.onSaveSpreadsheetWorkbook}
            onExportMarkdown={exp.onExportMarkdown}
            onExportPdf={exp.onExportPdf}
            onExportSpreadsheet={exp.onExportSpreadsheet}
            onExportWord={exp.onExportWord}
            exportBusy={exp.exportBusy}
            exportStatusText={exp.exportStatusText}
            onActiveDocumentContentSnapshotReady={ws.onActiveDocumentContentSnapshotReady}
            shareInfo={share.shareInfo}
            shareBusy={share.shareBusy}
            shareLoading={share.shareLoading}
            shareStatusText={share.shareStatusText}
            shareCanCopyPublicPassword={share.shareCanCopyPublicPassword}
            documentFocusTarget={ws.documentFocusTarget}
            onFocusDiagnostic={ws.onDocumentFocusDiagnostic}
            onFocusTargetConsumed={ws.onDocumentFocusTargetConsumed}
          />
          {!isSpreadsheetDocument ? (
            <RightSidebar
              activeDocument={ws.activeDocument}
              activeQuickNote={ws.activeQuickNote}
              activeFolder={ws.activeFolder}
              activeSpace={ws.activeSpace}
              associationState={associationState}
              focusedOutlineItemId={focusedOutlineItemId}
              recommendationFeedback={activeWikiRecommendationFeedback}
              onAddTagToDocument={ws.onAddTagToDocument}
              onFocusOutlineItem={setFocusedOutlineItemId}
              onMarkRecommendationUseful={markWikiRecommendationUseful}
              onRemoveTagFromDocument={ws.onRemoveTagFromDocument}
              onOpenBacklinkDocument={ws.onOpenBacklinkDocument}
              onShowLessLikeThis={showLessWikiRecommendationsLikeThis}
            />
          ) : null}
        </div>
      </div>
      <SettingsModal
        open={dt.settingsOpen}
        runtimeStatus={dt.runtimeStatus}
        persistenceFeedback={dt.persistenceFeedback}
        storageInfo={dt.storageInfo}
        lastPersistedAt={dt.lastPersistedAt}
        dataToolsFeedback={dt.dataToolsFeedback}
        dataToolsDetails={dt.dataToolsDetails}
        runningDataTool={dt.runningDataTool}
        onClose={dt.onCloseSettings}
        onOpenDataDirectory={dt.onOpenDataDirectory}
        onCreateBackup={dt.onCreateBackup}
        onRestoreBackup={dt.onRestoreBackup}
        onRebuildSearchIndex={dt.onRebuildSearchIndex}
        onInspectDocumentContentHealth={dt.onInspectDocumentContentHealth}
        onCleanupOrphanAttachments={dt.onCleanupOrphanAttachments}
      />
      <MoveToSpaceModal
        open={moveToSpaceRequest !== null}
        itemLabel={moveToSpaceRequest?.label ?? ''}
        itemKind={moveToSpaceRequest?.kind ?? 'document'}
        spaces={ws.state.seed.spaces}
        currentSpaceId={ws.activeSpace?.id ?? null}
        submitting={moveToSpaceSubmitting}
        onClose={handleCloseMoveToSpace}
        onConfirm={handleConfirmMoveToSpace}
      />
      {moveToSpaceToast ? (
        <div
          role={moveToSpaceToast.tone === 'error' ? 'alert' : 'status'}
          aria-live={moveToSpaceToast.tone === 'error' ? 'assertive' : 'polite'}
          className={`pointer-events-none absolute right-6 top-6 z-[60] max-w-sm rounded-[18px] border px-4 py-3 text-[13px] font-medium shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur ${
            moveToSpaceToast.tone === 'error'
              ? 'border-rose-200/80 bg-white/95 text-rose-700'
              : 'border-emerald-200/80 bg-white/95 text-emerald-700'
          }`}
        >
          {moveToSpaceToast.message}
        </div>
      ) : null}
      {documentNavigationFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute right-6 top-24 z-[60] max-w-sm rounded-[18px] border border-amber-200/80 bg-white/95 px-4 py-3 text-[13px] font-medium text-amber-700 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur"
        >
          {documentNavigationFeedback}
        </div>
      ) : null}
    </main>
  );
}
