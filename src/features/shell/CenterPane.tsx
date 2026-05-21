import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronDown, Copy, Download, Link2Off, LoaderCircle, RefreshCw, Share2, Star } from 'lucide-react';
import type { EditorHostFocusDiagnostic, EditorHostShareInfo } from '../editor-host/EditorHost';
import type { EditorSaveStatus } from '../editor-host/useEditorPersistence';
import { buildMentionDocumentCandidates } from '../../shared/lib/documentPaths';
import { getQuickNoteTitle } from '../../shared/lib/quickNotes';
import { prefetchQuickNoteRecord } from '../../shared/lib/quickNoteRecords';
import { CollectionCenterPane } from './CollectionCenterPane';
import { CenterPaneLoading } from './CenterPaneLoading';
import { sharedMenuDropdownClassName, sharedMenuItemClassName } from './sharedMenuStyles';
import { SharedLinksCenterPane } from './SharedLinksCenterPane';
import { TrashCenterPane } from './TrashCenterPane';
import type {
  DocumentFocusTarget,
  DocumentRecord,
  FolderNode,
  QuickNoteRecord,
  Space,
  WorkspaceCollectionView,
} from '../../shared/types/workspace';
import type { DocumentShareRecord, SpreadsheetWorkbookRecord, TrashItemRecord, WorkspaceShareRecord } from '../../shared/types/preload';

const LazyEditorHost = lazy(() =>
  import('../editor-host/EditorHost').then((module) => ({ default: module.EditorHost }))
);

const LazySpreadsheetEditorHost = lazy(() =>
  import('../spreadsheet/SpreadsheetEditorHost').then((module) => ({ default: module.SpreadsheetEditorHost }))
);

const quickNoteCenterPaneModulePromise = import('./QuickNoteCenterPane');

const LazyQuickNoteCenterPane = lazy(() =>
  quickNoteCenterPaneModulePromise.then((module) => ({ default: module.QuickNoteCenterPane }))
);

export type { EditorHostShareInfo } from '../editor-host/EditorHost';

const extractQuickNotePreviewText = (contentJson: string) => {
  try {
    const parsed = JSON.parse(contentJson);
    if (!Array.isArray(parsed)) {
      return '';
    }

    const collect = (value: unknown): string[] => {
      if (typeof value === 'string') {
        return [value];
      }

      if (!value || typeof value !== 'object') {
        return [];
      }

      const record = value as Record<string, unknown>;
      const content = Array.isArray(record.content) ? record.content : [];
      const children = Array.isArray(record.children) ? record.children : [];
      return [
        ...content.flatMap((item) => collect(item)),
        ...children.flatMap((item) => collect(item)),
      ];
    };

    return parsed.flatMap((block) => collect(block)).join('').trim();
  } catch {
    return '';
  }
};

type PublicShareExpiryPreset = '30m' | '1h' | 'today' | 'manual';

const getTemporaryPublicShareExpiresAt = (preset: PublicShareExpiryPreset): string | null => {
  if (preset === 'manual') {
    return null;
  }

  const now = new Date();
  if (preset === 'today') {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.toISOString();
  }

  const durationMs = preset === '30m' ? 30 * 60 * 1000 : 60 * 60 * 1000;
  return new Date(now.getTime() + durationMs).toISOString();
};

function CenterPaneBodyLoading({ description }: { description: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2 text-[13px] text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          <span>{description}</span>
        </div>
      </div>
    </section>
  );
}

