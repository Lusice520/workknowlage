import { Database, FolderSearch, HardDriveDownload, RefreshCw, Trash2, X } from 'lucide-react';
import type { WorkKnowlageRuntimeStatus } from '../../shared/lib/workKnowlageApi';
import type { WorkKnowlageStorageInfo } from '../../shared/types/preload';

interface SettingsModalProps {
  open: boolean;
  runtimeStatus: WorkKnowlageRuntimeStatus;
  persistenceFeedback: string;
  storageInfo?: WorkKnowlageStorageInfo | null;
  lastPersistedAt?: string | null;
  dataToolsFeedback?: string | null;
  runningDataTool?: string | null;
  onClose: () => Promise<void> | void;
  onOpenDataDirectory: () => Promise<void> | void;
  onCreateBackup: () => Promise<void> | void;
  onRestoreBackup: () => Promise<void> | void;
  onRebuildSearchIndex: () => Promise<void> | void;
  onCleanupOrphanAttachments: () => Promise<void> | void;
}

const toolButtonClassName =
  'rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[12px] font-medium text-slate-700 transition hover:bg-slate-100';

export function SettingsModal({
  open,
  runtimeStatus,
  persistenceFeedback,
  storageInfo,
  lastPersistedAt,
  dataToolsFeedback,
  runningDataTool,
  onClose,
  onOpenDataDirectory,
  onCreateBackup,
  onRestoreBackup,
  onRebuildSearchIndex,
  onCleanupOrphanAttachments,
}: SettingsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-6 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/96 shadow-[0_30px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[rgba(148,163,184,0.16)] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Database size={20} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">
                Storage &amp; Data
              </p>
              <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">
                设置
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭设置"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => {
              void onClose();
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 custom-scrollbar">
          <section className="rounded-[20px] border border-slate-200/80 bg-slate-50/75 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${
                  runtimeStatus.tone === 'positive'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-100/80 text-amber-800'
                }`}
              >
                {runtimeStatus.storageLabel}
              </span>
              <span className="text-[12px] font-medium text-slate-700">{runtimeStatus.summary}</span>
            </div>
            <div className="mt-3 space-y-2 text-[12px] text-slate-600">
              <p>{persistenceFeedback}</p>
              {lastPersistedAt ? <p className="text-slate-500">{`最近写入 ${lastPersistedAt}`}</p> : null}
              {storageInfo ? <p>{`覆盖：${storageInfo.scopeLabel}`}</p> : null}
              {storageInfo ? (
                <p className="break-all font-mono text-[11px] text-slate-500">{`位置：${storageInfo.storagePath}`}</p>
              ) : null}
            </div>
          </section>

          <section className="mt-4 rounded-[20px] border border-slate-200/80 bg-white/86 p-5 shadow-[0_4px_14px_rgba(15,23,42,0.035)]">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.01em] text-slate-800">数据工具</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Maintenance
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={toolButtonClassName}
                onClick={() => {
                  void onOpenDataDirectory();
                }}
              >
                <span className="flex items-center gap-2">
                  <FolderSearch size={14} />
                  打开数据目录
                </span>
              </button>
              <button
                type="button"
                className={toolButtonClassName}
                onClick={() => {
                  void onCreateBackup();
                }}
              >
                <span className="flex items-center gap-2">
                  <HardDriveDownload size={14} />
                  创建备份
                </span>
              </button>
              <button
                type="button"
                className={toolButtonClassName}
                onClick={() => {
                  void onRestoreBackup();
                }}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} />
                  从备份恢复
                </span>
              </button>
              <button
                type="button"
                className={toolButtonClassName}
                onClick={() => {
                  void onRebuildSearchIndex();
                }}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} />
                  重建搜索索引
                </span>
              </button>
              <button
                type="button"
                className={`${toolButtonClassName} sm:col-span-2`}
                onClick={() => {
                  void onCleanupOrphanAttachments();
                }}
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={14} />
                  清理孤儿附件
                </span>
              </button>
            </div>
            {runningDataTool ? (
              <p className="mt-4 text-[11px] text-slate-500">{`${runningDataTool}处理中...`}</p>
            ) : null}
            {dataToolsFeedback ? (
              <p className="mt-2 text-[12px] text-slate-600">{dataToolsFeedback}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
