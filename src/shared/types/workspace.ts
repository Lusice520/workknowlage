export interface Space {
  id: string;
  name: string;
  label: string;
}

export interface FolderNode {
  id: string;
  spaceId: string;
  parentId: string | null;
  name: string;
  sortOrder?: number;
  deletedAt?: string | null;
  trashRootId?: string | null;
}

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
}

export interface TagRecord {
  id: string;
  label: string;
  tone: 'primary' | 'neutral';
}

export interface BacklinkRecord {
  id: string;
  sourceDocumentId: string;
  sourceBlockId?: string | null;
  title: string;
  description: string;
}

export interface OutgoingMentionRecord {
  id: string;
  targetDocumentId: string;
  title: string;
  description: string;
}

export interface MentionDocumentCandidate {
  id: string;
  title: string;
  folderPath?: string;
  updatedAt?: string | null;
}

export interface DocumentNavigationTarget {
  documentId: string;
  blockId?: string;
  fallbackText?: string;
  highlightQuery?: string;
}

export interface DocumentFocusTarget {
  documentId: string;
  blockId: string;
  fallbackText?: string;
  highlightQuery?: string;
  requestKey: number;
}

export interface DocumentSection {
  id: string;
  type: 'heading' | 'paragraph' | 'quote' | 'bullet-list' | 'gallery';
  title?: string;
  content?: string;
  items?: string[];
  caption?: string;
}

export type DocumentKind = 'note' | 'spreadsheet';

export interface DocumentCreateOptions {
  kind?: DocumentKind;
}

export interface DocumentRecord {
  id: string;
  spaceId: string;
  folderId: string | null;
  title: string;
  kind?: DocumentKind;
  sortOrder?: number;
  contentJson: string;
  updatedAt?: string;
  updatedAtLabel: string;
  wordCountLabel: string;
  badgeLabel: string;
  outline: OutlineItem[];
  tags: TagRecord[];
  backlinks: BacklinkRecord[];
  sections: DocumentSection[];
  isFavorite?: boolean;
  deletedAt?: string | null;
  trashRootId?: string | null;
}

export interface DocumentUpdateInput {
  title?: string;
  badgeLabel?: string;
  sections?: DocumentSection[];
  contentJson?: string;
  isFavorite?: boolean;
}

export interface QuickNoteRecord {
  id: string;
  spaceId?: string | null;
  noteDate: string;
  title: string;
  contentJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteMonthEntry {
  noteDate: string;
  updatedAt: string;
}

export interface QuickLinkItem {
  id: string;
  label: string;
}

export type WorkspaceCollectionView = 'tree' | 'all-notes' | 'shared-links' | 'favorites' | 'trash';

export interface WorkspaceSeed {
  spaces: Space[];
  folders: FolderNode[];
  documents: DocumentRecord[];
  quickLinks: QuickLinkItem[];
}

export interface WorkspaceState {
  seed: WorkspaceSeed;
  activeSpaceId: string;
  activeDocumentId: string;
  expandedFolderIds: string[];
  activeCollectionView?: WorkspaceCollectionView;
}

export type TreeNodeKind = 'folder' | 'document';
export type TreeReorderPosition = 'before' | 'after';

export interface TreeReorderInput {
  draggedKind: TreeNodeKind;
  draggedId: string;
  targetKind: TreeNodeKind;
  targetId: string;
  position: TreeReorderPosition;
}
