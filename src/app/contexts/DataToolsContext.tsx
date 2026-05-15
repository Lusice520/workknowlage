import { createContext, useContext } from 'react';
import type { WorkKnowlageRuntimeStatus } from '../../shared/lib/workKnowlageApi';
import type { DataToolActionDetailItem, WorkKnowlageStorageInfo } from '../../shared/types/preload';

export interface DataToolsContextValue {
  runtimeStatus: WorkKnowlageRuntimeStatus;
  storageInfo: WorkKnowlageStorageInfo | null | undefined;
  persistenceFeedback: string;
  lastPersistedAt: string | null | undefined;
  dataToolsFeedback: string | null | undefined;
  dataToolsDetails: DataToolActionDetailItem[] | undefined;
  runningDataTool: string | null | undefined;
  settingsOpen: boolean;
  onOpenSettings: () => Promise<void> | void;
  onCloseSettings: () => Promise<void> | void;
  onOpenDataDirectory: () => Promise<void>;
  onCreateBackup: () => Promise<void>;
  onRestoreBackup: () => Promise<void>;
  onRebuildSearchIndex: () => Promise<void>;
  onInspectDocumentContentHealth: () => Promise<void>;
  onCleanupOrphanAttachments: () => Promise<void>;
}

const DataToolsContext = createContext<DataToolsContextValue | null>(null);

export const DataToolsContextProvider = DataToolsContext.Provider;

export const useDataToolsContext = (): DataToolsContextValue => {
  const ctx = useContext(DataToolsContext);
  if (!ctx) throw new Error('useDataToolsContext 必须在 DataToolsContextProvider 内使用');
  return ctx;
};
