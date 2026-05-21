import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Globe2, Link2, Link2Off, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import type { FolderNode, Space } from '../../shared/types/workspace';
import type { DocumentShareRecord, WorkspaceShareRecord } from '../../shared/types/preload';

interface SharedLinksCenterPaneProps {
  activeSpace: Space | null;
  folders: FolderNode[];
  onOpenDocument: (documentId: string) => void;
  onListSharesForSpace?: (spaceId: string) => Promise<WorkspaceShareRecord[]>;
  onDisableLocalShare: (documentId: string) => Promise<unknown> | unknown;
  onDisablePublicShare: (documentId: string) => Promise<unknown> | unknown;
  onResetPublicShare?: (documentId: string, options: { expiresAt?: string | null }) => Promise<DocumentShareRecord | null>;
  onDisableAllSharesForSpace?: (spaceId: string) => Promise<number>;
}

type ShareAction = 'close-local' | 'close-public' | 'reset-public' | 'close-all';

const copyText = async (text: string): Promise<boolean> => {
  const nextText = text.trim();
  if (!nextText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(nextText);
    return true;
  } catch (error) {
    console.error('[SharedLinksCenterPane] Failed to copy share link:', error);
    return false;
  }
};

const getPublicPasswordKey = (share: DocumentShareRecord | WorkspaceShareRecord | null | undefined): string => {
  if (!share?.documentId || !share.publicToken) {
    return '';
  }

  return `${share.documentId}:${share.publicToken}`;
};

const buildPublicShareCopyText = (publicUrl: string | undefined, password: string | undefined): string => {
  const nextPublicUrl = String(publicUrl || '').trim();
  const nextPassword = String(password || '').trim();
  if (!nextPublicUrl) {
    return '';
  }

  return nextPassword
    ? `WorkKnowlage 临时公网分享\n链接：${nextPublicUrl}\n访问密码：${nextPassword}`
    : nextPublicUrl;
};

const formatPublicExpiry = (expiresAt?: string | null): string => {
  if (!expiresAt) {
    return '手动关闭';
  }

  const expiresTime = Date.parse(expiresAt);
  if (Number.isNaN(expiresTime)) {
    return '已设置到期时间';
  }

  const remainingMs = expiresTime - Date.now();
  if (remainingMs <= 0) {
    return '已到期';
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) {
    return `${remainingMinutes} 分钟后过期`;
  }

  const remainingHours = Math.ceil(remainingMinutes / 60);
  return `${remainingHours} 小时后过期`;
};

