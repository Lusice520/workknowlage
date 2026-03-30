import type { WorkspaceCollectionView } from '../shared/types/workspace';

export interface WorkspaceReloadOptions {
  activeDocumentId?: string;
  activeSpaceId?: string;
  ensureExpandedFolderIds?: string[];
  expandedFolderIds?: string[];
  activeCollectionView?: WorkspaceCollectionView;
}
