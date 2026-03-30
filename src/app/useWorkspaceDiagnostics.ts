import { useCallback, useEffect, useState } from 'react';
import { getWorkKnowlageApi, type WorkKnowlageRuntimeStatus } from '../shared/lib/workKnowlageApi';
import type { WorkKnowlageStorageInfo } from '../shared/types/preload';

export interface WorkspaceDiagnosticsState {
  storageInfo: WorkKnowlageStorageInfo | null;
  persistenceFeedback: string;
  lastPersistedAt: string | null;
  markPersistenceFeedback: (actionLabel: string) => void;
}

const buildTimestampLabel = (): string =>
  new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

export function useWorkspaceDiagnostics(
  runtimeStatus: WorkKnowlageRuntimeStatus,
): WorkspaceDiagnosticsState {
  const [storageInfo, setStorageInfo] = useState<WorkKnowlageStorageInfo | null>(null);
  const [persistenceFeedback, setPersistenceFeedback] = useState<string>(runtimeStatus.detail);
  const [lastPersistedAt, setLastPersistedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = getWorkKnowlageApi();

    api.meta.getStorageInfo?.()
      .then((nextStorageInfo) => {
        if (!cancelled) {
          setStorageInfo(nextStorageInfo);
        }
      })
      .catch((error) => {
        console.error('[App] Failed to load storage diagnostics:', error);
        if (!cancelled) {
          setStorageInfo(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeStatus.storageLabel]);

  const markPersistenceFeedback = useCallback(
    (actionLabel: string) => {
      const suffix = runtimeStatus.isPersistent
        ? '已保存到本地数据库'
        : '仅保存在浏览器会话';

      setPersistenceFeedback(`${actionLabel}${suffix}`);
      setLastPersistedAt(buildTimestampLabel());
    },
    [runtimeStatus.isPersistent],
  );

  return {
    storageInfo,
    persistenceFeedback,
    lastPersistedAt,
    markPersistenceFeedback,
  };
}
