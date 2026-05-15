import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { DocumentRecord, FolderNode } from '../shared/types/workspace';

vi.mock('../shared/lib/sidebarAssociations', async () => {
  const actual = await vi.importActual<typeof import('../shared/lib/sidebarAssociations')>(
    '../shared/lib/sidebarAssociations',
  );

  return {
    ...actual,
    deriveSidebarAssociations: vi.fn(),
  };
});

import { deriveSidebarAssociations } from '../shared/lib/sidebarAssociations';
import { buildSidebarAssociationsCacheKey, useSidebarAssociations } from './useSidebarAssociations';

const emptyAssociationState = {
  relatedDocuments: [],
  relatedTags: [],
  similarBlocks: [],
  suggestedLinks: [],
  textEvidence: [],
  summary: {
    wikiAssociationCount: 0,
  },
};

const createDocument = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'doc-default',
  spaceId: 'space-1',
  folderId: null,
  title: '默认文稿',
  contentJson: JSON.stringify([]),
  updatedAtLabel: 'today',
  wordCountLabel: '0 字',
  badgeLabel: '',
  outline: [],
  tags: [],
  backlinks: [],
  sections: [],
  ...overrides,
});

const createFolders = (): FolderNode[] => [
  {
    id: 'folder-product',
    spaceId: 'space-1',
    parentId: null,
    name: '产品策略',
  },
];

