import type { WorkKnowlageDesktopApi } from '../types/preload';
import { cloneWorkspaceSeed, createMutableFallbackDesktopApi } from './workKnowlageApi.mock';

type RuntimeMode = 'electron-sqlite' | 'browser-mock';
type PersistenceMode = 'disk' | 'memory';

export interface WorkKnowlageRuntimeStatus {
  storageLabel: string;
  summary: string;
  detail: string;
  isPersistent: boolean;
  tone: 'positive' | 'warning';
}

/**
 * Fallback API used when running in browser mode (outside Electron).
 * Returns a fresh mutable mock store so tests can create isolated API instances.
 */
export const createFallbackDesktopApi = (): WorkKnowlageDesktopApi =>
  createMutableFallbackDesktopApi({
    seed: cloneWorkspaceSeed(),
    shares: {},
    spreadsheets: {},
    uploadedAssets: {},
    quickNotes: [],
  });

const fallbackDesktopApi = createMutableFallbackDesktopApi({
  seed: cloneWorkspaceSeed(),
  shares: {},
  spreadsheets: {},
  uploadedAssets: {},
  quickNotes: [],
});

export const getWorkKnowlageApi = (): WorkKnowlageDesktopApi => {
  if (typeof window !== 'undefined' && window.workKnowlage) {
    return window.workKnowlage;
  }

  return fallbackDesktopApi;
};

export const getWorkKnowlageRuntimeStatus = (
  api: WorkKnowlageDesktopApi = getWorkKnowlageApi()
): WorkKnowlageRuntimeStatus => {
  const runtime = (api.meta.runtime ?? 'browser-mock') as RuntimeMode;
  const persistence = (api.meta.persistence ?? (runtime === 'electron-sqlite' ? 'disk' : 'memory')) as PersistenceMode;
  const isPersistent = runtime === 'electron-sqlite' && persistence === 'disk';

  if (isPersistent) {
    return {
      storageLabel: api.meta.storageLabel ?? 'SQLite 本地数据库',
      summary: '会自动保存到本机',
      detail: '当前写入会持久化到本地数据库',
      isPersistent: true,
      tone: 'positive',
    };
  }

  return {
    storageLabel: api.meta.storageLabel ?? '浏览器内存 Mock',
    summary: '关闭页面后会丢失',
    detail: '当前仅保存在浏览器会话',
    isPersistent: false,
    tone: 'warning',
  };
};
