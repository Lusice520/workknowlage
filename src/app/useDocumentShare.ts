import { useEffect, useMemo, useState } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type { DocumentShareRecord, WorkspaceShareRecord } from '../shared/types/preload';

interface UseDocumentShareOptions {
  activeDocumentId: string | null;
  activeDocumentKind?: 'note' | 'spreadsheet' | null;
  activeQuickNoteDate: string | null;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
}

export interface DocumentShareState {
  shareInfo: DocumentShareRecord | null;
  shareLoading: boolean;
  shareBusy: boolean;
  shareStatusText: string;
  shareCanCopyPublicPassword: boolean;
  shareDocument: (documentId: string, contentJson: string) => Promise<void>;
  sharePublicDocument: (documentId: string, contentJson: string, options: { expiresAt?: string | null }) => Promise<void>;
  regenerateShareDocument: (documentId: string, contentJson: string) => Promise<void>;
  disableShareDocument: (documentId: string) => Promise<void>;
  disablePublicShareDocument: (documentId: string) => Promise<void>;
  copyLocalShareLink: () => Promise<void>;
  copyPublicShareLink: () => Promise<void>;
  copyPublicShareLinkWithPassword: () => Promise<void>;
  listSharesForSpace: (spaceId: string) => Promise<WorkspaceShareRecord[]>;
  resetPublicShareDocument: (documentId: string, options: { expiresAt?: string | null }) => Promise<DocumentShareRecord | null>;
  disableAllSharesForSpace: (spaceId: string) => Promise<number>;
}

const copyShareText = async (text: string | undefined): Promise<boolean> => {
  const nextText = String(text || '').trim();
  if (!nextText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(nextText);
    return true;
  } catch (error) {
    console.error('[App] Failed to copy share url:', error);
    return false;
  }
};

const getRememberedPublicPasswordKey = (share: DocumentShareRecord | null | undefined): string => {
  if (!share?.documentId || !share.publicToken) {
    return '';
  }

  return `${share.documentId}:${share.publicToken}`;
};

