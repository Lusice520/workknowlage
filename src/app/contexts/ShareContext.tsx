import { createContext, useContext } from 'react';
import type { EditorHostShareInfo } from '../../features/editor-host/EditorHost';

export interface ShareContextValue {
  shareInfo: EditorHostShareInfo | null | undefined;
  shareBusy: boolean | undefined;
  shareLoading: boolean | undefined;
  shareStatusText: string | null | undefined;
  onShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onRegenerateShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onDisableShareDocument: (documentId: string) => Promise<void> | void;
}

const ShareContext = createContext<ShareContextValue | null>(null);

export const ShareContextProvider = ShareContext.Provider;

export const useShareContext = (): ShareContextValue => {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShareContext 必须在 ShareContextProvider 内使用');
  return ctx;
};
