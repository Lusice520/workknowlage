import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { EditorHost } from './EditorHost';

afterEach(() => {
  vi.useRealTimers();
});

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

test('renders persisted numbered list items with sequential data-index decorations', async () => {
  const { container } = render(
    <EditorHost
      document={{
        id: 'doc-numbered-list',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '编号列表测试',
        contentJson: JSON.stringify([
          {
            id: 'numbered-item-1',
            type: 'numberedListItem',
            props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
            content: [{ type: 'text', text: '第一项', styles: {} }],
            children: [],
          },
          {
            id: 'numbered-item-2',
            type: 'numberedListItem',
            props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
            content: [{ type: 'text', text: '第二项', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '6 字',
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
    expect(screen.getByText('第一项')).toBeInTheDocument();
    expect(screen.getByText('第二项')).toBeInTheDocument();
  });

  await waitFor(() => {
    const numberedItems = Array.from(
      container.querySelectorAll('.bn-block-content[data-content-type="numberedListItem"]')
    );

    expect(numberedItems).toHaveLength(2);
    expect(numberedItems[0]).toHaveAttribute('data-index', '1');
    expect(numberedItems[1]).toHaveAttribute('data-index', '2');
  });
});

test('normalizes pasted numbered list items that carry polluted start values', async () => {
  const { container } = render(
    <EditorHost
      document={{
        id: 'doc-pasted-numbered-list',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '粘贴编号列表测试',
        contentJson: JSON.stringify([
          {
            id: 'numbered-item-pasted-1',
            type: 'numberedListItem',
            props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left', start: 83 },
            content: [{ type: 'text', text: 'HMI 负责交互', styles: {} }],
            children: [],
          },
          {
            id: 'numbered-item-pasted-2',
            type: 'numberedListItem',
            props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left', start: 107 },
            content: [{ type: 'text', text: '算法负责模型', styles: {} }],
            children: [],
          },
          {
            id: 'numbered-item-pasted-3',
            type: 'numberedListItem',
            props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left', start: 132 },
            content: [{ type: 'text', text: '现场调试负责验证', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '12 字',
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
    expect(screen.getByText('HMI 负责交互')).toBeInTheDocument();
    expect(screen.getByText('算法负责模型')).toBeInTheDocument();
    expect(screen.getByText('现场调试负责验证')).toBeInTheDocument();
  });

  await waitFor(() => {
    const numberedItems = Array.from(
      container.querySelectorAll('.bn-block-content[data-content-type="numberedListItem"]')
    );

    expect(numberedItems).toHaveLength(3);
    expect(numberedItems[0]).toHaveAttribute('data-index', '1');
    expect(numberedItems[1]).toHaveAttribute('data-index', '2');
    expect(numberedItems[2]).toHaveAttribute('data-index', '3');
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
  const handleFocusTargetConsumed = vi.fn();
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
      onFocusTargetConsumed={handleFocusTargetConsumed}
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
      onFocusTargetConsumed={handleFocusTargetConsumed}
      focusTarget={{ documentId: 'doc-focus-target', blockId: 'paragraph-focus-target', requestKey: 1 }}
    />
  );

  await waitFor(() => {
    expect(blockScrollSpy).not.toHaveBeenCalled();
    expect(surfaceScrollSpy).toHaveBeenCalledWith({
      top: 440,
      behavior: 'smooth',
    });
    expect(handleFocusTargetConsumed).toHaveBeenCalledWith(1);
    expect(blockEl.classList.contains('wk-block-focus-target')).toBe(true);
    expect(blockContentEl?.classList.contains('wk-block-focus-target-content')).toBe(true);
  });
});

test('retries block focusing until the target block is mounted in the editor surface', async () => {
  const { container, rerender } = render(
    <EditorHost
      document={{
        id: 'doc-delayed-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '延迟定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-delayed-focus',
            type: 'paragraph',
            content: [{ type: 'text', text: '延迟后也要高亮', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '7 字',
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
    const nextBlockEl = container.querySelector('[data-id="paragraph-delayed-focus"]') as HTMLElement | null;
    expect(nextBlockEl).toBeTruthy();
    return nextBlockEl as HTMLElement;
  });

  const blockContentEl = blockEl.querySelector('.bn-block-content[data-content-type="paragraph"]') as HTMLElement | null;
  const surfaceEl = container.querySelector('.shared-blocknote-surface') as HTMLElement | null;
  const editorHostEl = container.querySelector('section') as HTMLElement | null;
  expect(blockContentEl).toBeTruthy();
  expect(surfaceEl).toBeTruthy();
  expect(editorHostEl).toBeTruthy();

  vi.useFakeTimers();

  const originalQuerySelector = editorHostEl!.querySelector.bind(editorHostEl);
  let missedLookups = 0;
  vi.spyOn(editorHostEl!, 'querySelector').mockImplementation((selector: string) => {
    if (selector === '[data-id="paragraph-delayed-focus"]' && missedLookups < 2) {
      missedLookups += 1;
      return null;
    }

    return originalQuerySelector(selector);
  });

  const surfaceScrollSpy = vi.fn();
  surfaceEl!.scrollTo = surfaceScrollSpy;
  surfaceEl!.scrollTop = 0;
  blockEl.getBoundingClientRect = () => ({
    top: 360,
    bottom: 420,
    left: 0,
    right: 0,
    width: 400,
    height: 60,
    x: 0,
    y: 360,
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
        id: 'doc-delayed-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '延迟定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-delayed-focus',
            type: 'paragraph',
            content: [{ type: 'text', text: '延迟后也要高亮', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '7 字',
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
      focusTarget={{ documentId: 'doc-delayed-focus', blockId: 'paragraph-delayed-focus', requestKey: 1 }}
    />
  );

  await act(async () => {
    vi.advanceTimersByTime(180);
  });

  expect(missedLookups).toBe(2);
  expect(surfaceScrollSpy).toHaveBeenCalled();
  expect(blockEl.classList.contains('wk-block-focus-target')).toBe(true);
  expect(blockContentEl?.classList.contains('wk-block-focus-target-content')).toBe(true);
});

test('falls back to matching block text when the requested block id cannot be found', async () => {
  const { container, rerender } = render(
    <EditorHost
      document={{
        id: 'doc-fallback-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '文本定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-real-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '任务登记弹窗应支持责任人校验与状态回写。', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '10 字',
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
    const nextBlockEl = container.querySelector('[data-id="paragraph-real-target"]') as HTMLElement | null;
    expect(nextBlockEl).toBeTruthy();
    return nextBlockEl as HTMLElement;
  });

  const blockContentEl = blockEl.querySelector('.bn-block-content[data-content-type="paragraph"]') as HTMLElement | null;
  const surfaceEl = container.querySelector('.shared-blocknote-surface') as HTMLElement | null;
  expect(blockContentEl).toBeTruthy();
  expect(surfaceEl).toBeTruthy();

  const surfaceScrollSpy = vi.fn();
  surfaceEl!.scrollTo = surfaceScrollSpy;
  surfaceEl!.scrollTop = 0;
  blockEl.getBoundingClientRect = () => ({
    top: 260,
    bottom: 320,
    left: 0,
    right: 0,
    width: 400,
    height: 60,
    x: 0,
    y: 260,
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
        id: 'doc-fallback-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '文本定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-real-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '任务登记弹窗应支持责任人校验与状态回写。', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '10 字',
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
      focusTarget={{
        documentId: 'doc-fallback-focus',
        blockId: 'paragraph-missing-target',
        fallbackText: '任务登记弹窗应支持责任人校验与状态回写。',
        requestKey: 1,
      }}
    />
  );

  await waitFor(() => {
    expect(surfaceScrollSpy).toHaveBeenCalled();
    const matchActive = blockEl.querySelector('.wk-editor-search-match-active');
    expect(matchActive).toBeTruthy();
  });
});

test('falls back to block highlight when transient search text cannot be matched', async () => {
  const onFocusDiagnostic = vi.fn();
  const { container, rerender } = render(
    <EditorHost
      document={{
        id: 'doc-highlight-fallback',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '高亮回退测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-highlight-fallback',
            type: 'paragraph',
            content: [{ type: 'text', text: '这里有一段会被定位但不会被全文高亮的内容。', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '12 字',
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
      onFocusDiagnostic={onFocusDiagnostic}
      focusTarget={null}
    />
  );

  const blockEl = await waitFor(() => {
    const nextBlockEl = container.querySelector('[data-id="paragraph-highlight-fallback"]') as HTMLElement | null;
    expect(nextBlockEl).toBeTruthy();
    return nextBlockEl as HTMLElement;
  });

  const blockContentEl = blockEl.querySelector('.bn-block-content[data-content-type="paragraph"]') as HTMLElement | null;
  const surfaceEl = container.querySelector('.shared-blocknote-surface') as HTMLElement | null;
  expect(blockContentEl).toBeTruthy();
  expect(surfaceEl).toBeTruthy();

  const surfaceScrollSpy = vi.fn();
  surfaceEl!.scrollTo = surfaceScrollSpy;
  surfaceEl!.scrollTop = 0;
  blockEl.getBoundingClientRect = () => ({
    top: 260,
    bottom: 320,
    left: 0,
    right: 0,
    width: 400,
    height: 60,
    x: 0,
    y: 260,
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
        id: 'doc-highlight-fallback',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '高亮回退测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-highlight-fallback',
            type: 'paragraph',
            content: [{ type: 'text', text: '这里有一段会被定位但不会被全文高亮的内容。', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '12 字',
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
      onFocusDiagnostic={onFocusDiagnostic}
      focusTarget={{
        documentId: 'doc-highlight-fallback',
        blockId: 'paragraph-highlight-fallback',
        fallbackText: '完全不存在的搜索片段',
        requestKey: 3,
      }}
    />
  );

  await waitFor(() => {
    expect(surfaceScrollSpy).toHaveBeenCalled();
    expect(blockContentEl?.classList.contains('wk-block-focus-target-content')).toBe(true);
    expect(onFocusDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'highlight-no-match',
        documentId: 'doc-highlight-fallback',
        requestedBlockId: 'paragraph-highlight-fallback',
        resolvedBlockId: 'paragraph-highlight-fallback',
        requestKey: 3,
      }),
    );
  });
});

test('reports a focus-timeout diagnostic when the requested block never mounts', async () => {
  vi.useFakeTimers();

  const onFocusDiagnostic = vi.fn();
  const { container, rerender } = render(
    <EditorHost
      document={{
        id: 'doc-timeout-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '超时定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-timeout-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '这里不会真的挂载出来', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '10 字',
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
      onFocusDiagnostic={onFocusDiagnostic}
      focusTarget={null}
    />
  );

  const editorHostEl = container.querySelector('section') as HTMLElement | null;
  expect(editorHostEl).toBeTruthy();

  vi.spyOn(editorHostEl!, 'querySelector').mockImplementation((selector: string) => {
    if (selector === '[data-id="paragraph-missing-target"]') {
      return null;
    }

    return HTMLElement.prototype.querySelector.call(editorHostEl, selector);
  });

  rerender(
    <EditorHost
      document={{
        id: 'doc-timeout-focus',
        spaceId: 'space-1',
        folderId: 'folder-1',
        title: '超时定位测试',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-timeout-target',
            type: 'paragraph',
            content: [{ type: 'text', text: '这里不会真的挂载出来', styles: {} }],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '10 字',
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
      onFocusDiagnostic={onFocusDiagnostic}
      focusTarget={{
        documentId: 'doc-timeout-focus',
        blockId: 'paragraph-missing-target',
        requestKey: 9,
      }}
    />
  );

  await act(async () => {
    vi.advanceTimersByTime(5000);
  });

  expect(onFocusDiagnostic).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'focus-timeout',
      documentId: 'doc-timeout-focus',
      requestedBlockId: 'paragraph-missing-target',
      requestKey: 9,
    }),
  );
});