interface CenterPaneProps {
  activeDocument: DocumentRecord | null;
  activeQuickNoteDate: string | null;
  selectedQuickNoteDate: string;
  activeFolder: FolderNode | null;
  activeSpace: Space | null;
  activeCollectionView: WorkspaceCollectionView;
  documents: DocumentRecord[];
  folders: FolderNode[];
  trashItems: TrashItemRecord[];
  documentFocusTarget?: DocumentFocusTarget | null;
  onFocusDiagnostic?: (diagnostic: EditorHostFocusDiagnostic) => void;
  onFocusTargetConsumed?: (requestKey: number) => void;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
  onLoadSpreadsheetWorkbook: (documentId: string) => Promise<SpreadsheetWorkbookRecord | null>;
  onSaveSpreadsheetWorkbook: (documentId: string, workbookJson: string) => Promise<SpreadsheetWorkbookRecord>;
  onSaveQuickNoteContent: (noteDate: string, contentJson: string) => Promise<QuickNoteRecord>;
  onCaptureQuickNote: (noteDate: string) => Promise<unknown>;
  onUploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  onUploadQuickNoteFiles: (quickNoteId: string, files: File[]) => Promise<string[]>;
  onOpenDocument: (documentId: string) => void;
  onSetDocumentFavorite: (documentId: string, isFavorite: boolean) => Promise<void> | void;
  onRestoreTrashItem: (trashRootId: string) => Promise<void> | void;
  onDeleteTrashItem: (trashRootId: string) => Promise<void> | void;
  onEmptyTrash: () => Promise<void> | void;
  onShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onSharePublicDocument: (
    documentId: string,
    contentJson: string,
    options: { expiresAt?: string | null },
  ) => Promise<void> | void;
  onRegenerateShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onDisableShareDocument: (documentId: string) => Promise<void> | void;
  onDisablePublicShareDocument: (documentId: string) => Promise<void> | void;
  onCopyLocalShareLink?: () => Promise<void> | void;
  onCopyPublicShareLink?: () => Promise<void> | void;
  onCopyPublicShareLinkWithPassword?: () => Promise<void> | void;
  onListSharesForSpace?: (spaceId: string) => Promise<WorkspaceShareRecord[]>;
  onResetPublicShare?: (documentId: string, options: { expiresAt?: string | null }) => Promise<DocumentShareRecord | null>;
  onDisableAllSharesForSpace?: (spaceId: string) => Promise<number>;
  onExportMarkdown: () => Promise<void> | void;
  onExportPdf: () => Promise<void> | void;
  onExportSpreadsheet: () => Promise<void> | void;
  onExportWord: () => Promise<void> | void;
  exportBusy: boolean;
  exportStatusText?: string | null;
  onActiveDocumentContentSnapshotReady?: (getContentJson: () => string) => void;
  shareInfo?: EditorHostShareInfo | null;
  shareBusy?: boolean;
  shareLoading?: boolean;
  shareStatusText?: string | null;
  shareCanCopyPublicPassword?: boolean;
}

