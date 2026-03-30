import { buildMentionDocumentCandidates, getFolderPathLabel } from './documentPaths';

test('builds a nested folder path label for mention candidates', () => {
  expect(
    getFolderPathLabel(
      [
        { id: 'folder-root', spaceId: 'space-1', parentId: null, name: '产品库' },
        { id: 'folder-child', spaceId: 'space-1', parentId: 'folder-root', name: '船舶自动化' },
      ],
      'folder-child',
    )
  ).toBe('产品库 / 船舶自动化');
});

test('returns root labels for root-level mention candidates', () => {
  const candidates = buildMentionDocumentCandidates(
    [
      {
        id: 'doc-root',
        spaceId: 'space-1',
        folderId: null,
        title: '根目录文档',
        contentJson: '[]',
        updatedAt: '2026-03-29T00:00:00.000Z',
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      },
    ],
    [],
  );

  expect(candidates).toEqual([
    {
      id: 'doc-root',
      title: '根目录文档',
      folderPath: '根目录',
      updatedAt: '2026-03-29T00:00:00.000Z',
    },
  ]);
});
