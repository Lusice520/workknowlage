import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../app/App';
import { RightSidebar } from './RightSidebar';

test('renders outline, tags, and backlinks for the active document', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText('内容目录')).toBeInTheDocument();
  });

  expect(screen.getByTestId('right-sidebar')).toHaveClass('overflow-hidden');
  expect(screen.getByTestId('right-sidebar-outline-scroll')).toHaveClass('overflow-y-auto');
  expect(screen.getByText('#产品')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开来源文档 架构设计' })).toBeInTheDocument();
  expect(screen.queryByText('文档大纲')).not.toBeInTheDocument();
  expect(screen.queryByText('文档属性')).not.toBeInTheDocument();
  expect(screen.queryByText('局域网只读')).not.toBeInTheDocument();
  expect(screen.queryByText('快速操作')).not.toBeInTheDocument();
  expect(screen.queryByText('第一阶段先保留入口，第二阶段接局域网只读分享和导出能力。')).not.toBeInTheDocument();
});

test('keeps the tag input compact when adding a tag', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '添加标签' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '添加标签' }));

  const tagInput = await screen.findByPlaceholderText('输入标签...');
  expect(tagInput).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
});

test('renders outline for the active quick note with heading level labels', () => {
  render(
    <RightSidebar
      activeDocument={null}
      activeQuickNote={{
        id: 'quick-note-1',
        noteDate: '2026-03-28',
        title: '3月28日快记',
        contentJson: JSON.stringify([
          {
            id: 'heading-1',
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: '会议纪要', styles: {} }],
            children: [],
          },
          {
            id: 'heading-2',
            type: 'heading',
            props: { level: 2 },
            content: [{ type: 'text', text: '待办事项', styles: {} }],
            children: [],
          },
          {
            id: 'heading-4',
            type: 'heading',
            props: { level: 4 },
            content: [{ type: 'text', text: '实现细节', styles: {} }],
            children: [],
          },
        ]),
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      }}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
    />
  );

  expect(screen.getByText('会议纪要')).toBeInTheDocument();
  expect(screen.getByText('待办事项')).toBeInTheDocument();
  expect(screen.getByText('实现细节')).toBeInTheDocument();
  expect(screen.getByText('H1')).toBeInTheDocument();
  expect(screen.getByText('H2')).toBeInTheDocument();
  expect(screen.getByText('H4')).toBeInTheDocument();
  expect(screen.queryByText('暂无大纲内容')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '添加标签' })).toBeDisabled();
  expect(screen.queryByText('•')).not.toBeInTheDocument();
});

test('opens the matching heading when clicking an outline item', () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={{
        id: 'doc-outline',
        spaceId: 'space-1',
        folderId: null,
        title: '大纲文档',
        contentJson: JSON.stringify([]),
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [
          { id: 'heading-1', title: '一级标题', level: 1 },
          { id: 'heading-2', title: '二级标题', level: 2 },
          { id: 'heading-4', title: '四级标题', level: 4 },
        ],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: '定位到大纲标题 一级标题' }));

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-outline',
    blockId: 'heading-1',
  });
  expect(screen.getByText('四级标题')).toBeInTheDocument();
  expect(screen.getByText('H4')).toBeInTheDocument();
  expect(screen.queryByText('•')).not.toBeInTheDocument();
});

test('opens the source document when clicking a backlink card', () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={{
        id: 'doc-target',
        spaceId: 'space-1',
        folderId: null,
        title: '目标文档',
        contentJson: JSON.stringify([]),
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [],
        tags: [],
        backlinks: [
          {
            id: 'backlink-source',
            sourceDocumentId: 'doc-source',
            title: '来源文档',
            description: '这里提到了目标文档',
          },
        ],
        sections: [],
      }}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: '打开来源文档 来源文档' }));

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-source',
    blockId: undefined,
  });
});

test('renders outgoing and incoming reference groups for the active document', () => {
  render(
    <RightSidebar
      activeDocument={{
        id: 'doc-current',
        spaceId: 'space-1',
        folderId: null,
        title: '当前文档',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '这里关联了 ', styles: {} },
              {
                type: 'docMention',
                props: {
                  documentId: 'doc-target',
                  title: '目标文档',
                },
              },
              { type: 'text', text: '，并再次提到 ', styles: {} },
              {
                type: 'docMention',
                props: {
                  documentId: 'doc-target',
                  title: '目标文档',
                },
              },
              { type: 'text', text: '。', styles: {} },
            ],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [],
        tags: [],
        backlinks: [
          {
            id: 'backlink-source',
            sourceDocumentId: 'doc-source',
            sourceBlockId: 'block-source-1',
            title: '来源文档',
            description: '这里提到了当前文档',
          },
        ],
        sections: [],
      }}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={async () => {}}
    />
  );

  expect(screen.getByText('提及文档')).toBeInTheDocument();
  expect(screen.getByText('被提及于')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开提及文档 目标文档' })).toBeInTheDocument();
  expect(screen.getAllByText('目标文档')).toHaveLength(1);
  expect(screen.getByRole('button', { name: '打开来源文档 来源文档' })).toBeInTheDocument();
});

test('opens the mentioned target document when clicking an outgoing reference card', () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={{
        id: 'doc-current',
        spaceId: 'space-1',
        folderId: null,
        title: '当前文档',
        contentJson: JSON.stringify([
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '这里关联了 ', styles: {} },
              {
                type: 'docMention',
                props: {
                  documentId: 'doc-target',
                  title: '目标文档',
                },
              },
            ],
            children: [],
          },
        ]),
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: '打开提及文档 目标文档' }));

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-target',
    blockId: undefined,
  });
});

test('shows a unified empty state when the active document has no references', () => {
  render(
    <RightSidebar
      activeDocument={{
        id: 'doc-current',
        spaceId: 'space-1',
        folderId: null,
        title: '当前文档',
        contentJson: JSON.stringify([]),
        updatedAtLabel: 'today',
        wordCountLabel: '0 字',
        badgeLabel: '',
        outline: [],
        tags: [],
        backlinks: [],
        sections: [],
      }}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
    />
  );

  expect(screen.getByText('当前文档还没有关联引用')).toBeInTheDocument();
  expect(screen.queryByText('提及文档')).not.toBeInTheDocument();
  expect(screen.queryByText('被提及于')).not.toBeInTheDocument();
});
