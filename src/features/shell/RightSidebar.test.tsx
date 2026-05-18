import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../app/App';
import type { SidebarAssociatedDocument } from '../../shared/lib/sidebarAssociations';
import type { DocumentRecord } from '../../shared/types/workspace';
import { RightSidebar } from './RightSidebar';

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

const emptyAssociationState = {
  relatedDocuments: [],
  relatedTags: [],
  similarBlocks: [],
  suggestedLinks: [],
  textEvidence: [],
  associatedDocuments: [],
  summary: {
    wikiAssociationCount: 0,
  },
};

const openWikiTab = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Wiki/ }));
};

const createAssociatedDocument = (
  overrides: Partial<SidebarAssociatedDocument> = {},
): SidebarAssociatedDocument => ({
  documentId: 'doc-associated',
  title: '关联文档',
  folderPath: '',
  score: 1,
  badges: ['主题相似'],
  recommendationReason: '主题相似',
  evidenceStrength: 'low',
  similarityEvidence: [],
  textEvidence: [],
  ...overrides,
});

test('renders property and wiki tabs with a wiki association badge', () => {
  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '当前文档',
        tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
        ...emptyAssociationState,
        relatedDocuments: [
          {
            documentId: 'doc-related',
            title: '关系图方案',
            folderPath: '产品策略',
            score: 8,
            reason: '内容相似',
          },
        ],
        textEvidence: [
          {
            documentId: 'doc-evidence',
            documentTitle: '问题清单宣贯稿内容',
            blockId: 'long-context',
            label: '问题清单宣贯稿内容',
            matchedText: '公司坚定不移践行产品化路线',
            snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
            reason: '命中关键句',
            score: 12,
          },
        ],
        summary: {
          wikiAssociationCount: 2,
        },
      }}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
    />
  );

  expect(screen.getByRole('button', { name: '属性' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Wiki 2/ })).toBeInTheDocument();
  expect(screen.getByText('标签云')).toBeInTheDocument();
  expect(screen.queryByText('显式引用')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Wiki 2/ }));

  expect(screen.getByText('显式引用')).toBeInTheDocument();
  expect(screen.getByText('关联文档')).toBeInTheDocument();
  expect(screen.queryByText('相关主题')).not.toBeInTheDocument();
  expect(screen.queryByText('原文线索')).not.toBeInTheDocument();
});

test('renders text evidence in the wiki tab and opens the matched source block', async () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '测试文档',
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
        ...emptyAssociationState,
        textEvidence: [
          {
            documentId: 'doc-evidence',
            documentTitle: '问题清单宣贯稿内容',
            blockId: 'long-context',
            label: '问题清单宣贯稿内容',
            matchedText: '公司坚定不移践行产品化路线',
            snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
            reason: '命中关键句',
            score: 12,
          },
        ],
        summary: {
          wikiAssociationCount: 1,
        },
      }}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  openWikiTab();

  expect(screen.getByText('关联文档')).toBeInTheDocument();
  const associatedDocumentButton = screen.getByRole('button', {
    name: '打开关联文档 问题清单宣贯稿内容',
  });
  expect(associatedDocumentButton).toBeInTheDocument();
  expect(screen.getByText('原文命中')).toBeInTheDocument();
  expect(screen.getByText('1 条线索')).toBeInTheDocument();

  fireEvent.mouseEnter(associatedDocumentButton);

  expect(screen.getByText(/公司坚定不移践行产品化路线/)).toBeInTheDocument();

  fireEvent.click(
    await screen.findByRole('button', {
      name: '打开原文证据 问题清单宣贯稿内容 / 公司坚定不移践行产品化路线',
    }),
  );

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-evidence',
    blockId: 'long-context',
    fallbackText: expect.stringContaining('公司坚定不移践行产品化路线'),
    highlightQuery: '公司坚定不移践行产品化路线',
  });
});