const buildPublicShareCopyText = (
  publicUrl: string | undefined,
  publicPassword: string | undefined,
): string => {
  const nextPublicUrl = String(publicUrl || '').trim();
  const nextPublicPassword = String(publicPassword || '').trim();
  if (!nextPublicUrl) {
    return '';
  }

  return nextPublicPassword
    ? `WorkKnowlage 临时公网分享\n链接：${nextPublicUrl}\n访问密码：${nextPublicPassword}`
    : nextPublicUrl;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : '请稍后重试';

export function useDocumentShare({
  activeDocumentId,
  activeDocumentKind = 'note',
  activeQuickNoteDate,
  onSaveDocumentContent,
}: UseDocumentShareOptions): DocumentShareState {
  const [shareInfo, setShareInfo] = useState<DocumentShareRecord | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareStatusText, setShareStatusText] = useState('分享未开启');
  const [rememberedPublicPasswords, setRememberedPublicPasswords] = useState<Record<string, string>>({});
  const rememberedPublicPassword = useMemo(() => {
    const key = getRememberedPublicPasswordKey(shareInfo);
    return key ? rememberedPublicPasswords[key] ?? '' : '';
  }, [rememberedPublicPasswords, shareInfo]);

  useEffect(() => {
    if (activeQuickNoteDate) {
      setShareInfo(null);
      setShareLoading(false);
      setShareStatusText('分享未开启');
      return;
    }

    if (!activeDocumentId) {
      setShareInfo(null);
      setShareLoading(false);
      setShareStatusText('分享未开启');
      return;
    }

    if (activeDocumentKind === 'spreadsheet') {
      setShareInfo(null);
      setShareLoading(false);
      setShareStatusText('表格不支持分享');
      return;
    }

    const api = getWorkKnowlageApi();
    let cancelled = false;

    setShareLoading(true);
    setShareStatusText('检查分享状态中');
    api.shares.get(activeDocumentId)
      .then((nextShareInfo) => {
        if (!cancelled) {
          setShareInfo(nextShareInfo);
          setShareStatusText(nextShareInfo?.enabled ? '已开启分享' : '分享未开启');
        }
      })
      .catch((error) => {
        console.error('[App] Failed to load share info:', error);
        if (!cancelled) {
          setShareInfo(null);
          setShareStatusText('分享状态获取失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShareLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, activeDocumentKind, activeQuickNoteDate]);

  const saveAndShareDocument = async (
    documentId: string,
    contentJson: string,
    action: 'create' | 'regenerate',
  ) => {
    if (activeDocumentKind === 'spreadsheet') {
      setShareInfo(null);
      setShareStatusText('表格不支持分享');
      return;
    }

    const api = getWorkKnowlageApi();
    setShareBusy(true);
    setShareStatusText(action === 'create' ? '正在开启局域分享...' : '正在刷新局域分享...');

    try {
      await onSaveDocumentContent(documentId, contentJson);
      const nextShareInfo = action === 'create'
        ? await api.shares.create(documentId)
        : await api.shares.regenerate(documentId);

      setShareInfo(nextShareInfo);
      const copied = await copyShareText(nextShareInfo?.publicUrl || nextShareInfo?.localUrl);
      if (action === 'create') {
        setShareStatusText(copied ? '已复制分享链接' : '已开启分享');
      } else {
        setShareStatusText(copied ? '已复制新分享链接' : '已更新分享链接');
      }
    } finally {
      setShareBusy(false);
    }
  };

  const shareDocument = async (documentId: string, contentJson: string) => {
    await saveAndShareDocument(documentId, contentJson, 'create');
  };

  const regenerateShareDocument = async (documentId: string, contentJson: string) => {
    await saveAndShareDocument(documentId, contentJson, 'regenerate');
  };

  const sharePublicDocument = async (
    documentId: string,
    contentJson: string,
    options: { expiresAt?: string | null },
  ) => {
    if (activeDocumentKind === 'spreadsheet') {
      setShareInfo(null);
      setShareStatusText('表格不支持分享');
      return;
    }

    const api = getWorkKnowlageApi();
    if (!api.shares.createPublic) {
      setShareStatusText('当前版本不支持临时公网分享');
      return;
    }

    setShareBusy(true);
    setShareStatusText('正在生成公网链接...');

    try {
      await onSaveDocumentContent(documentId, contentJson);
      const nextShareInfo = await api.shares.createPublic(documentId, options);
      setShareInfo(nextShareInfo);
      const publicUrl = nextShareInfo?.publicUrl;
      const publicPassword = nextShareInfo?.publicPassword;
      const rememberedKey = getRememberedPublicPasswordKey(nextShareInfo);
      if (rememberedKey && publicPassword) {
        setRememberedPublicPasswords((current) => ({
          ...current,
          [rememberedKey]: publicPassword,
        }));
      }
      const copied = await copyShareText(buildPublicShareCopyText(publicUrl, publicPassword));
      setShareStatusText(copied ? '已复制公网链接和密码' : '临时公网分享已开启');
    } catch (error) {
      console.error('[App] Failed to create public share:', error);
      setShareStatusText(`公网分享失败：${getErrorMessage(error)}`);
    } finally {
      setShareBusy(false);
    }
  };

  const disableShareDocument = async (documentId: string) => {
    if (activeDocumentKind === 'spreadsheet') {
      setShareInfo(null);
      setShareStatusText('表格不支持分享');
      return;
    }

    const api = getWorkKnowlageApi();
    setShareBusy(true);
    setShareStatusText('正在关闭局域分享...');

    try {
      const nextShareInfo = await api.shares.disable(documentId);
      setShareInfo(nextShareInfo);
      setShareStatusText('分享已关闭');
    } finally {
      setShareBusy(false);
    }
  };

  const disablePublicShareDocument = async (documentId: string) => {
    if (activeDocumentKind === 'spreadsheet') {
      setShareInfo(null);
      setShareStatusText('表格不支持分享');
      return;
    }

    const api = getWorkKnowlageApi();
    if (!api.shares.disablePublic) {
      setShareStatusText('当前版本不支持临时公网分享');
      return;
    }

    setShareBusy(true);
    setShareStatusText('正在关闭公网分享...');

    try {
      const nextShareInfo = await api.shares.disablePublic(documentId);
      const rememberedKey = getRememberedPublicPasswordKey(shareInfo);
      if (rememberedKey) {
        setRememberedPublicPasswords((current) => {
          const { [rememberedKey]: _removed, ...rest } = current;
          return rest;
        });
      }
      setShareInfo(nextShareInfo);
      setShareStatusText('临时公网分享已关闭');
    } catch (error) {
      console.error('[App] Failed to disable public share:', error);
      setShareStatusText(`关闭公网分享失败：${getErrorMessage(error)}`);
    } finally {
      setShareBusy(false);
    }
  };

  const copyLocalShareLink = async () => {
    const copied = await copyShareText(shareInfo?.localUrl || shareInfo?.publicUrl);
    setShareStatusText(copied ? '已复制局域分享链接' : '没有可复制的局域分享链接');
  };

  const copyPublicShareLink = async () => {
    const copied = await copyShareText(shareInfo?.publicUrl);
    setShareStatusText(copied ? '已复制公网链接' : '没有可复制的公网链接');
  };

  const copyPublicShareLinkWithPassword = async () => {
    const copied = await copyShareText(buildPublicShareCopyText(shareInfo?.publicUrl, rememberedPublicPassword));
    setShareStatusText(copied
      ? (rememberedPublicPassword ? '已复制公网链接和密码' : '已复制公网链接')
      : '没有可复制的公网链接');
  };

  const listSharesForSpace = async (spaceId: string) => {
    const api = getWorkKnowlageApi();
    return api.shares.listForSpace?.(spaceId) ?? [];
  };

  const resetPublicShareDocument = async (
    documentId: string,
    options: { expiresAt?: string | null },
  ): Promise<DocumentShareRecord | null> => {
    const api = getWorkKnowlageApi();
    if (!api.shares.createPublic) {
      setShareStatusText('当前版本不支持临时公网分享');
      return null;
    }

    return api.shares.createPublic(documentId, options);
  };

  const disableAllSharesForSpace = async (spaceId: string): Promise<number> => {
    const api = getWorkKnowlageApi();
    return api.shares.disableAllForSpace?.(spaceId) ?? 0;
  };

  return {
    shareInfo,
    shareLoading,
    shareBusy,
    shareStatusText,
    shareCanCopyPublicPassword: Boolean(rememberedPublicPassword),
    shareDocument,
    sharePublicDocument,
    regenerateShareDocument,
    disableShareDocument,
    disablePublicShareDocument,
    copyLocalShareLink,
    copyPublicShareLink,
    copyPublicShareLinkWithPassword,
    listSharesForSpace,
    resetPublicShareDocument,
    disableAllSharesForSpace,
  };
}
