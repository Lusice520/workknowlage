import { describe, expect, test } from 'vitest';
import {
  createFallbackDesktopApi,
  getWorkKnowlageRuntimeStatus,
} from './workKnowlageApi';

describe('workKnowlageApi', () => {
  test('returns a document from the fallback desktop api', async () => {
    const api = createFallbackDesktopApi();
    const document = await api.documents.getById('doc-creative-draft');

    expect(typeof api.spaces.list).toBe('function');
    expect(document?.title).toBe('创意草案');
  });

  test('exposes persisted contentJson for seeded fallback documents', async () => {
    const api = createFallbackDesktopApi();
    const document = await api.documents.getById('doc-creative-draft');

    expect(document?.contentJson).toContain('section-core-goal');
  });

  test('derives backlinks from persisted document mentions and removes them when the source document is trashed', async () => {
    const api = createFallbackDesktopApi();
    const sourceDocument = await api.documents.create({
      spaceId: 'personal-workspace',
      folderId: null,
      title: '反链来源文档',
    });

    await api.documents.update(sourceDocument.id, {
      contentJson: JSON.stringify([
        {
          id: 'paragraph-backlink-source',
          type: 'paragraph',
          content: [
            { type: 'text', text: '这里补一个 ', styles: {} },
            {
              type: 'docMention',
              props: {
                documentId: 'doc-creative-draft',
                title: '创意草案',
              },
            },
            { type: 'text', text: ' 的关联说明', styles: {} },
          ],
          children: [],
        },
      ]),
    });

    const targetDocument = await api.documents.getById('doc-creative-draft');
    expect(targetDocument?.backlinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceDocumentId: sourceDocument.id,
          title: '反链来源文档',
          description: expect.stringContaining('@创意草案'),
        }),
      ]),
    );

    await api.documents.trash?.(sourceDocument.id);

    const targetAfterTrash = await api.documents.getById('doc-creative-draft');
    expect(targetAfterTrash?.backlinks).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceDocumentId: sourceDocument.id,
        }),
      ]),
    );
  });

  test('updates fallback documents from contentJson and derives outline plus word count', async () => {
    const api = createFallbackDesktopApi();
    const contentJson = JSON.stringify([
      {
        id: 'block-heading',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '标题', styles: {} }],
        children: [],
      },
      {
        id: 'block-paragraph',
        type: 'paragraph',
        content: [{ type: 'text', text: 'abc', styles: {} }],
        children: [],
      },
    ]);

    const updatedDocument = await api.documents.update('doc-creative-draft', {
      contentJson,
    });

    expect(updatedDocument.contentJson).toBe(contentJson);
    expect(updatedDocument.outline).toEqual([
      {
        id: 'block-heading',
        title: '标题',
        level: 1,
      },
    ]);
    expect(updatedDocument.wordCountLabel).toBe('5 字');
  });

  test('stores quick notes globally by date and lists month markers', async () => {
    const api = createFallbackDesktopApi();
    const marchContentJson = JSON.stringify([
      {
        id: 'quick-note-paragraph',
        type: 'paragraph',
        content: [{ type: 'text', text: '今天先记一个想法', styles: {} }],
        children: [],
      },
    ]);

    const createdNote = await api.quickNotes.upsert({
      noteDate: '2026-03-26',
      title: '3月26日快记',
      contentJson: marchContentJson,
    });

    expect(createdNote.noteDate).toBe('2026-03-26');

    const loadedNote = await api.quickNotes.get('2026-03-26');
    expect(loadedNote?.contentJson).toBe(marchContentJson);

    await api.quickNotes.upsert({
      noteDate: '2026-04-02',
      title: '4月2日快记',
      contentJson: JSON.stringify([]),
    });

    const marchEntries = await api.quickNotes.listMonth('2026-03');
    const aprilEntries = await api.quickNotes.listMonth('2026-04');

    expect(marchEntries).toEqual([
      {
        noteDate: '2026-03-26',
        updatedAt: createdNote.updatedAt,
      },
    ]);
    expect(aprilEntries).toEqual([
      expect.objectContaining({
        noteDate: '2026-04-02',
      }),
    ]);
  });

  test('uploads quick note assets through the fallback quick note asset namespace', async () => {
    const api = createFallbackDesktopApi();

    const uploadedAssets = await api.quickNotes.assets.upload('quick-note-2026-03-26', [{
      name: 'quick-note-image.png',
      mimeType: 'image/png',
      bytes: Uint8Array.from([1, 2, 3]),
    }]);

    expect(uploadedAssets).toHaveLength(1);
    expect(uploadedAssets[0]).toMatchObject({
      documentId: 'quick-note-2026-03-26',
      name: 'quick-note-image.png',
      mimeType: 'image/png',
      size: 3,
    });
    expect(typeof uploadedAssets[0].url).toBe('string');
  });

  test('exposes export bridge methods through the fallback desktop api', async () => {
    const api = createFallbackDesktopApi();

    expect(typeof api.exports?.saveText).toBe('function');
    expect(typeof api.exports?.saveBinary).toBe('function');
    expect(typeof api.exports?.savePdfFromHtml).toBe('function');

    await expect(api.exports?.saveText('创意草案.md', '## hello')).resolves.toMatchObject({
      success: true,
    });
    await expect(api.exports?.saveBinary('创意草案.docx', new Uint8Array([1, 2, 3]))).resolves.toMatchObject({
      success: true,
    });
    await expect(api.exports?.savePdfFromHtml('创意草案.pdf', '<html></html>')).resolves.toMatchObject({
      success: true,
    });
  });

  test('moves fallback documents into another folder', async () => {
    const api = createFallbackDesktopApi();

    await api.documents.move?.('doc-creative-draft', 'folder-plan-2024');

    const movedDocument = await api.documents.getById('doc-creative-draft');
    expect(movedDocument?.folderId).toBe('folder-plan-2024');
  });

  test('moves fallback documents to root and omits folderId from root search hits', async () => {
    const api = createFallbackDesktopApi();

    const movedDocument = await api.documents.move?.('doc-creative-draft', null as unknown as string);
    const rootDocuments = await api.documents.list('personal-workspace', null);
    const searchHits = await api.search?.query('personal-workspace', '创意草案');
    const rootHit = searchHits?.find((record) => record.documentId === 'doc-creative-draft');

    expect(movedDocument?.folderId).toBeNull();
    expect(rootDocuments.map((document) => document.id)).toContain('doc-creative-draft');
    expect(rootHit).toBeDefined();
    expect(rootHit).not.toHaveProperty('folderId');
  });

  test('returns a workspace snapshot and persists favorite updates in fallback mode', async () => {
    const api = createFallbackDesktopApi();

    expect(typeof api.workspace?.getSnapshot).toBe('function');

    const initialSnapshot = await api.workspace?.getSnapshot('personal-workspace');
    const initialDocument = initialSnapshot?.documents.find((document) => document.id === 'doc-creative-draft');

    expect(initialDocument?.isFavorite).toBe(false);

    const updatedDocument = await api.documents.update('doc-creative-draft', {
      isFavorite: true,
    });

    expect(updatedDocument.isFavorite).toBe(true);

    const nextSnapshot = await api.workspace?.getSnapshot('personal-workspace');
    const nextDocument = nextSnapshot?.documents.find((document) => document.id === 'doc-creative-draft');

    expect(nextDocument?.isFavorite).toBe(true);
  });

  test('rejects moving a fallback folder into its own descendant', async () => {
    const api = createFallbackDesktopApi();
    const childFolder = await api.folders.create({
      spaceId: 'personal-workspace',
      parentId: 'folder-inspiration',
      name: '子文件夹',
    });

    await expect(api.folders.move('folder-inspiration', childFolder.id)).rejects.toThrow(
      'Cannot move a folder into itself or its descendant.'
    );
  });

  test('searches fallback documents and quick notes by title plus content', async () => {
    const api = createFallbackDesktopApi();

    await api.quickNotes.upsert({
      noteDate: '2026-03-26',
      title: '3月26日快记',
      contentJson: JSON.stringify([
        {
          id: 'quick-note-paragraph',
          type: 'paragraph',
          content: [{ type: 'text', text: '今天补一下架构搜索的待办', styles: {} }],
          children: [],
        },
      ]),
    });

    const documentHits = await api.search?.query('personal-workspace', '架构');
    const quickNoteHits = await api.search?.query('space-other', '待办');

    expect(documentHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          title: '架构设计',
          documentId: 'doc-architecture-design',
          folderId: 'folder-inspiration',
        }),
      ])
    );
    expect(quickNoteHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quick-note',
          title: '3月26日快记',
          noteDate: '2026-03-26',
        }),
      ])
    );
  });

  test('describes the fallback api as browser-session mock storage', () => {
    const api = createFallbackDesktopApi();
    const runtimeStatus = getWorkKnowlageRuntimeStatus(api);

    expect(runtimeStatus.storageLabel).toBe('浏览器内存 Mock');
    expect(runtimeStatus.isPersistent).toBe(false);
    expect(runtimeStatus.summary).toBe('关闭页面后会丢失');
  });

  test('exposes fallback storage diagnostics for the top runtime banner', async () => {
    const api = createFallbackDesktopApi();
    const storageInfo = await api.meta.getStorageInfo?.();

    expect(storageInfo).toEqual({
      storagePath: '浏览器会话内存',
      scopeLabel: '空间、文件夹、文档、快记',
    });
  });

  test('exposes safe maintenance helpers in fallback mode', async () => {
    const api = createFallbackDesktopApi() as any;

    expect(typeof api.maintenance?.openDataDirectory).toBe('function');
    expect(typeof api.maintenance?.createBackup).toBe('function');
    expect(typeof api.maintenance?.restoreBackup).toBe('function');
    expect(typeof api.maintenance?.rebuildSearchIndex).toBe('function');
    expect(typeof api.maintenance?.cleanupOrphanAttachments).toBe('function');

    await expect(api.maintenance.openDataDirectory()).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining('浏览器'),
    });

    await expect(api.maintenance.createBackup()).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining('浏览器'),
    });
  });

  test('exposes trash helpers and hides trashed documents from snapshot results', async () => {
    const api = createFallbackDesktopApi() as any;

    expect(typeof api.workspace?.getTrash).toBe('function');
    expect(typeof api.documents.trash).toBe('function');
    expect(typeof api.folders.trash).toBe('function');
    expect(typeof api.workspace?.restoreTrashItem).toBe('function');
    expect(typeof api.workspace?.deleteTrashItem).toBe('function');
    expect(typeof api.workspace?.emptyTrash).toBe('function');

    const trashedDocument = await api.documents.trash('doc-creative-draft');
    expect(trashedDocument?.id).toBe('doc-creative-draft');

    const nextSnapshot = await api.workspace.getSnapshot('personal-workspace');
    expect(nextSnapshot.documents.find((document: { id: string }) => document.id === 'doc-creative-draft')).toBeUndefined();
  });

  test('restores a trashed fallback document to root when the parent folder no longer exists', async () => {
    const api = createFallbackDesktopApi() as any;
    const folder = await api.folders.create({
      spaceId: 'personal-workspace',
      parentId: null,
      name: '临时目录',
    });
    const document = await api.documents.create({
      spaceId: 'personal-workspace',
      folderId: folder.id,
      title: '临时文档',
    });

    await api.documents.trash(document.id);
    await api.folders.delete(folder.id);

    await expect(api.workspace.restoreTrashItem('personal-workspace', document.id)).resolves.toBe(true);

    const restoredDocument = await api.documents.getById(document.id);
    expect(restoredDocument?.folderId).toBeNull();
  });
});
