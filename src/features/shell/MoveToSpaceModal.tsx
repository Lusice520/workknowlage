import { ArrowRightLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Space } from '../../shared/types/workspace';

interface MoveToSpaceModalProps {
  open: boolean;
  itemLabel: string;
  itemKind: 'document' | 'folder';
  spaces: Space[];
  currentSpaceId: string | null;
  submitting?: boolean;
  onClose: () => Promise<void> | void;
  onConfirm: (targetSpaceId: string) => Promise<void> | void;
}

export function MoveToSpaceModal({
  open,
  itemLabel,
  itemKind,
  spaces,
  currentSpaceId,
  submitting = false,
  onClose,
  onConfirm,
}: MoveToSpaceModalProps) {
  const targetSpaces = spaces.filter((space) => space.id !== currentSpaceId);
  const defaultTargetSpaceId = targetSpaces[0]?.id ?? '';
  const [selectedSpaceId, setSelectedSpaceId] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedSpaceId('');
      return;
    }

    setSelectedSpaceId(defaultTargetSpaceId);
  }, [defaultTargetSpaceId, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-6 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="移动到空间"
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/96 shadow-[0_30px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[rgba(148,163,184,0.16)] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">
                Cross-Space Move
              </p>
              <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">
                移动到空间
              </h2>
              <p className="mt-2 text-[12px] text-slate-500">{`把${itemKind === 'folder' ? '文件夹' : '文档'}「${itemLabel}」移动到目标空间根目录`}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭移动到空间"
            disabled={submitting}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              void onClose();
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 custom-scrollbar">
          {targetSpaces.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[12px] font-semibold tracking-[0.01em] text-slate-800">选择目标空间</p>
              <div className="space-y-2">
                {targetSpaces.map((space) => {
                  const isSelected = selectedSpaceId === space.id;

                  return (
                    <button
                      key={space.id}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={submitting}
                      className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-[0_6px_18px_rgba(59,130,246,0.12)]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                      onClick={() => setSelectedSpaceId(space.id)}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold">{space.name}</span>
                        <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          {space.label}
                        </span>
                      </span>
                      <span className="text-[12px] font-medium text-slate-400">
                        {isSelected ? '已选择' : '选择'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <section className="rounded-[20px] border border-slate-200/80 bg-slate-50/75 p-5 text-[12px] text-slate-600">
              当前没有可移动到的其他空间。
            </section>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[rgba(148,163,184,0.16)] px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            className="rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onClose();
            }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedSpaceId || submitting}
            className="rounded-[14px] bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            onClick={() => {
              if (!selectedSpaceId || submitting) {
                return;
              }

              void onConfirm(selectedSpaceId);
            }}
          >
            {submitting ? '移动中...' : '确认移动'}
          </button>
        </footer>
      </div>
    </div>
  );
}
