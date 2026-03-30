import { useEffect, useState } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type { DocumentShareRecord } from '../shared/types/preload';

interface UseDocumentShareOptions {
  activeDocumentId: string | null;
  activeQuickNoteDate: string | null;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
}

export interface DocumentShareState {
  shareInfo: DocumentShareRecord | null;
  shareLoading: boolean;
  shareBusy: boolean;
  shareStatusText: string;
  shareDocument: (documentId: string, contentJson: string) => Promise<void>;
  regenerateShareDocument: (documentId: string, contentJson: string) => Promise<void>;
  disableShareDocument: (documentId: string) => Promise<void>;
}

const copyShareUrl = async (publicUrl: string | undefined): Promise<boolean> => {
  const nextPublicUrl = String(publicUrl || '').trim();
  if (!nextPublicUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(nextPublicUrl);
    return true;
  } catch (error) {
    console.error('[App] Failed to copy share url:', error);
    return false;
  }
};

export function useDocumentShare({
  activeDocumentId,
  activeQuickNoteDate,
  onSaveDocumentContent,
}: UseDocumentShareOptions): DocumentShareState {
  const [shareInfo, setShareInfo] = useState<DocumentShareRecord | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareStatusText, setShareStatusText] = useState('分享未开启');

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
  }, [activeDocumentId, activeQuickNoteDate]);

  const saveAndShareDocument = async (
    documentId: string,
    contentJson: string,
    action: 'create' | 'regenerate',
  ) => {
    const api = getWorkKnowlageApi();
    setShareBusy(true);

    try {
      await onSaveDocumentContent(documentId, contentJson);
      const nextShareInfo = action === 'create'
        ? await api.shares.create(documentId)
        : await api.shares.regenerate(documentId);

      setShareInfo(nextShareInfo);
      const copied = await copyShareUrl(nextShareInfo?.publicUrl);
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

  const disableShareDocument = async (documentId: string) => {
    const api = getWorkKnowlageApi();
    setShareBusy(true);

    try {
      const nextShareInfo = await api.shares.disable(documentId);
      setShareInfo(nextShareInfo);
      setShareStatusText('分享已关闭');
    } finally {
      setShareBusy(false);
    }
  };

  return {
    shareInfo,
    shareLoading,
    shareBusy,
    shareStatusText,
    shareDocument,
    regenerateShareDocument,
    disableShareDocument,
  };
}
