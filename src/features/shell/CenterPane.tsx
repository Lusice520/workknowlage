import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronDown, Download, Link2Off, LoaderCircle, RefreshCw, Share2, Star } from 'lucide-react';
import type { EditorHostShareInfo } from '../editor-host/EditorHost';
import type { EditorSaveStatus } from '../editor-host/useEditorPersistence';
import { buildMentionDocumentCandidates } from '../../shared/lib/documentPaths';
import { getQuickNoteTitle } from '../../shared/lib/quickNotes';
import { CollectionCenterPane } from './CollectionCenterPane';
import { CenterPaneLoading } from './CenterPaneLoading';
import { prefetchQuickNoteRecord } from './quickNoteCache';
import { sharedMenuDropdownClassName, sharedMenuItemClassName } from './sharedMenuStyles';
import { TrashCenterPane } from './TrashCenterPane';
import type {
  DocumentFocusTarget,
  DocumentRecord,
  FolderNode,
  QuickNoteRecord,
  Space,
  WorkspaceCollectionView,
} from '../../shared/types/workspace';
import type { TrashItemRecord } from '../../shared/types/preload';

const LazyEditorHost = lazy(() =>
  import('../editor-host/EditorHost').then((module) => ({ default: module.EditorHost }))
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
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
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
  onSaveDocumentContent,
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
}: CenterPaneProps) {
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('saved');
  const [quickNotePreviewText, setQuickNotePreviewText] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
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

  const collectionView = activeCollectionView === 'tree' || activeCollectionView === 'trash'
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

  const hasShare = Boolean(String(shareInfo?.token || '').trim());
  const isFavorite = Boolean(activeDocument.isFavorite);
  const favoriteLabel = `${isFavorite ? '取消收藏' : '收藏'}文档 ${activeDocument.title}`;
  const shareLabel = shareLoading ? '检查分享' : (hasShare ? '复制分享链接' : '开启分享');
  const refreshShareLabel = '重新生成分享链接';
  const disableShareLabel = '关闭分享';
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
    : (shareStatusText?.includes('复制') || shareStatusText?.includes('开启') || shareStatusText?.includes('更新'))
      ? 'bg-blue-50 text-blue-600'
      : 'bg-slate-100 text-slate-500';

  const getCurrentContentJson = () => contentSnapshotRef.current();

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
          <button
            type="button"
            aria-label={shareLabel}
            title={shareLabel}
            className={`rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60 ${
              hasShare ? 'text-blue-600' : 'text-[var(--wk-ink-soft)]'
            }`}
            onClick={() => onShareDocument(activeDocument.id, getCurrentContentJson())}
            disabled={shareBusy || shareLoading}
          >
            <Share2 size={15} />
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="导出"
              title={exportStatusText || '导出文档'}
              className="flex items-center gap-1 rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 px-2.5 py-1.5 text-[12px] font-medium text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setExportMenuOpen((current) => !current)}
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
              </div>
            ) : null}
          </div>
          {hasShare ? (
            <>
              <button
                type="button"
                aria-label={refreshShareLabel}
                title={refreshShareLabel}
                className="rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onRegenerateShareDocument(activeDocument.id, getCurrentContentJson())}
                disabled={shareBusy || shareLoading}
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                aria-label={disableShareLabel}
                title={disableShareLabel}
                className="rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onDisableShareDocument(activeDocument.id)}
                disabled={shareBusy || shareLoading}
              >
                <Link2Off size={15} />
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        <div className="px-1">
          <h1 className="text-[22px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--wk-ink)]">
            {activeDocument.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)]">
            <span>{activeDocument.updatedAtLabel}</span>
            <span>{activeDocument.wordCountLabel}</span>
            <span className="h-1 w-1 rounded-full bg-[rgba(148,163,184,0.9)]" />
            <span className="rounded-full bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[11px] font-medium text-[var(--wk-accent)]">
              #{activeDocument.badgeLabel}
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${shareMetaToneClass}`}>
              {shareStatusText || '分享未开启'}
            </span>
            {exportStatusText ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                {exportStatusText}
              </span>
            ) : null}
          </div>
        </div>

        <Suspense
          fallback={
            <CenterPaneBodyLoading description="正在加载编辑器..." />
          }
        >
        <LazyEditorHost
          document={activeDocument}
          mentionDocuments={mentionDocuments}
          onSaveDocumentContent={onSaveDocumentContent}
          onUploadFiles={onUploadFiles}
          onSaveStatusChange={setSaveStatus}
          focusTarget={
            documentFocusTarget?.documentId === activeDocument.id
              ? documentFocusTarget
              : null
          }
          onContentSnapshotReady={handleContentSnapshotReady}
        />
        </Suspense>
      </div>
    </section>
  );
}
