import { RotateCcw, Trash2 } from 'lucide-react';
import type { TrashItemRecord } from '../../shared/types/preload';

interface TrashCenterPaneProps {
  activeSpaceName: string;
  items: TrashItemRecord[];
  onRestoreItem: (trashRootId: string) => Promise<void> | void;
  onDeleteItem: (trashRootId: string) => Promise<void> | void;
  onEmptyTrash: () => Promise<void> | void;
}

const formatDeletedAt = (deletedAt: string): string => {
  const timestamp = Date.parse(deletedAt);
  if (Number.isNaN(timestamp)) {
    return deletedAt;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const getDeletedAtValue = (deletedAt: string): number => {
  const timestamp = Date.parse(deletedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getItemMeta = (item: TrashItemRecord): string => {
  if (item.kind === 'document') {
    return item.folderId ? '原位置：文件夹内文档' : '原位置：根目录文档';
  }

  const childDocumentCount = item.childDocumentCount ?? 0;
  const childFolderCount = item.childFolderCount ?? 0;
  return `包含 ${childDocumentCount} 篇文档 · ${childFolderCount} 个子文件夹`;
};

export function TrashCenterPane({
  activeSpaceName,
  items,
  onRestoreItem,
  onDeleteItem,
  onEmptyTrash,
}: TrashCenterPaneProps) {
  const sortedItems = [...items].sort(
    (left, right) => getDeletedAtValue(right.deletedAt) - getDeletedAtValue(left.deletedAt),
  );

  return (
    <section
      data-testid="center-pane"
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="border-b border-[rgba(148,163,184,0.16)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-rose-50 text-rose-500 ring-1 ring-rose-100">
              <Trash2 size={18} />
            </div>
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">
                {activeSpaceName}
              </h2>
              <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">
                回收站
              </h1>
            </div>
          </div>
          <button
            type="button"
            className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={sortedItems.length === 0}
            onClick={() => {
              void onEmptyTrash();
            }}
          >
            清空回收站
          </button>
        </div>
        {sortedItems.length > 0 ? (
          <p className="mt-4 max-w-2xl text-[13px] leading-6 text-[var(--wk-muted)]">
            删除的文档和文件夹会先留在这里，方便你恢复。
          </p>
        ) : null}
      </header>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sortedItems.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-8 text-center">
            <div className="max-w-md">
              <p className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--wk-ink)]">
                回收站还是空的
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--wk-muted)]">
                删除的文档和文件夹会先留在这里，方便你恢复。
              </p>
            </div>
          </div>
        ) : (
          <div data-testid="trash-list" className="space-y-3 pb-2">
            {sortedItems.map((item) => (
              <article
                key={item.trashRootId}
                className="rounded-[20px] border border-slate-200/80 bg-white/86 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--wk-ink)]">
                      {item.title}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)]">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {item.kind === 'folder' ? '文件夹包' : '文档'}
                      </span>
                      <span>{getItemMeta(item)}</span>
                      <span>{`删除于 ${formatDeletedAt(item.deletedAt)}`}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label="恢复"
                      title={`恢复 ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                      onClick={() => {
                        void onRestoreItem(item.trashRootId);
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>恢复</span>
                    </button>
                    <button
                      type="button"
                      aria-label="彻底删除"
                      title={`彻底删除 ${item.title}`}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700 transition hover:bg-rose-100"
                      onClick={() => {
                        void onDeleteItem(item.trashRootId);
                      }}
                    >
                      <Trash2 size={14} />
                      <span>彻底删除</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
