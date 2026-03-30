import type { DocumentRecord, FolderNode, MentionDocumentCandidate } from '../types/workspace';

export const ROOT_FOLDER_LABEL = '根目录';

const sortFolderPathSegments = (folders: FolderNode[], folderId: string | null): string[] => {
  if (!folderId) {
    return [];
  }

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const segments: string[] = [];
  const visitedFolderIds = new Set<string>();
  let currentFolderId: string | null = folderId;

  while (currentFolderId) {
    if (visitedFolderIds.has(currentFolderId)) {
      break;
    }

    visitedFolderIds.add(currentFolderId);
    const currentFolder = foldersById.get(currentFolderId);
    if (!currentFolder) {
      break;
    }

    segments.push(currentFolder.name);
    currentFolderId = currentFolder.parentId;
  }

  return segments.reverse();
};

export const getFolderPathLabel = (folders: FolderNode[], folderId: string | null): string => {
  const segments = sortFolderPathSegments(folders, folderId);
  return segments.length > 0 ? segments.join(' / ') : ROOT_FOLDER_LABEL;
};

export const buildMentionDocumentCandidates = (
  documents: DocumentRecord[],
  folders: FolderNode[],
): MentionDocumentCandidate[] =>
  documents.map((document) => ({
    id: document.id,
    title: document.title,
    folderPath: getFolderPathLabel(folders, document.folderId),
    updatedAt: document.updatedAt ?? null,
  }));