export function SharedLinksCenterPane({
  activeSpace,
  folders,
  onOpenDocument,
  onListSharesForSpace,
  onDisableLocalShare,
  onDisablePublicShare,
  onResetPublicShare,
  onDisableAllSharesForSpace,
}: SharedLinksCenterPaneProps): JSX.Element {
  const [shares, setShares] = useState<WorkspaceShareRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('正在加载共享链接');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rememberedPublicPasswords, setRememberedPublicPasswords] = useState<Record<string, string>>({});

  const loadShares = useCallback(async () => {
    if (!activeSpace?.id) {
      setShares([]);
      setFeedback('请选择空间');
      return;
    }

    if (!onListSharesForSpace) {
      setShares([]);
      setFeedback('当前版本不支持共享链接列表');
      return;
    }

    setLoading(true);
    try {
      const nextShares = await onListSharesForSpace(activeSpace.id);
      setShares(nextShares);
      setFeedback(nextShares.length > 0 ? `共 ${nextShares.length} 篇文档正在分享` : '当前空间没有共享链接');
    } catch (error) {
      console.error('[SharedLinksCenterPane] Failed to load shares:', error);
      setShares([]);
      setFeedback('共享链接加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeSpace?.id, onListSharesForSpace]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const hasShares = shares.length > 0;
  const activeLocalCount = useMemo(() => shares.filter((share) => share.enabled).length, [shares]);
  const activePublicCount = useMemo(() => shares.filter((share) => share.publicEnabled).length, [shares]);
  const getFolderLabel = useCallback((folderId?: string | null): string => {
    if (!folderId) {
      return '根目录';
    }

    return folders.find((folder) => folder.id === folderId)?.name ?? '未知目录';
  }, [folders]);

  const runShareAction = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
      await loadShares();
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopyLocal = async (share: WorkspaceShareRecord) => {
    const copied = await copyText(share.localUrl || share.publicUrl || '');
    setFeedback(copied ? '已复制局域分享链接' : '没有可复制的局域分享链接');
  };

  const handleCopyPublic = async (share: WorkspaceShareRecord) => {
    const password = rememberedPublicPasswords[getPublicPasswordKey(share)] ?? '';
    const copied = await copyText(buildPublicShareCopyText(share.publicUrl, password));
    setFeedback(copied
      ? (password ? '已复制公网链接和密码' : '已复制公网链接')
      : '没有可复制的公网链接');
  };

  const handleCloseLocal = async (share: WorkspaceShareRecord) => {
    await runShareAction(`${share.documentId}:close-local`, async () => {
      await onDisableLocalShare(share.documentId);
      setFeedback('局域分享已关闭');
    });
  };

  const handleClosePublic = async (share: WorkspaceShareRecord) => {
    await runShareAction(`${share.documentId}:close-public`, async () => {
      await onDisablePublicShare(share.documentId);
      setFeedback('临时公网分享已关闭');
    });
  };

  const handleResetPublic = async (share: WorkspaceShareRecord) => {
    if (!onResetPublicShare) {
      setFeedback('当前版本不支持重置公网分享');
      return;
    }

    await runShareAction(`${share.documentId}:reset-public`, async () => {
      setFeedback('正在重置公网链接和密码...');
      const nextShare = await onResetPublicShare(share.documentId, {
        expiresAt: share.publicExpiresAt ?? null,
      });
      const key = getPublicPasswordKey(nextShare);
      if (key && nextShare?.publicPassword) {
        setRememberedPublicPasswords((current) => ({
          ...current,
          [key]: nextShare.publicPassword ?? '',
        }));
      }
      const copied = await copyText(buildPublicShareCopyText(nextShare?.publicUrl, nextShare?.publicPassword));
      setFeedback(copied ? '已重置并复制公网链接和密码' : '公网链接和密码已重置');
    });
  };

  const handleCloseAll = async () => {
    if (!activeSpace?.id) {
      return;
    }

    if (!onDisableAllSharesForSpace) {
      setFeedback('当前版本不支持一键关闭');
      return;
    }

    await runShareAction('workspace:close-all', async () => {
      const disabledCount = await onDisableAllSharesForSpace(activeSpace.id);
      setFeedback(`已关闭 ${disabledCount ?? 0} 篇文档的共享链接`);
    });
  };

  const renderActionButton = (
    label: string,
    icon: JSX.Element,
    actionKey: string,
    onClick: () => Promise<void>,
    tone: 'default' | 'danger' = 'default',
  ) => {
    const isBusy = busyKey === actionKey;
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-[12px] border px-2.5 py-1.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
          tone === 'danger'
            ? 'border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100'
            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600'
        }`}
        onClick={() => {
          void onClick();
        }}
        disabled={Boolean(busyKey)}
      >
        {isBusy ? <LoaderCircle size={13} className="animate-spin" /> : icon}
        {label}
      </button>
    );
  };

  return (
    <section
      data-testid="center-pane"
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="border-b border-[rgba(148,163,184,0.16)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Link2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--wk-accent)]">
                {activeSpace?.name ?? '个人工作空间'}
              </p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-[var(--wk-ink)]">
                共享链接
              </h1>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[14px] border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void handleCloseAll();
            }}
            disabled={!hasShares || Boolean(busyKey)}
          >
            {busyKey === 'workspace:close-all' ? <LoaderCircle size={14} className="animate-spin" /> : <Link2Off size={14} />}
            一键关闭所有链接
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--wk-muted)]">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
            {feedback}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-600">
            局域 {activeLocalCount}
          </span>
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-600">
            公网 {activePublicCount}
          </span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-600">
              <LoaderCircle size={12} className="animate-spin" />
              正在刷新
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {!hasShares ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-8 text-center">
            <div className="max-w-md">
              <p className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--wk-ink)]">
                当前空间没有共享链接
              </p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--wk-muted)]">
                从文档标题右上角的分享菜单开启局域分享或临时公网分享后，会在这里集中管理。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {shares.map((share) => (
              <article
                key={share.documentId}
                className="rounded-[20px] border border-slate-200/80 bg-white/86 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="block text-left text-[14px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--wk-ink)] transition hover:text-blue-600"
                      onClick={() => onOpenDocument(share.documentId)}
                    >
                      {share.documentTitle}
                    </button>
                    <p className="mt-1 truncate text-[12px] text-[var(--wk-muted)]">
                      {getFolderLabel(share.folderId)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {share.documentKind === 'spreadsheet' ? '表格' : '文档'}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {share.enabled ? (
                    <div className="rounded-[16px] border border-slate-100 bg-slate-50/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                            <Link2 size={14} className="text-blue-500" />
                            局域分享
                          </div>
                          <p className="mt-1 truncate text-[12px] text-slate-500">
                            {share.localUrl || '局域链接暂不可用'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {renderActionButton('复制', <Copy size={13} />, `${share.documentId}:copy-local`, () => handleCopyLocal(share))}
                          {renderActionButton('关闭', <Link2Off size={13} />, `${share.documentId}:close-local`, () => handleCloseLocal(share), 'danger')}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {share.publicEnabled ? (
                    <div className="rounded-[16px] border border-indigo-100 bg-indigo-50/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[12px] font-semibold text-indigo-700">
                            <Globe2 size={14} className="text-indigo-500" />
                            临时公网分享
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                              <ShieldCheck size={11} />
                              {formatPublicExpiry(share.publicExpiresAt)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-slate-500">
                            {share.publicUrl || '公网链接需要当前 tunnel 运行'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {renderActionButton(
                            rememberedPublicPasswords[getPublicPasswordKey(share)] ? '复制链接和密码' : '复制链接',
                            <Copy size={13} />,
                            `${share.documentId}:copy-public`,
                            () => handleCopyPublic(share),
                          )}
                          {renderActionButton('重置', <RefreshCw size={13} />, `${share.documentId}:reset-public`, () => handleResetPublic(share))}
                          {renderActionButton('关闭', <Link2Off size={13} />, `${share.documentId}:close-public`, () => handleClosePublic(share), 'danger')}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