describe('useSidebarAssociations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('reuses cached association results for equivalent sidebar inputs', async () => {
    const deriveSidebarAssociationsMock = vi.mocked(deriveSidebarAssociations);
    const cachedAssociationState = {
      ...emptyAssociationState,
      relatedDocuments: [
        {
          documentId: 'doc-related',
          title: '关系图方案',
          folderPath: '产品策略',
          score: 8,
          reason: '2 处内容相似',
          previewMatches: [],
          matchCount: 2,
        },
      ],
    };
    deriveSidebarAssociationsMock.mockReturnValue(cachedAssociationState);

    const initialDocument = createDocument({
      id: 'doc-cache',
      title: '缓存测试文稿',
      outline: [{ id: 'heading-1', title: '实验设计', level: 2 }],
      tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
      sections: [{ id: 'section-1', type: 'paragraph', content: '需要展示缓存命中。' }],
    });

    const { result, rerender } = renderHook(
      ({
        activeDocument,
        documents,
        folders,
        focusedOutlineItemId,
      }: {
        activeDocument: DocumentRecord | null;
        documents: DocumentRecord[];
        folders: FolderNode[];
        focusedOutlineItemId: string | null;
      }) =>
        useSidebarAssociations({
          activeDocument,
          documents,
          folders,
          focusedOutlineItemId,
        }),
      {
        initialProps: {
          activeDocument: initialDocument,
          documents: [initialDocument],
          folders: createFolders(),
          focusedOutlineItemId: null,
        },
      },
    );

    expect(result.current).toEqual(emptyAssociationState);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current).toEqual(cachedAssociationState);
    });
    expect(deriveSidebarAssociationsMock).toHaveBeenCalledTimes(1);

    const equivalentDocument = createDocument({
      id: 'doc-cache',
      title: '缓存测试文稿',
      outline: [{ id: 'heading-1', title: '实验设计', level: 2 }],
      tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
      sections: [{ id: 'section-1', type: 'paragraph', content: '需要展示缓存命中。' }],
    });

    rerender({
      activeDocument: equivalentDocument,
      documents: [equivalentDocument],
      folders: createFolders(),
      focusedOutlineItemId: null,
    });

    await waitFor(() => {
      expect(result.current).toEqual(cachedAssociationState);
    });
    expect(deriveSidebarAssociationsMock).toHaveBeenCalledTimes(1);
  });

  test('re-derives associations when the focused outline item changes', async () => {
    const deriveSidebarAssociationsMock = vi.mocked(deriveSidebarAssociations);
    deriveSidebarAssociationsMock
      .mockReturnValueOnce(emptyAssociationState)
      .mockReturnValueOnce({
        ...emptyAssociationState,
        similarBlocks: [
          {
            documentId: 'doc-peer',
            documentTitle: '推荐实验记录',
            blockId: 'section-peer-body',
            label: '图谱推荐在实验设计阶段补充了更多候选关系。',
            text: '图谱推荐在实验设计阶段补充了更多候选关系。',
            score: 4,
          },
        ],
      });

    const activeDocument = createDocument({
      id: 'doc-focus',
      title: '聚焦测试文稿',
      outline: [
        { id: 'heading-1', title: '背景', level: 1 },
        { id: 'heading-2', title: '实验设计', level: 2 },
      ],
      sections: [
        { id: 'heading-1', type: 'heading', title: '背景', content: '背景' },
        { id: 'heading-2', type: 'heading', title: '实验设计', content: '实验设计' },
      ],
    });

    const { rerender } = renderHook<
      ReturnType<typeof useSidebarAssociations>,
      {
        activeDocument: DocumentRecord | null;
        focusedOutlineItemId: string | null;
      }
    >(
      ({
        activeDocument: currentDocument,
        focusedOutlineItemId,
      }) =>
        useSidebarAssociations({
          activeDocument: currentDocument,
          documents: [currentDocument].filter((document): document is DocumentRecord => Boolean(document)),
          folders: createFolders(),
          focusedOutlineItemId,
        }),
      {
        initialProps: {
          activeDocument,
          focusedOutlineItemId: null,
        },
      },
    );

    await waitFor(() => {
      expect(deriveSidebarAssociationsMock).toHaveBeenCalledTimes(1);
    });
    expect(deriveSidebarAssociationsMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        focusedOutlineItem: null,
      }),
    );

    rerender({
      activeDocument,
      focusedOutlineItemId: 'heading-2',
    });

    await waitFor(() => {
      expect(deriveSidebarAssociationsMock).toHaveBeenCalledTimes(2);
    });
    expect(deriveSidebarAssociationsMock.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        focusedOutlineItem: expect.objectContaining({
          id: 'heading-2',
          title: '实验设计',
        }),
      }),
    );
  });

  test('builds cache keys from semantic sidebar inputs', () => {
    const activeDocument = createDocument({
      id: 'doc-key',
      title: '缓存键文稿',
      tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
    });

    const baseKey = buildSidebarAssociationsCacheKey({
      activeDocument,
      documents: [activeDocument],
      folders: createFolders(),
      focusedOutlineItemId: null,
    });
    const changedTagsKey = buildSidebarAssociationsCacheKey({
      activeDocument: createDocument({
        ...activeDocument,
        tags: [{ id: 'tag-graph', label: '#图谱', tone: 'neutral' }],
      }),
      documents: [activeDocument],
      folders: createFolders(),
      focusedOutlineItemId: null,
    });
    const changedOutlineFocusKey = buildSidebarAssociationsCacheKey({
      activeDocument,
      documents: [activeDocument],
      folders: createFolders(),
      focusedOutlineItemId: 'heading-2',
    });
    const phraseDocument = createDocument({
      id: 'doc-key',
      title: '缓存键文稿',
      contentJson: JSON.stringify([
        {
          id: 'phrase-product-route',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '公司坚定不移践行产品化路线', styles: {} }],
          children: [],
        },
      ]),
    });
    const phraseContentKey = buildSidebarAssociationsCacheKey({
      activeDocument: phraseDocument,
      documents: [phraseDocument],
      folders: createFolders(),
      focusedOutlineItemId: null,
    });

    expect(changedTagsKey).not.toBe(baseKey);
    expect(changedOutlineFocusKey).not.toBe(baseKey);
    expect(phraseContentKey).toContain('公司坚定不移践行产品化路线');
  });
});