export function CenterPane({
  activeDocument,
  activeQuickNoteDate,
  selectedQuickNoteDate,
  activeFolder,
  activeSpace,
  activeCollectionView,
  documents,
  folders,
  trashItems,
  documentFocusTarget,
  onFocusDiagnostic,
  onFocusTargetConsumed,
  onSaveDocumentContent,
  onLoadSpreadsheetWorkbook,
  onSaveSpreadsheetWorkbook,
  onSaveQuickNoteContent,
  onCaptureQuickNote,
  onUploadFiles,
  onUploadQuickNoteFiles,
  onOpenDocument,
  onSetDocumentFavorite,
  onRestoreTrashItem,
  onDeleteTrashItem,
  onEmptyTrash,
  onShareDocument,
  onSharePublicDocument,
  onRegenerateShareDocument,
  onDisableShareDocument,
  onDisablePublicShareDocument,
  onCopyLocalShareLink,
  onCopyPublicShareLink,
  onCopyPublicShareLinkWithPassword,
  onListSharesForSpace,
  onResetPublicShare,
  onDisableAllSharesForSpace,
  onExportMarkdown,
  onExportPdf,
  onExportSpreadsheet,
  onExportWord,
  exportBusy,
  exportStatusText,
  onActiveDocumentContentSnapshotReady,
  shareInfo,
  shareBusy,
  shareLoading,
  shareStatusText,
  shareCanCopyPublicPassword,
}: CenterPaneProps) {
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('saved');
  const [quickNotePreviewText, setQuickNotePreviewText] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const contentSnapshotRef = useRef<() => string>(() => activeDocument?.contentJson ?? '[]');

  useEffect(() => {
    if (!selectedQuickNoteDate) {
      setQuickNotePreviewText('');
      return;
    }

    let cancelled = false;
    setQuickNotePreviewText('');

    void prefetchQuickNoteRecord(selectedQuickNoteDate)
      .then((quickNote) => {
        if (cancelled || !quickNote) {
          return;
        }

        setQuickNotePreviewText(extractQuickNotePreviewText(quickNote.contentJson));
      })
      .catch(() => {
        if (!cancelled) {
          setQuickNotePreviewText('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedQuickNoteDate]);

  useEffect(() => {
    setSaveStatus('saved');
    contentSnapshotRef.current = () => activeDocument?.contentJson ?? '[]';
  }, [activeDocument?.contentJson, activeDocument?.id]);

  useEffect(() => {
    setExportMenuOpen(false);
    setShareMenuOpen(false);
  }, [activeDocument?.id]);

  const handleContentSnapshotReady = useCallback((getContentJson: () => string) => {
    contentSnapshotRef.current = getContentJson;
    onActiveDocumentContentSnapshotReady?.(getContentJson);
  }, [onActiveDocumentContentSnapshotReady]);

  const mentionDocuments = useMemo(
    () => buildMentionDocumentCandidates(documents, folders),
    [documents, folders],
  );

  if (activeQuickNoteDate) {
    return (
      <Suspense
        fallback={
          <CenterPaneLoading
            dataTestId="center-pane"
            breadcrumb={['每日快记', activeQuickNoteDate]}
            title={getQuickNoteTitle(activeQuickNoteDate)}
            description="正在加载当日快记..."
            bodyPreview={quickNotePreviewText}
          />
        }
      >
        <LazyQuickNoteCenterPane
          noteDate={activeQuickNoteDate}
          onSaveQuickNoteContent={onSaveQuickNoteContent}
          onCaptureQuickNote={onCaptureQuickNote}
          onUploadFiles={onUploadQuickNoteFiles}
        />
      </Suspense>
    );
  }

  if (activeCollectionView === 'trash' && activeSpace) {
    return (
      <TrashCenterPane
        activeSpaceName={activeSpace.name}
        items={trashItems}
        onRestoreItem={onRestoreTrashItem}
        onDeleteItem={onDeleteTrashItem}
        onEmptyTrash={onEmptyTrash}
      />
    );
  }

  if (activeCollectionView === 'shared-links' && activeSpace) {
    return (
      <SharedLinksCenterPane
        activeSpace={activeSpace}
        folders={folders}
        onOpenDocument={onOpenDocument}
        onListSharesForSpace={onListSharesForSpace}
        onDisableLocalShare={onDisableShareDocument}
        onDisablePublicShare={onDisablePublicShareDocument}
        onResetPublicShare={onResetPublicShare}
        onDisableAllSharesForSpace={onDisableAllSharesForSpace}
      />
    );
  }

  const collectionView = activeCollectionView === 'tree' || activeCollectionView === 'trash' || activeCollectionView === 'shared-links'
    ? null
    : activeCollectionView;

  if (collectionView && activeSpace) {
    return (
      <CollectionCenterPane
        view={collectionView}
        activeSpaceName={activeSpace.name}
        documents={documents}
        folders={folders}
        onOpenDocument={onOpenDocument}
        onSetDocumentFavorite={onSetDocumentFavorite}
      />
    );
  }

  if (!activeDocument) {
    return (
      <section
        data-testid="center-pane"
        data-pane-density="compact"
        className="flex h-full items-center justify-center overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-8"
      >
        <div className="max-w-xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">WorkKnowlage</p>
          <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">请选择一篇文档开始工作</h1>
        </div>
      </section>
    );
  }

  const hasLocalShare = Boolean(shareInfo?.enabled && String(shareInfo?.token || '').trim());
  const hasPublicShare = Boolean(shareInfo?.publicEnabled && String(shareInfo?.publicToken || '').trim());
  const hasAnyShare = hasLocalShare || hasPublicShare;
  const isSpreadsheetDocument = activeDocument.kind === 'spreadsheet';
  const isFavorite = Boolean(activeDocument.isFavorite);
  const favoriteLabel = `${isFavorite ? '取消收藏' : '收藏'}文档 ${activeDocument.title}`;
  const shareLabel = shareLoading ? '检查分享' : (hasAnyShare ? '分享已开启' : '分享');
  const primaryShareActionLabel = hasLocalShare ? '复制局域分享链接' : '开启局域分享';
  const saveStatusMeta = {
    saved: {
      className: 'text-emerald-600 hover:text-emerald-700',
      icon: CheckCheck,
      label: '保存状态：已自动保存',
      spin: false,
    },
    saving: {
      className: 'text-amber-600 hover:text-amber-700',
      icon: LoaderCircle,
      label: '保存状态：正在保存',
      spin: true,
    },
    error: {
      className: 'text-rose-600 hover:text-rose-700',
      icon: AlertTriangle,
      label: '保存状态：保存失败',
      spin: false,
    },
  } as const;
  const saveAction = saveStatusMeta[saveStatus];
  const SaveIcon = saveAction.icon;
  const shareMetaToneClass = shareStatusText?.includes('失败')
    ? 'bg-rose-50 text-rose-600'
    : (shareBusy || shareLoading || shareStatusText?.includes('正在'))
      ? 'bg-amber-50 text-amber-600'
    : (shareStatusText?.includes('复制') || shareStatusText?.includes('开启') || shareStatusText?.includes('更新'))
      ? 'bg-blue-50 text-blue-600'
      : 'bg-slate-100 text-slate-500';

  const getCurrentContentJson = () => contentSnapshotRef.current();
  const shareTemporaryPublicDocument = async (preset: PublicShareExpiryPreset) => {
    setShareMenuOpen(false);
    await onSharePublicDocument(activeDocument.id, getCurrentContentJson(), {
      expiresAt: getTemporaryPublicShareExpiresAt(preset),
    });
  };

  return (
    <section
      data-testid="center-pane"
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="flex items-center justify-between border-b border-[rgba(148,163,184,0.16)] pb-4">
        <nav className="flex items-center gap-2 text-[11px] font-medium text-[var(--wk-muted)]">
          <span>{activeSpace?.name ?? '个人工作空间'}</span>
          <span>›</span>
          <span>{activeFolder?.name ?? '根目录'}</span>
          <span>›</span>
          <span className="text-[var(--wk-ink)]">{activeDocument.title}</span>
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={saveAction.label}
            title={saveAction.label}
            disabled
            className={`rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 transition ${saveAction.className} disabled:cursor-default disabled:opacity-100`}
          >
            <SaveIcon size={15} className={saveAction.spin ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            aria-label={favoriteLabel}
            title={favoriteLabel}
            className={`rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 transition ${
              isFavorite
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-[var(--wk-ink-soft)] hover:text-[var(--wk-ink)]'
            }`}
            onClick={() => onSetDocumentFavorite(activeDocument.id, !isFavorite)}
          >
            <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          {!isSpreadsheetDocument ? (
            <div className="relative">
              <button
                type="button"
                aria-label="分享"
                title={shareLabel}
                className={`flex items-center gap-1 rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 px-2.5 py-1.5 text-[12px] font-medium transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  hasAnyShare ? 'text-blue-600' : 'text-[var(--wk-ink-soft)]'
                }`}
                onClick={() => {
                  setExportMenuOpen(false);
                  setShareMenuOpen((current) => !current);
                }}
                disabled={shareBusy || shareLoading}
              >
                {shareBusy || shareLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Share2 size={15} />}
                <span>分享</span>
                <ChevronDown size={12} />
              </button>
              {shareMenuOpen ? (
                <div
                  role="menu"
                  className={`absolute right-0 top-[calc(100%+8px)] z-20 !min-w-[220px] overflow-hidden ${sharedMenuDropdownClassName}`}
                >
                  <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">局域分享</div>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${sharedMenuItemClassName} !gap-2`}
                    onClick={async () => {
                      setShareMenuOpen(false);
                      if (hasLocalShare && onCopyLocalShareLink) {
                        await onCopyLocalShareLink();
                        return;
                      }

                      await onShareDocument(activeDocument.id, getCurrentContentJson());
                    }}
                    disabled={shareBusy || shareLoading}
                  >
                    <Share2 size={14} />
                    <span>{primaryShareActionLabel}</span>
                  </button>
                  {hasLocalShare ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${sharedMenuItemClassName} !gap-2`}
                        onClick={async () => {
                          setShareMenuOpen(false);
                          await onRegenerateShareDocument(activeDocument.id, getCurrentContentJson());
                        }}
                        disabled={shareBusy || shareLoading}
                      >
                        <RefreshCw size={14} />
                        <span>刷新局域分享地址</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${sharedMenuItemClassName} !gap-2 !text-rose-600 hover:!text-rose-700`}
                        onClick={async () => {
                          setShareMenuOpen(false);
                          await onDisableShareDocument(activeDocument.id);
                        }}
                        disabled={shareBusy || shareLoading}
                      >
                        <Link2Off size={14} />
                        <span>关闭局域分享</span>
                      </button>
                    </>
                  ) : null}
                  <div className="my-1 h-px bg-slate-100" role="separator" />
                  <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-400">临时公网分享</div>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${sharedMenuItemClassName} !gap-2`}
                    onClick={() => shareTemporaryPublicDocument('30m')}
                    disabled={shareBusy || shareLoading}
                  >
                    <Share2 size={14} />
                    <span>临时公网分享 30 分钟</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${sharedMenuItemClassName} !gap-2`}
                    onClick={() => shareTemporaryPublicDocument('1h')}
                    disabled={shareBusy || shareLoading}
                  >
                    <Share2 size={14} />
                    <span>临时公网分享 1 小时</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${sharedMenuItemClassName} !gap-2`}
                    onClick={() => shareTemporaryPublicDocument('today')}
                    disabled={shareBusy || shareLoading}
                  >
                    <Share2 size={14} />
                    <span>临时公网分享 今天内</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${sharedMenuItemClassName} !gap-2`}
                    onClick={() => shareTemporaryPublicDocument('manual')}
                    disabled={shareBusy || shareLoading}
                  >
                    <Share2 size={14} />
                    <span>临时公网分享 手动关闭</span>
                  </button>
                  {hasPublicShare ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${sharedMenuItemClassName} !gap-2`}
                        onClick={async () => {
                          setShareMenuOpen(false);
                          await (shareCanCopyPublicPassword
                            ? onCopyPublicShareLinkWithPassword?.()
                            : onCopyPublicShareLink?.());
                        }}
                        disabled={shareBusy || shareLoading}
                      >
                        <Copy size={14} />
                        <span>{shareCanCopyPublicPassword ? '复制公网链接和密码' : '复制临时公网链接'}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${sharedMenuItemClassName} !gap-2`}
                        onClick={async () => {
                          setShareMenuOpen(false);
                          await onSharePublicDocument(activeDocument.id, getCurrentContentJson(), {
                            expiresAt: shareInfo?.publicExpiresAt ?? null,
                          });
                        }}
                        disabled={shareBusy || shareLoading}
                      >
                        <RefreshCw size={14} />
                        <span>重置公网链接和密码</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={`${sharedMenuItemClassName} !gap-2 !text-rose-600 hover:!text-rose-700`}
                        onClick={async () => {
                          setShareMenuOpen(false);
                          await onDisablePublicShareDocument(activeDocument.id);
                        }}
                        disabled={shareBusy || shareLoading}
                      >
                        <Link2Off size={14} />
                        <span>关闭临时公网分享</span>
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="relative">
            <button
              type="button"
              aria-label="导出"
              title={exportStatusText || (isSpreadsheetDocument ? '导出 Excel' : '导出文档')}
              className="flex items-center gap-1 rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 px-2.5 py-1.5 text-[12px] font-medium text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                setShareMenuOpen(false);
                setExportMenuOpen((current) => !current);
              }}
              disabled={exportBusy}
            >
              {exportBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
              <span>导出</span>
              <ChevronDown size={12} />
            </button>
            {exportMenuOpen ? (
              <div
                role="menu"
                className={`absolute right-0 top-[calc(100%+8px)] z-20 overflow-hidden ${sharedMenuDropdownClassName}`}
              >
                {isSpreadsheetDocument ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={sharedMenuItemClassName}
                    onClick={async () => {
                      setExportMenuOpen(false);
                      await onExportSpreadsheet();
                    }}
                    disabled={exportBusy}
                  >
                    导出 Excel
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={sharedMenuItemClassName}
                      onClick={async () => {
                        setExportMenuOpen(false);
                        await onExportMarkdown();
                      }}
                      disabled={exportBusy}
                    >
                      导出 Markdown
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={sharedMenuItemClassName}
                      onClick={async () => {
                        setExportMenuOpen(false);
                        await onExportPdf();
                      }}
                      disabled={exportBusy}
                    >
                      导出 PDF
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={sharedMenuItemClassName}
                      onClick={async () => {
                        setExportMenuOpen(false);
                        await onExportWord();
                      }}
                      disabled={exportBusy}
                    >
                      导出 Word
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 flex-col ${isSpreadsheetDocument ? 'mt-3 gap-3' : 'mt-5 gap-4'}`}>
        <div
          data-testid="document-title-area"
          data-title-layout={isSpreadsheetDocument ? 'compact-spreadsheet' : 'note'}
          className={isSpreadsheetDocument
            ? 'flex shrink-0 items-end justify-between gap-4 px-1 py-0.5'
            : 'px-1'}
        >
          <div className="min-w-0">
            <h1 className={`font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--wk-ink)] ${
              isSpreadsheetDocument ? 'truncate text-[18px]' : 'text-[22px]'
            }`}>
              {activeDocument.title}
            </h1>
            <div className={`flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)] ${
              isSpreadsheetDocument ? 'mt-1.5' : 'mt-3'
            }`}>
              <span>{activeDocument.updatedAtLabel}</span>
              {isSpreadsheetDocument ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                  表格
                </span>
              ) : null}
              {!isSpreadsheetDocument ? (
                <>
                  <span>{activeDocument.wordCountLabel}</span>
                  <span className="h-1 w-1 rounded-full bg-[rgba(148,163,184,0.9)]" />
                  <span className="rounded-full bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[11px] font-medium text-[var(--wk-accent)]">
                    #{activeDocument.badgeLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${shareMetaToneClass}`}>
                    {shareBusy || shareLoading || shareStatusText?.includes('正在') ? (
                      <LoaderCircle size={11} className="animate-spin" />
                    ) : null}
                    {shareStatusText || '分享未开启'}
                  </span>
                  {exportStatusText ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                      {exportStatusText}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <Suspense
          fallback={
            <CenterPaneBodyLoading description="正在加载编辑器..." />
          }
        >
        {isSpreadsheetDocument ? (
          <LazySpreadsheetEditorHost
            document={activeDocument}
            onLoadSpreadsheetWorkbook={onLoadSpreadsheetWorkbook}
            onSaveSpreadsheetWorkbook={onSaveSpreadsheetWorkbook}
            onSaveStatusChange={setSaveStatus}
            onContentSnapshotReady={handleContentSnapshotReady}
          />
        ) : (
          <LazyEditorHost
            document={activeDocument}
            mentionDocuments={mentionDocuments}
            onSaveDocumentContent={onSaveDocumentContent}
            onUploadFiles={onUploadFiles}
            onSaveStatusChange={setSaveStatus}
            onFocusDiagnostic={onFocusDiagnostic}
            onFocusTargetConsumed={onFocusTargetConsumed}
            focusTarget={
              documentFocusTarget?.documentId === activeDocument.id
                ? documentFocusTarget
                : null
            }
            onContentSnapshotReady={handleContentSnapshotReady}
          />
        )}
        </Suspense>
      </div>
    </section>
  );
}
