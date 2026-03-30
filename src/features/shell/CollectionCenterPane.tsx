import { useDeferredValue, useState } from 'react';
import { FileText, FolderTree, Search, Star } from 'lucide-react';
import { getDocumentsForCollectionView } from '../../shared/lib/workspaceSelectors';
import type {
  DocumentRecord,
  FolderNode,
  WorkspaceCollectionView,
} from '../../shared/types/workspace';

type CollectionView = Exclude<WorkspaceCollectionView, 'tree' | 'trash'>;

interface CollectionCenterPaneProps {
  view: CollectionView;
  activeSpaceName: string;
  documents: DocumentRecord[];
  folders: FolderNode[];
  onOpenDocument: (documentId: string) => void;
  onSetDocumentFavorite: (documentId: string, isFavorite: boolean) => Promise<void> | void;
}

const COLLECTION_SEARCH_INPUT_STYLE = {
  fontSize: '14px',
  lineHeight: '1.2',
} as const;

const COLLECTION_TITLE_BUTTON_STYLE = {
  fontSize: '14px',
  lineHeight: '1.3',
  fontWeight: 600,
} as const;

const COLLECTION_COPY: Record<CollectionView, {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  'all-notes': {
    title: '所有笔记',
    description: '按最近编辑浏览当前空间的全部正式文档。',
    emptyTitle: '还没有文档',
    emptyDescription: '先创建第一篇文档，让这个空间开始积累知识。',
  },
  favorites: {
    title: '收藏夹',
    description: '把最常回看的文档固定在这里，方便随时打开。',
    emptyTitle: '收藏夹还是空的',
    emptyDescription: '先去收藏几篇文档，这里就会成为你的快捷入口。',
  },
};

const getDocumentLocationLabel = (
  folders: FolderNode[],
  folderId: string | null,
): string => {
  if (!folderId) {
    return '根目录';
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? '未知目录';
};

const matchesSearchQuery = (
  document: DocumentRecord,
  folders: FolderNode[],
  normalizedQuery: string,
): boolean => {
  if (!normalizedQuery) {
    return true;
  }

  const locationLabel = getDocumentLocationLabel(folders, document.folderId);
  const searchableText = [
    document.title,
    document.badgeLabel,
    locationLabel,
    ...document.tags.map((tag) => tag.label),
  ]
    .join(' ')
    .toLocaleLowerCase();

  return searchableText.includes(normalizedQuery);
};

export function CollectionCenterPane({
  view,
  activeSpaceName,
  documents,
  folders,
  onOpenDocument,
  onSetDocumentFavorite,
}: CollectionCenterPaneProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const copy = COLLECTION_COPY[view];
  const normalizedSearchQuery = deferredSearchQuery.trim().toLocaleLowerCase();
  const collectionDocuments = getDocumentsForCollectionView(documents, view);
  const visibleDocuments = collectionDocuments.filter((document) =>
    matchesSearchQuery(document, folders, normalizedSearchQuery)
  );
  const emptyTitle = normalizedSearchQuery ? '没有找到匹配文档' : copy.emptyTitle;
  const emptyDescription = normalizedSearchQuery
    ? '试试别的标题、标签或目录关键词。'
    : copy.emptyDescription;

  return (
    <section
      data-testid="center-pane"
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="border-b border-[rgba(148,163,184,0.16)] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            {view === 'favorites' ? <Star size={18} fill="currentColor" /> : <FileText size={18} />}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">
              {activeSpaceName}
            </p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">
              {copy.title}
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-[13px] leading-6 text-[var(--wk-muted)]">
          {copy.description}
        </p>
        <label className="mt-4 flex items-center gap-2 rounded-[14px] border border-slate-200/80 bg-white/88 px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
          <Search size={14} className="text-slate-400" />
          <input
            type="search"
            aria-label={`检索${copy.title}`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索标题、标签或目录"
            style={COLLECTION_SEARCH_INPUT_STYLE}
            className="w-full bg-transparent text-[14px] leading-[1.2] text-slate-700 outline-none placeholder:text-[13px] placeholder:text-slate-400"
          />
        </label>
      </header>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {visibleDocuments.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-8 text-center">
            <div className="max-w-md">
              <p className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--wk-ink)]">
                {emptyTitle}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--wk-muted)]">
                {emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {visibleDocuments.map((document) => {
              const isFavorite = Boolean(document.isFavorite);
              const locationLabel = getDocumentLocationLabel(folders, document.folderId);
              const favoriteLabel = `${isFavorite ? '取消收藏' : '收藏'}文档 ${document.title}`;

              return (
                <article
                  key={document.id}
                  className="rounded-[20px] border border-slate-200/80 bg-white/86 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        aria-label={`打开文档 ${document.title}`}
                        style={COLLECTION_TITLE_BUTTON_STYLE}
                        className="block text-left text-[14px] leading-[1.3] font-semibold tracking-[-0.01em] text-[var(--wk-ink)] transition hover:text-blue-600"
                        onClick={() => onOpenDocument(document.id)}
                      >
                        {document.title}
                      </button>
                      <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                          <FolderTree size={12} />
                          {locationLabel}
                        </span>
                        <span>{document.updatedAtLabel}</span>
                        <span>{document.wordCountLabel}</span>
                        {document.badgeLabel ? (
                          <span className="rounded-full bg-[rgba(59,130,246,0.08)] px-2.5 py-1 text-[11px] font-medium text-[var(--wk-accent)]">
                            #{document.badgeLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={favoriteLabel}
                      title={favoriteLabel}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition ${
                        isFavorite
                          ? 'border-amber-200 bg-amber-50 text-amber-500'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-blue-200 hover:text-blue-600'
                      }`}
                      onClick={() => onSetDocumentFavorite(document.id, !isFavorite)}
                    >
                      <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
