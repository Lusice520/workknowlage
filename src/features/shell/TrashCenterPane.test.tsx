import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TrashCenterPane } from './TrashCenterPane';

describe('TrashCenterPane', () => {
  test('sorts trash entries by delete time and exposes restore plus purge actions', () => {
    render(
      <TrashCenterPane
        activeSpaceName="Alpha Space"
        items={[
          {
            id: 'folder-alpha',
            trashRootId: 'folder-alpha',
            kind: 'folder',
            spaceId: 'space-alpha',
            title: 'Alpha Folder',
            deletedAt: '2026-03-27T10:00:00.000Z',
            childDocumentCount: 1,
            childFolderCount: 0,
          },
          {
            id: 'doc-bravo',
            trashRootId: 'doc-bravo',
            kind: 'document',
            spaceId: 'space-alpha',
            title: 'Bravo Doc',
            deletedAt: '2026-03-28T10:00:00.000Z',
            folderId: 'folder-alpha',
          },
        ]}
        onRestoreItem={async () => {}}
        onDeleteItem={async () => {}}
        onEmptyTrash={async () => {}}
      />
    );

    expect(screen.getByRole('heading', { name: '回收站' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alpha Space' })).toBeInTheDocument();
    expect(within(screen.getByTestId('trash-list')).getAllByRole('button', { name: '恢复' })).toHaveLength(2);
    expect(within(screen.getByTestId('trash-list')).getAllByRole('button', { name: '彻底删除' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: '清空回收站' })).toBeInTheDocument();
  });

  test('shows the empty state copy when there are no trash entries', () => {
    render(
      <TrashCenterPane
        activeSpaceName="Alpha Space"
        items={[]}
        onRestoreItem={async () => {}}
        onDeleteItem={async () => {}}
        onEmptyTrash={async () => {}}
      />
    );

    expect(screen.getByText('回收站还是空的')).toBeInTheDocument();
    expect(screen.getByText('删除的文档和文件夹会先留在这里，方便你恢复。')).toBeInTheDocument();
  });
});