test('renders aggregated associated document evidence in the wiki tab', async () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '测试文档',
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
        ...emptyAssociationState,
        relatedDocuments: [
          {
            documentId: 'doc-evidence',
            title: '问题清单宣贯稿内容',
            folderPath: '产品策略',
            score: 8,
            reason: '内容相似',
            previewMatches: [
              {
                blockId: 'semantic-match',
                label: '相似段落',
                snippet: '知识库语义面板应该展示被引用和被提及的内容。',
                searchText: '知识库语义面板应该展示被引用和被提及的内容。',
              },
            ],
            matchCount: 1,
          },
        ],
        textEvidence: [
          {
            documentId: 'doc-evidence',
            documentTitle: '问题清单宣贯稿内容',
            blockId: 'long-context',
            label: '问题清单宣贯稿内容',
            matchedText: '公司坚定不移践行产品化路线',
            snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
            reason: '命中关键句',
            score: 12,
          },
        ],
        associatedDocuments: [
          {
            documentId: 'doc-evidence',
            title: '问题清单宣贯稿内容',
            folderPath: '产品策略',
            score: 12,
            badges: ['主题相似', '原文命中'],
            recommendationReason: '命中关键句',
            evidenceStrength: 'high',
            similarityEvidence: [
              {
                blockId: 'semantic-match',
                label: '相似段落',
                snippet: '知识库语义面板应该展示被引用和被提及的内容。',
                searchText: '知识库语义面板应该展示被引用和被提及的内容。',
                reason: '内容相似',
                score: 8,
              },
            ],
            textEvidence: [
              {
                documentId: 'doc-evidence',
                documentTitle: '问题清单宣贯稿内容',
                blockId: 'long-context',
                label: '问题清单宣贯稿内容',
                matchedText: '公司坚定不移践行产品化路线',
                snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
                reason: '命中关键句',
                score: 12,
              },
            ],
          },
        ],
        summary: {
          wikiAssociationCount: 1,
        },
      }}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  openWikiTab();

  expect(screen.getByText('关联文档')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开关联文档 问题清单宣贯稿内容' })).toBeInTheDocument();
  expect(screen.getByText('主题相似')).toBeInTheDocument();
  expect(screen.getByText('原文命中')).toBeInTheDocument();
  expect(screen.getByText('1 处相似 · 1 条线索')).toBeInTheDocument();
  expect(screen.queryByText('原文线索')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '查看全部线索 问题清单宣贯稿内容' }));

  expect(screen.getByText('全部线索')).toBeInTheDocument();
  expect(screen.getByText('问题清单宣贯稿内容')).toBeInTheDocument();
  expect(screen.getAllByText('命中关键句').length).toBeGreaterThan(0);
  expect(screen.getByText('相似证据')).toBeInTheDocument();
  expect(screen.getAllByText('原文命中').length).toBeGreaterThan(0);

  fireEvent.click(
    screen.getByRole('button', {
      name: '打开原文证据 问题清单宣贯稿内容 / 公司坚定不移践行产品化路线',
    }),
  );

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-evidence',
    blockId: 'long-context',
    fallbackText: expect.stringContaining('公司坚定不移践行产品化路线'),
    highlightQuery: '公司坚定不移践行产品化路线',
  });
  handleOpenBacklinkDocument.mockClear();

  fireEvent.click(screen.getByRole('button', { name: '返回关联文档列表' }));
  expect(screen.getByRole('button', { name: '打开关联文档 问题清单宣贯稿内容' })).toBeInTheDocument();

  fireEvent.mouseEnter(screen.getByRole('button', { name: '打开关联文档 问题清单宣贯稿内容' }));

  expect(screen.getByText(/知识库语义面板应该展示/)).toBeInTheDocument();
  expect(screen.getByText(/公司坚定不移践行产品化路线/)).toBeInTheDocument();

  fireEvent.click(
    await screen.findByRole('button', {
      name: '打开原文证据 问题清单宣贯稿内容 / 公司坚定不移践行产品化路线',
    }),
  );

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-evidence',
    blockId: 'long-context',
    fallbackText: expect.stringContaining('公司坚定不移践行产品化路线'),
    highlightQuery: '公司坚定不移践行产品化路线',
  });
});

