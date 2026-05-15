import { buildDerivedDocumentContent } from './documentContent';
import type { DocumentRecord, FolderNode } from '../types/workspace';
import type { TrashItemRecord } from '../types/preload';

export const getDescendantFolderIds = (folders: FolderNode[], folderId: string): string[] => {
  const childFolderIds = folders
    .filter((folder) => folder.parentId === folderId)
    .map((folder) => folder.id);

  return childFolderIds.flatMap((childFolderId) => [
    childFolderId,
    ...getDescendantFolderIds(folders, childFolderId),
  ]);
};

export const collectTreePackageIds = (
  folders: FolderNode[],
  documents: DocumentRecord[],
  rootKind: 'folder' | 'document',
  rootId: string,
) => {
  const folderIds: string[] = [];
  const documentIds: string[] = [];
  const seenFolderIds = new Set<string>();
  const seenDocumentIds = new Set<string>();

  const visitFolder = (folderId: string) => {
    if (seenFolderIds.has(folderId)) {
      return;
    }

    seenFolderIds.add(folderId);
    folderIds.push(folderId);

    folders.filter((folder) => folder.parentId === folderId).forEach((folder) => visitFolder(folder.id));
    documents.filter((document) => document.folderId === folderId).forEach((document) => visitDocument(document.id));
  };

  const visitDocument = (documentId: string) => {
    if (seenDocumentIds.has(documentId)) {
      return;
    }

    seenDocumentIds.add(documentId);
    documentIds.push(documentId);

    folders.filter((folder) => folder.parentId === documentId).forEach((folder) => visitFolder(folder.id));
    documents.filter((document) => document.folderId === documentId).forEach((document) => visitDocument(document.id));
  };

  if (rootKind === 'folder') {
    visitFolder(rootId);
  } else {
    visitDocument(rootId);
  }

  return { folderIds, documentIds };
};

export const isFolderActive = (folder: FolderNode): boolean => !folder.deletedAt;
export const isDocumentActive = (document: DocumentRecord): boolean => !document.deletedAt;

export const getActiveFolders = (folders: FolderNode[], spaceId?: string): FolderNode[] =>
  folders.filter((folder) => isFolderActive(folder) && (spaceId ? folder.spaceId === spaceId : true));

export const getActiveDocuments = (documents: DocumentRecord[], spaceId?: string): DocumentRecord[] =>
  documents.filter((document) => isDocumentActive(document) && (spaceId ? document.spaceId === spaceId : true));

export const getTrashedFolderRoots = (folders: FolderNode[], spaceId: string): FolderNode[] =>
  folders.filter(
    (folder) =>
      folder.spaceId === spaceId &&
      Boolean(folder.deletedAt) &&
      folder.trashRootId === folder.id
  );

export const getTrashedDocumentRoots = (documents: DocumentRecord[], spaceId: string): DocumentRecord[] =>
  documents.filter(
    (document) =>
      document.spaceId === spaceId &&
      Boolean(document.deletedAt) &&
      document.trashRootId === document.id
  );

export const getFallbackTrashItems = (
  folders: FolderNode[],
  documents: DocumentRecord[],
  spaceId: string,
): TrashItemRecord[] => {
  const folderItems = getTrashedFolderRoots(folders, spaceId).map<TrashItemRecord>((folder) => {
    const packageFolderIds = [folder.id, ...getDescendantFolderIds(folders, folder.id)];

    return {
      id: folder.id,
      trashRootId: folder.id,
      kind: 'folder',
      spaceId: folder.spaceId,
      title: folder.name,
      deletedAt: folder.deletedAt ?? '',
      childFolderCount: packageFolderIds.length - 1,
      childDocumentCount: documents.filter(
        (document) =>
          document.spaceId === folder.spaceId &&
          Boolean(document.deletedAt) &&
          document.trashRootId === folder.id
      ).length,
    };
  });

  const documentItems = getTrashedDocumentRoots(documents, spaceId).map<TrashItemRecord>((document) => ({
    id: document.id,
    trashRootId: document.id,
    kind: 'document',
    spaceId: document.spaceId,
    title: document.title,
    deletedAt: document.deletedAt ?? '',
    folderId: document.folderId,
  }));

  return [...folderItems, ...documentItems].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
};

export const ensureFolderMoveIsValid = (folders: FolderNode[], folderId: string, newParentId: string | null) => {
  const activeFolders = getActiveFolders(folders);

  if (newParentId === null) {
    return;
  }

  if (folderId === newParentId) {
    throw new Error('Cannot move a folder into itself or its descendant.');
  }

  const descendantFolderIds = new Set(getDescendantFolderIds(activeFolders, folderId));
  if (descendantFolderIds.has(newParentId)) {
    throw new Error('Cannot move a folder into itself or its descendant.');
  }

  const folder = activeFolders.find((item) => item.id === folderId);
  const parentFolder = activeFolders.find((item) => item.id === newParentId);

  if (!folder || !parentFolder || folder.spaceId !== parentFolder.spaceId) {
    throw new Error('Folder move target is invalid.');
  }
};

export const ensureDocumentMoveIsValid = (
  documents: DocumentRecord[],
  folders: FolderNode[],
  documentId: string,
  targetFolderId: string | null,
) => {
  const document = getActiveDocuments(documents).find((item) => item.id === documentId);

  if (!document) {
    throw new Error('Document move target is invalid.');
  }

  if (targetFolderId === null) {
    return;
  }

  const targetFolder = getActiveFolders(folders).find((item) => item.id === targetFolderId);
  if (!targetFolder || document.spaceId !== targetFolder.spaceId) {
    throw new Error('Document move target is invalid.');
  }
};

export const hydrateDocumentRecord = (document: Omit<DocumentRecord, 'contentJson' | 'outline' | 'sections' | 'wordCountLabel'> & {
  contentJson?: string;
  sections?: DocumentRecord['sections'];
  outline?: DocumentRecord['outline'];
  wordCountLabel?: string;
}): DocumentRecord => {
  const derivedContent = buildDerivedDocumentContent({
    contentJson: document.contentJson,
    sections: document.sections,
  });

  return {
    ...document,
    contentJson: derivedContent.contentJson,
    updatedAt: document.updatedAt ?? '',
    updatedAtLabel: document.updatedAtLabel ?? document.updatedAt ?? '',
    outline: derivedContent.outline,
    sections: derivedContent.sections,
    wordCountLabel: derivedContent.wordCountLabel,
    isFavorite: document.isFavorite ?? false,
  };
};
