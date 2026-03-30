import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { EditorHost } from './EditorHost';

test('renders the blocknote editor and share controls for the active document', async () => {
  render(
    <EditorHost
      document={{
        id: 'doc-editor',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '测试文档',
        contentJson: JSON.stringify([
          {
            id: 'heading-1',
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: '测试文档', styles: {} }],
            children: [],
          },
          {
            id: 'paragraph-1',
            type: 'paragraph',
            content: [{ type: 'text', text: '文档正文', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '4 字',
        badgeLabel: '测试',
        outline: [{ id: 'heading-1', title: '测试文档', level: 1 }],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(screen.getByText('文档正文')).toBeInTheDocument();
  });

  expect(screen.queryByText('开启分享')).not.toBeInTheDocument();
  expect(screen.queryByText('已自动保存')).not.toBeInTheDocument();
  expect(document.querySelector('.blocknote-unified-editor')).toBeTruthy();
});

test('renders persisted document mentions inline with @ titles', async () => {
  render(
    <EditorHost
      document={{
        id: 'doc-with-mention',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '提及文档测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-mention',
            type: 'paragraph',
            content: [
              { type: 'text', text: '这里关联到 ', styles: {} },
              {
                type: 'docMention',
                props: {
                  documentId: 'doc-target',
                  title: '创意草案',
                },
              },
              { type: 'text', text: ' 以便回链', styles: {} },
            ],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '8 字',
        badgeLabel: '测试',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(screen.getByText('@创意草案')).toBeInTheDocument();
  });
});

test('keeps an alert body paragraph inside the alert body when the title is empty', async () => {
  const { container } = render(
    <EditorHost
      document={{
        id: 'doc-alert-body',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '提醒块正文',
        contentJson: JSON.stringify([
          {
            id: 'alert-1',
            type: 'alert',
            props: { type: 'warning' },
            content: [],
            children: [
              {
                id: 'alert-1-body',
                type: 'paragraph',
                content: [{ type: 'text', text: '老师卡点解封了；阿斯', styles: {} }],
                children: [],
              },
              {
                id: 'alert-1-item-1',
                type: 'numberedListItem',
                content: [{ type: 'text', text: '阿斯蒂芬', styles: {} }],
                children: [],
              },
            ],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '11 字',
        badgeLabel: '测试',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(screen.getByText('老师卡点解封了；阿斯')).toBeInTheDocument();
    expect(screen.getByText('阿斯蒂芬')).toBeInTheDocument();
  });

  const alertRoot = container.querySelector('.bn-block-content[data-content-type="alert"]');
  const bodyParagraph = container.querySelector('.bn-block-group .bn-block-content[data-content-type="paragraph"]');

  expect(alertRoot).toBeTruthy();
  expect(bodyParagraph).toBeTruthy();
  expect(alertRoot).not.toHaveTextContent('老师卡点解封了；阿斯');
  expect(bodyParagraph).toHaveTextContent('老师卡点解封了；阿斯');
});

test('removes a duplicated first alert paragraph when it matches the title', async () => {
  const { container } = render(
    <EditorHost
      document={{
        id: 'doc-alert-dedup',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '提醒块去重',
        contentJson: JSON.stringify([
          {
            id: 'alert-2',
            type: 'alert',
            props: { type: 'warning' },
            content: [{ type: 'text', text: '重复标题', styles: {} }],
            children: [
              {
                id: 'alert-2-body',
                type: 'paragraph',
                content: [{ type: 'text', text: '重复标题', styles: {} }],
                children: [],
              },
              {
                id: 'alert-2-item-1',
                type: 'numberedListItem',
                content: [{ type: 'text', text: '后续列表项', styles: {} }],
                children: [],
              },
            ],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '8 字',
        badgeLabel: '测试',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(screen.getByText('重复标题')).toBeInTheDocument();
    expect(screen.getByText('后续列表项')).toBeInTheDocument();
  });

  const alertRoot = container.querySelector('.bn-block-content[data-content-type="alert"]');
  const duplicatedBodyParagraph = container.querySelector('.bn-block-group .bn-block-content[data-content-type="paragraph"]');
  const duplicatedTitleNodes = screen.getAllByText('重复标题');

  expect(alertRoot).toHaveTextContent('重复标题');
  expect(duplicatedTitleNodes).toHaveLength(1);
  expect(duplicatedBodyParagraph).not.toHaveTextContent('重复标题');
});

test('focuses a requested mention block by scrolling the editor surface and highlighting the block content', async () => {
  const { container, rerender } = render(
    <EditorHost
      document={{
        id: 'doc-focus-target',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-focus-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '定位到这里', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '4 字',
        badgeLabel: '测试',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
      focusTarget={null}
    />
  );

  const blockEl = await waitFor(() => {
    const nextBlockEl = container.querySelector('[data-id="paragraph-focus-target"]') as HTMLElement | null;
    expect(nextBlockEl).toBeTruthy();
    return nextBlockEl as HTMLElement;
  });

  const blockContentEl = blockEl.querySelector('.bn-block-content[data-content-type="paragraph"]') as HTMLElement | null;
  const surfaceEl = container.querySelector('.shared-blocknote-surface') as HTMLElement | null;
  expect(blockContentEl).toBeTruthy();
  expect(surfaceEl).toBeTruthy();

  const blockScrollSpy = vi.fn();
  const surfaceScrollSpy = vi.fn();
  blockEl.scrollIntoView = blockScrollSpy;
  surfaceEl!.scrollTo = surfaceScrollSpy;
  surfaceEl!.scrollTop = 120;
  blockEl.getBoundingClientRect = () => ({
    top: 600,
    bottom: 640,
    left: 0,
    right: 0,
    width: 400,
    height: 40,
    x: 0,
    y: 600,
    toJSON: () => ({}),
  }) as DOMRect;
  surfaceEl!.getBoundingClientRect = () => ({
    top: 100,
    bottom: 500,
    left: 0,
    right: 0,
    width: 800,
    height: 400,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  }) as DOMRect;

  rerender(
    <EditorHost
      document={{
        id: 'doc-focus-target',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-focus-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '定位到这里', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '4 字',
        badgeLabel: '测试',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
      onUploadFiles={vi.fn().mockResolvedValue([])}
      onSaveStatusChange={vi.fn()}
      onContentSnapshotReady={vi.fn()}
      focusTarget={{ documentId: 'doc-focus-target', blockId: 'paragraph-focus-target', requestKey: 1 }}
    />
  );

  await waitFor(() => {
    expect(blockScrollSpy).not.toHaveBeenCalled();
    expect(surfaceScrollSpy).toHaveBeenCalledWith({
      top: 440,
      behavior: 'smooth',
    });
    expect(blockEl.classList.contains('wk-block-focus-target')).toBe(true);
    expect(blockContentEl?.classList.contains('wk-block-focus-target-content')).toBe(true);
  });
});