test('supports lightweight recommendation feedback without treating it as relation confirmation', () => {
  const handleMarkUseful = vi.fn();
  const handleShowLessLikeThis = vi.fn();

  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '测试文档',
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
        ...emptyAssociationState,
        associatedDocuments: [
          createAssociatedDocument({
            documentId: 'doc-neutral',
            title: '普通关联',
            score: 8,
          }),
          createAssociatedDocument({
            documentId: 'doc-less',
            title: '噪声关联',
            score: 12,
          }),
          createAssociatedDocument({
            documentId: 'doc-useful',
            title: '高价值关联',
            score: 4,
          }),
        ],
        summary: {
          wikiAssociationCount: 3,
        },
      }}
      recommendationFeedback={{
        'doc-less': 'less-like-this',
        'doc-useful': 'useful',
      }}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onMarkRecommendationUseful={handleMarkUseful}
      onShowLessLikeThis={handleShowLessLikeThis}
    />
  );

  openWikiTab();

  expect(
    screen.getAllByRole('button', { name: /打开关联文档/ }).map((button) => button.getAttribute('aria-label')),
  ).toEqual(['打开关联文档 高价值关联', '打开关联文档 普通关联', '打开关联文档 噪声关联']);
  expect(screen.getByText('已标记有用')).toBeInTheDocument();
  expect(screen.getByText('已减少此类')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '标记推荐有用 普通关联' }));
  fireEvent.click(screen.getByRole('button', { name: '减少此类推荐 普通关联' }));

  expect(handleMarkUseful).toHaveBeenCalledWith('doc-neutral');
  expect(handleShowLessLikeThis).toHaveBeenCalledWith('doc-neutral');
});

test('renders the overview and knowledge association sections for the active document', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText('文稿脉络')).toBeInTheDocument();
  });

  expect(screen.getByTestId('right-sidebar')).toHaveClass('overflow-visible');
  expect(screen.getByTestId('right-sidebar-outline-scroll')).toHaveClass('overflow-y-auto');
  expect(screen.getByText('文稿概览')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '属性' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Wiki/ })).toBeInTheDocument();
  expect(screen.getByText('#产品')).toBeInTheDocument();
  expect(screen.queryByText('知识关联')).not.toBeInTheDocument();

  openWikiTab();

  expect(screen.getByTestId('knowledge-association-card')).toHaveClass('border-t');
  expect(screen.getByText('知识关联')).toBeInTheDocument();
  expect(screen.getByText('显式引用')).toBeInTheDocument();
  expect(screen.getByText('关联文档')).toBeInTheDocument();
  expect(screen.queryByText('相关主题')).not.toBeInTheDocument();
  expect(screen.queryByText('原文线索')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开来源文档 架构设计' })).toBeInTheDocument();
  expect(screen.queryByText('上下文')).not.toBeInTheDocument();
  expect(screen.queryByText('关联')).not.toBeInTheDocument();
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

  openWikiTab();

  fireEvent.click(screen.getByRole('button', { name: '打开来源文档 来源文档' }));

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-source',
    blockId: undefined,
  });
});

test('renders explicit reference groups inside the knowledge association card', () => {
  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
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
        backlinks: [
          {
            id: 'backlink-source',
            sourceDocumentId: 'doc-source',
            sourceBlockId: 'block-source-1',
            title: '来源文档',
            description: '这里提到了当前文档',
          },
        ],
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={async () => {}}
    />
  );

  openWikiTab();

  expect(screen.getByText('知识关联')).toBeInTheDocument();
  expect(screen.getByText('显式引用')).toBeInTheDocument();
  expect(screen.getByText('关联文档')).toBeInTheDocument();
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

  openWikiTab();

  fireEvent.click(screen.getByRole('button', { name: '打开提及文档 目标文档' }));

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-target',
    blockId: undefined,
  });
});

