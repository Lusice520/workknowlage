import { createContext, useContext } from 'react';
import type { EditorHostShareInfo } from '../../features/editor-host/EditorHost';
import type { DocumentShareRecord, WorkspaceShareRecord } from '../../shared/types/preload';

export interface ShareContextValue {
  shareInfo: EditorHostShareInfo | null | undefined;
  shareBusy: boolean | undefined;
  shareLoading: boolean | undefined;
  shareStatusText: string | null | undefined;
  shareCanCopyPublicPassword?: boolean;
  onShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onSharePublicDocument: (documentId: string, contentJson: string, options: { expiresAt?: string | null }) => Promise<void> | void;
  onRegenerateShareDocument: (documentId: string, contentJson: string) => Promise<void> | void;
  onDisableShareDocument: (documentId: string) => Promise<void> | void;
  onDisablePublicShareDocument: (documentId: string) => Promise<void> | void;
  onCopyLocalShareLink?: () => Promise<void> | void;
  onCopyPublicShareLink?: () => Promise<void> | void;
  onCopyPublicShareLinkWithPassword?: () => Promise<void> | void;
  onListSharesForSpace?: (spaceId: string) => Promise<WorkspaceShareRecord[]>;
  onResetPublicShare?: (documentId: string, options: { expiresAt?: string | null }) => Promise<DocumentShareRecord | null>;
  onDisableAllSharesForSpace?: (spaceId: string) => Promise<number>;
}

const ShareContext = createContext<ShareContextValue | null>(null);

export const ShareContextProvider = ShareContext.Provider;

export const useShareContext = (): ShareContextValue => {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShareContext 必须在 ShareContextProvider 内使用');
  return ctx;
};
