import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CollectionCenterPane } from './CollectionCenterPane';

test('renders favorite documents sorted by recent update, supports search, and keeps titles compact', async () => {
  const user = userEvent.setup();
  const onOpenDocument = vi.fn();
  const onSetDocumentFavorite = vi.fn().mockResolvedValue(undefined);

  render(
    <CollectionCenterPane
      view="favorites"
      activeSpaceName="个人工作空间"
      documents={[
        {
          id: 'doc-older',
          spaceId: 'space-1',
          folderId: 'folder-1',
          title: '较早的文档',
          contentJson: '[]',
          updatedAt: '2026-03-27T08:00:00.000Z',
          updatedAtLabel: '2026年3月27日',
          wordCountLabel: '12 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
          isFavorite: true,
        },
        {
          id: 'doc-newer',
          spaceId: 'space-1',
          folderId: null,
          title: '较新的文档',
          contentJson: '[]',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedAtLabel: '2026年3月28日',
          wordCountLabel: '8 字',
          badgeLabel: '',
          outline: [],
          tags: [],
          backlinks: [],
          sections: [],
          isFavorite: true,
        },
      ]}
      folders={[
        { id: 'folder-1', spaceId: 'space-1', parentId: null, name: '产品' },
      ]}
      onOpenDocument={onOpenDocument}
      onSetDocumentFavorite={onSetDocumentFavorite}
    />
  );

  expect(screen.getByRole('heading', { name: '收藏夹' })).toBeInTheDocument();

  const documentButtons = screen.getAllByRole('button', { name: /打开文档 / });
  expect(documentButtons[0]).toHaveTextContent('较新的文档');
  expect(documentButtons[1]).toHaveTextContent('较早的文档');
  expect(documentButtons[0]).toHaveStyle({
    fontSize: '14px',
    lineHeight: '1.3',
    fontWeight: '600',
  });

  const searchInput = screen.getByRole('searchbox', { name: '检索收藏夹' });
  expect(searchInput).toHaveStyle({
    fontSize: '14px',
    lineHeight: '1.2',
  });
  expect(searchInput.className).toContain('placeholder:text-[13px]');

  await user.type(searchInput, '较新');

  expect(screen.getByRole('button', { name: '打开文档 较新的文档' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '打开文档 较早的文档' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '取消收藏文档 较新的文档' }));

  expect(onSetDocumentFavorite).toHaveBeenCalledWith('doc-newer', false);
});
