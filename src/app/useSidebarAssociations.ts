import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  deriveSidebarAssociations,
  type SidebarAssociationResult,
} from '../shared/lib/sidebarAssociations';
import type { DocumentRecord, FolderNode, OutlineItem } from '../shared/types/workspace';

const EMPTY_SIDEBAR_ASSOCIATIONS: SidebarAssociationResult = {
  relatedDocuments: [],
  relatedTags: [],
  similarBlocks: [],
  suggestedLinks: [],
  textEvidence: [],
  summary: {
    wikiAssociationCount: 0,
  },
};

const MAX_CACHE_ENTRIES = 48;
const sidebarAssociationsCache = new Map<string, SidebarAssociationResult>();

const summarizeOutlineItem = (item: OutlineItem) => `${item.id}:${item.level}:${item.title}`;
const summarizeTags = (document: DocumentRecord) => (document.tags ?? []).map((tag) => `${tag.id}:${tag.label}`).join(',');
const summarizeBacklinks = (document: DocumentRecord) =>
  (document.backlinks ?? []).map((backlink) => `${backlink.id}:${backlink.sourceDocumentId ?? ''}:${backlink.sourceBlockId ?? ''}`).join(',');
const summarizeSections = (document: DocumentRecord) =>
  (document.sections ?? []).map((section) => `${section.id}:${section.type}:${section.title ?? ''}:${section.content ?? ''}`).join('|');

const summarizeDocument = (document: DocumentRecord) => [
  document.id,
  document.spaceId,
  document.folderId ?? '',
  document.title,
  document.updatedAt ?? '',
  summarizeTags(document),
  summarizeBacklinks(document),
  document.outline.map(summarizeOutlineItem).join('|'),
  summarizeSections(document),
  document.contentJson ?? '',
].join('~');

export const buildSidebarAssociationsCacheKey = ({
  activeDocument,
  documents,
  folders,
  focusedOutlineItemId,
}: {
  activeDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  folders: FolderNode[];
  focusedOutlineItemId: string | null;
}) => {
  if (!activeDocument) {
    return 'sidebar:none';
  }

  return JSON.stringify({
    activeDocument: summarizeDocument(activeDocument),
    documents: documents.map(summarizeDocument),
    folders: folders.map((folder) => `${folder.id}:${folder.spaceId}:${folder.parentId ?? ''}:${folder.name}`),
    focusedOutlineItemId,
  });
};

const rememberSidebarAssociations = (cacheKey: string, result: SidebarAssociationResult) => {
  if (sidebarAssociationsCache.has(cacheKey)) {
    sidebarAssociationsCache.delete(cacheKey);
  }
  sidebarAssociationsCache.set(cacheKey, result);

  if (sidebarAssociationsCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = sidebarAssociationsCache.keys().next().value;
  if (oldestKey) {
    sidebarAssociationsCache.delete(oldestKey);
  }
};

export function useSidebarAssociations({
  activeDocument,
  documents,
  folders,
  focusedOutlineItemId,
}: {
  activeDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  folders: FolderNode[];
  focusedOutlineItemId: string | null;
}) {
  const deferredActiveDocument = useDeferredValue(activeDocument);
  const deferredDocuments = useDeferredValue(documents);
  const deferredFolders = useDeferredValue(folders);
  const deferredFocusedOutlineItemId = useDeferredValue(focusedOutlineItemId);
  const focusedOutlineItem = useMemo(
    () =>
      deferredActiveDocument?.outline.find((item) => item.id === deferredFocusedOutlineItemId) ?? null,
    [deferredActiveDocument, deferredFocusedOutlineItemId],
  );
  const cacheKey = useMemo(
    () =>
      buildSidebarAssociationsCacheKey({
        activeDocument: deferredActiveDocument,
        documents: deferredDocuments,
        folders: deferredFolders,
        focusedOutlineItemId: deferredFocusedOutlineItemId,
      }),
    [deferredActiveDocument, deferredDocuments, deferredFolders, deferredFocusedOutlineItemId],
  );
  const [associationState, setAssociationState] = useState<SidebarAssociationResult>(() => {
    if (!deferredActiveDocument) {
      return EMPTY_SIDEBAR_ASSOCIATIONS;
    }

    return sidebarAssociationsCache.get(cacheKey) ?? EMPTY_SIDEBAR_ASSOCIATIONS;
  });

  useEffect(() => {
    if (!deferredActiveDocument) {
      setAssociationState(EMPTY_SIDEBAR_ASSOCIATIONS);
      return;
    }

    const cached = sidebarAssociationsCache.get(cacheKey);
    if (cached) {
      setAssociationState(cached);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const nextState = deriveSidebarAssociations({
        activeDocument: deferredActiveDocument,
        documents: deferredDocuments.length > 0 ? deferredDocuments : [deferredActiveDocument],
        folders: deferredFolders,
        focusedOutlineItem,
      });
      rememberSidebarAssociations(cacheKey, nextState);
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setAssociationState(nextState);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cacheKey, deferredActiveDocument, deferredDocuments, deferredFolders, focusedOutlineItem]);

  return associationState;
}
