import { useCallback } from 'react';
import { getQuickNoteTitle } from '../shared/lib/quickNotes';
import { deriveOutlineFromContentJson } from '../shared/lib/documentContent';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type { UploadAssetInput } from '../shared/types/preload';
import type { WorkspaceSessionActionsOptions, WorkspaceSessionActionsState } from './workspaceSessionActionTypes';
import { updateDocumentInState } from './workspaceSessionActionTypes';

type WorkspaceContentActionsState = Pick<
  WorkspaceSessionActionsState,
  | 'createDocument'
  | 'createFolder'
  | 'moveFolder'
  | 'renameFolder'
  | 'renameDocument'
  | 'moveDocument'
  | 'deleteDocument'
  | 'deleteFolder'
  | 'addTagToDocument'
  | 'removeTagFromDocument'
  | 'setDocumentFavorite'
  | 'saveDocumentContent'
  | 'saveQuickNoteContent'
  | 'captureQuickNoteToDocument'
  | 'uploadFiles'
  | 'uploadQuickNoteFiles'
>;

export function useWorkspaceContentActions({
  workspaceState,
  reloadWorkspaceState,
  markPersistenceFeedback,
  setWorkspaceState,
  setEditingId,
  setActiveQuickNoteDate,
  setQuickNoteRefreshKey,
}: WorkspaceSessionActionsOptions): WorkspaceContentActionsState {
  const createDocument = useCallback(
    async (folderId: string | null) => {
      if (!workspaceState) {
        return;
      }

      const document = await getWorkKnowlageApi().documents.create({
        spaceId: workspaceState.activeSpaceId,
        folderId,
        title: '无标题文档',
      });

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId,
        activeDocumentId: document.id,
        ensureExpandedFolderIds: folderId ? [folderId] : [],
        activeCollectionView: 'tree',
      });
      markPersistenceFeedback('新建文件');
      setActiveQuickNoteDate(null);
      setEditingId(document.id);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setActiveQuickNoteDate, setEditingId, workspaceState],
  );

  const createFolder = useCallback(
    async (parentId: string | null) => {
      if (!workspaceState) {
        return;
      }

      const folder = await getWorkKnowlageApi().folders.create({
        spaceId: workspaceState.activeSpaceId,
        parentId,
        name: '新文件夹',
      });

      const expandedFolderIds = [
        ...workspaceState.expandedFolderIds,
        ...(parentId ? [parentId] : []),
        folder.id,
      ];

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId,
        activeDocumentId: workspaceState.activeDocumentId,
        ensureExpandedFolderIds: [...new Set(expandedFolderIds)],
      });
      markPersistenceFeedback('新建文件夹');
      setEditingId(folder.id);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId, workspaceState],
  );

  const moveFolder = useCallback(
    async (folderId: string, newParentId: string | null) => {
      if (!workspaceState) {
        return;
      }

      await getWorkKnowlageApi().folders.move(folderId, newParentId);

      await reloadWorkspaceState({
        activeDocumentId: workspaceState.activeDocumentId,
        ensureExpandedFolderIds: [folderId, ...(newParentId ? [newParentId] : [])],
      });
      markPersistenceFeedback('移动文件夹');
    },
    [markPersistenceFeedback, reloadWorkspaceState, workspaceState],
  );

  const renameFolder = useCallback(
    async (folderId: string, newName: string) => {
      await getWorkKnowlageApi().folders.rename(folderId, newName);

      await reloadWorkspaceState();
      markPersistenceFeedback('重命名文件夹');
      setEditingId(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId],
  );

  const renameDocument = useCallback(
    async (documentId: string, newTitle: string) => {
      await getWorkKnowlageApi().documents.update(documentId, { title: newTitle });

      await reloadWorkspaceState({
        activeDocumentId: documentId,
      });
      markPersistenceFeedback('重命名文档');
      setEditingId(null);
    },
    [markPersistenceFeedback, reloadWorkspaceState, setEditingId],
  );

  const moveDocument = useCallback(
    async (documentId: string, targetFolderId: string | null) => {
      await getWorkKnowlageApi().documents.move(documentId, targetFolderId);

      await reloadWorkspaceState({
        activeDocumentId: documentId,
        ensureExpandedFolderIds: targetFolderId ? [targetFolderId] : [],
      });
      markPersistenceFeedback('移动文档');
    },
    [markPersistenceFeedback, reloadWorkspaceState],
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!workspaceState) {
        return;
      }

      const documentApi = getWorkKnowlageApi().documents;
      if (documentApi.trash) {
        await documentApi.trash(documentId);
      } else {
        await documentApi.delete(documentId);
      }

      await reloadWorkspaceState({
        activeDocumentId: workspaceState.activeDocumentId === documentId
          ? ''
          : workspaceState.activeDocumentId,
      });
      markPersistenceFeedback(documentApi.trash ? '移入回收站' : '删除文档');
    },
    [markPersistenceFeedback, reloadWorkspaceState, workspaceState],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!workspaceState) {
        return;
      }

      const folderApi = getWorkKnowlageApi().folders;
      if (folderApi.trash) {
        await folderApi.trash(folderId);
      } else {
        await folderApi.delete(folderId);
      }

      await reloadWorkspaceState({
        expandedFolderIds: workspaceState.expandedFolderIds.filter((item) => item !== folderId),
      });
      markPersistenceFeedback(folderApi.trash ? '移入回收站' : '删除文件夹');
    },
    [markPersistenceFeedback, reloadWorkspaceState, workspaceState],
  );

  const addTagToDocument = useCallback(
    async (documentId: string, label: string) => {
      if (!workspaceState) {
        return;
      }

      const normalizedLabel = label.trim().startsWith('#') ? label.trim() : `#${label.trim()}`;
      const currentDocument = workspaceState.seed.documents.find((document) => document.id === documentId);

      if (!currentDocument || !normalizedLabel) {
        return;
      }

      const hasDuplicateLabel = currentDocument.tags.some(
        (tag) => tag.label.toLocaleLowerCase() === normalizedLabel.toLocaleLowerCase()
      );
      if (hasDuplicateLabel) {
        return;
      }

      const nextTag = await getWorkKnowlageApi().tags.addToDocument(documentId, {
        label: normalizedLabel,
        tone: currentDocument.tags.length === 0 ? 'primary' : 'neutral',
      });

      updateDocumentInState(setWorkspaceState, documentId, (document) => ({
        ...document,
        tags: [...document.tags, nextTag],
      }));
      markPersistenceFeedback('新增标签');
    },
    [markPersistenceFeedback, setWorkspaceState, workspaceState],
  );

  const removeTagFromDocument = useCallback(
    async (documentId: string, tagId: string) => {
      await getWorkKnowlageApi().tags.removeFromDocument(documentId, tagId);

      updateDocumentInState(setWorkspaceState, documentId, (document) => ({
        ...document,
        tags: document.tags.filter((tag) => tag.id !== tagId),
      }));
      markPersistenceFeedback('移除标签');
    },
    [markPersistenceFeedback, setWorkspaceState],
  );

  const setDocumentFavorite = useCallback(
    async (documentId: string, isFavorite: boolean) => {
      const nextDocument = await getWorkKnowlageApi().documents.update(documentId, { isFavorite });

      updateDocumentInState(setWorkspaceState, documentId, () => nextDocument);
      markPersistenceFeedback(isFavorite ? '收藏文档' : '取消收藏');
    },
    [markPersistenceFeedback, setWorkspaceState],
  );

  const saveDocumentContent = useCallback(
    async (documentId: string, contentJson: string) => {
      const nextDocument = await getWorkKnowlageApi().documents.update(documentId, { contentJson });

      updateDocumentInState(setWorkspaceState, documentId, () => nextDocument);
      markPersistenceFeedback('文档内容已自动');
      return nextDocument;
    },
    [markPersistenceFeedback, setWorkspaceState],
  );

  const saveQuickNoteContent = useCallback(
    async (noteDate: string, contentJson: string) => {
      const nextNote = await getWorkKnowlageApi().quickNotes.upsert({
        noteDate,
        title: getQuickNoteTitle(noteDate),
        contentJson,
      });

      setQuickNoteRefreshKey((current) => current + 1);
      markPersistenceFeedback('快记内容已自动');
      return nextNote;
    },
    [markPersistenceFeedback, setQuickNoteRefreshKey],
  );

  const captureQuickNoteToDocument = useCallback(
    async (noteDate: string) => {
      if (!workspaceState) {
        return null;
      }

      const quickNote = await getWorkKnowlageApi().quickNotes.get(noteDate);
      if (!quickNote) {
        return null;
      }

      const firstHeadingTitle = deriveOutlineFromContentJson(quickNote.contentJson)[0]?.title?.trim();
      const nextTitle = firstHeadingTitle || quickNote.title || getQuickNoteTitle(noteDate);

      const createdDocument = await getWorkKnowlageApi().documents.create({
        spaceId: workspaceState.activeSpaceId,
        folderId: null,
        title: nextTitle,
      });
      const nextDocument = await getWorkKnowlageApi().documents.update(createdDocument.id, {
        title: nextTitle,
        contentJson: quickNote.contentJson,
      });

      await reloadWorkspaceState({
        activeSpaceId: workspaceState.activeSpaceId,
        activeDocumentId: nextDocument.id,
        activeCollectionView: 'tree',
      });
      setActiveQuickNoteDate(null);
      setEditingId(null);
      markPersistenceFeedback('快记沉淀为文档');
      return nextDocument;
    },
    [
      markPersistenceFeedback,
      reloadWorkspaceState,
      setActiveQuickNoteDate,
      setEditingId,
      workspaceState,
    ],
  );

  const uploadFiles = useCallback(async (documentId: string, files: File[]) => {
    const assets: UploadAssetInput[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }))
    );

    const uploadedAssets = await getWorkKnowlageApi().assets.upload(documentId, assets);
    return uploadedAssets.map((asset) => asset.url);
  }, []);

  const uploadQuickNoteFiles = useCallback(async (quickNoteId: string, files: File[]) => {
    const assets: UploadAssetInput[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }))
    );

    const uploadedAssets = await getWorkKnowlageApi().quickNotes.assets.upload(quickNoteId, assets);
    return uploadedAssets.map((asset) => asset.url);
  }, []);

  return {
    createDocument,
    createFolder,
    moveFolder,
    renameFolder,
    renameDocument,
    moveDocument,
    deleteDocument,
    deleteFolder,
    addTagToDocument,
    removeTagFromDocument,
    setDocumentFavorite,
    saveDocumentContent,
    saveQuickNoteContent,
    captureQuickNoteToDocument,
    uploadFiles,
    uploadQuickNoteFiles,
  };
}