test('renders similar knowledge results for the active document and opens matched blocks from the hover preview', async () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '当前文档',
        tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
        sections: [
          { id: 'section-current', type: 'paragraph', title: '当前文稿命中 1', content: '知识库语义面板展示相似文稿与相似片段预览。' },
          { id: 'section-current-2', type: 'paragraph', title: '当前文稿命中 2', content: '引用与提及列表应该保持清晰的视觉层级。' },
        ],
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
        ...emptyAssociationState,
        relatedDocuments: [
          {
            documentId: 'doc-related',
            title: '关系图方案',
            folderPath: '产品策略',
            score: 8,
            reason: '2 处内容相似',
            previewMatches: [
              {
                blockId: 'section-related',
                label: '相似命中 1',
                snippet: '知识库语义面板支持相似文稿和相似片段预览。',
                searchText: '知识库语义面板支持相似文稿和相似片段预览。',
              },
              {
                blockId: 'section-related-2',
                label: '相似命中 2',
                snippet: '引用与提及列表应该保持轻量而清晰的视觉层级。',
                searchText: '引用与提及列表应该保持轻量而清晰的视觉层级。',
              },
            ],
            matchCount: 2,
          },
        ],
      }}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  openWikiTab();

  expect(screen.getByText('知识关联')).toBeInTheDocument();
  expect(screen.getByText('显式引用')).toBeInTheDocument();
  expect(screen.getByText('关联文档')).toBeInTheDocument();
  const similarDocumentButton = screen.getByRole('button', { name: '打开关联文档 关系图方案' });
  expect(similarDocumentButton).toBeInTheDocument();
  expect(screen.queryByText('推荐标签')).not.toBeInTheDocument();
  expect(screen.queryByText('建议链接')).not.toBeInTheDocument();
  expect(screen.queryByText('知识库语义面板展示相似文稿与相似片段预览。')).not.toBeInTheDocument();

  fireEvent.mouseEnter(similarDocumentButton);

  expect(screen.getByText(/知识库语义面板支持相似文稿/)).toBeInTheDocument();
  expect(screen.getByText(/引用与提及列表应该保持轻量/)).toBeInTheDocument();

  const matchedBlockButton = await screen.findByRole('button', {
    name: '打开相似证据 关系图方案 / 相似命中 1',
  });
  fireEvent.click(matchedBlockButton);

  await waitFor(() => {
    expect(handleOpenBacklinkDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-related',
        blockId: 'section-related',
        fallbackText: expect.stringContaining('知识库语义面板支持相似文稿和相似片段预览。'),
      }),
    );
  });
  expect(screen.queryByText(/知识库语义面板支持相似文稿/)).not.toBeInTheDocument();

  fireEvent.mouseLeave(similarDocumentButton);

  expect(screen.queryByText(/引用与提及列表应该保持轻量/)).not.toBeInTheDocument();
});

test('shows similar block knowledge after clicking an outline item', () => {
  const handleOpenBacklinkDocument = vi.fn();

  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '当前文档',
        outline: [{ id: 'heading-focus', title: '实验设计', level: 2 }],
        sections: [
          { id: 'heading-focus', type: 'heading', title: '实验设计', content: '实验设计' },
          { id: 'section-current', type: 'paragraph', content: '需要比较图谱推荐与标签推荐的效果。' },
        ],
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      associationState={{
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
      }}
      focusedOutlineItemId="heading-focus"
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
      onOpenBacklinkDocument={handleOpenBacklinkDocument}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: '定位到大纲标题 实验设计' }));
  openWikiTab();

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-current',
    blockId: 'heading-focus',
  });
  expect(screen.getByText('知识关联')).toBeInTheDocument();
  expect(screen.getByText('关联文档')).toBeInTheDocument();
  const associatedDocumentButton = screen.getByRole('button', { name: '打开关联文档 推荐实验记录' });
  expect(associatedDocumentButton).toBeInTheDocument();

  fireEvent.mouseEnter(associatedDocumentButton);

  fireEvent.click(
    screen.getByRole('button', {
      name: '打开相似证据 推荐实验记录 / 图谱推荐在实验设计阶段补充了更多候选关系。',
    }),
  );

  expect(handleOpenBacklinkDocument).toHaveBeenCalledWith({
    documentId: 'doc-peer',
    blockId: 'section-peer-body',
    fallbackText: '图谱推荐在实验设计阶段补充了更多候选关系。',
    highlightQuery: '图谱推荐在实验设计阶段补充了更多候选关系。',
  });
});

test('shows empty states for explicit references and similar knowledge independently', () => {
  render(
    <RightSidebar
      activeDocument={createDocument({
        id: 'doc-current',
        title: '当前文档',
      })}
      activeQuickNote={null}
      activeFolder={null}
      activeSpace={null}
      onAddTagToDocument={async () => {}}
      onRemoveTagFromDocument={async () => {}}
    />
  );

  openWikiTab();

  expect(screen.getByText('当前文稿还没有引用或提及')).toBeInTheDocument();
  expect(screen.getByText('暂未发现关联文档')).toBeInTheDocument();
  expect(screen.queryByText('暂未发现相关主题')).not.toBeInTheDocument();
  expect(screen.queryByText('暂未发现原文线索')).not.toBeInTheDocument();
  expect(screen.queryByText('当前文档还没有上下文引用')).not.toBeInTheDocument();
  expect(screen.queryByText('暂未发现可推荐的关联')).not.toBeInTheDocument();
});
