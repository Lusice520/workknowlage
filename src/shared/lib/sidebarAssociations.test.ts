import { describe, expect, test } from 'vitest';
import type { DocumentRecord, FolderNode } from '../types/workspace';
import { deriveSidebarAssociations } from './sidebarAssociations';

const folders: FolderNode[] = [
  {
    id: 'folder-product',
    spaceId: 'space-1',
    parentId: null,
    name: '产品',
  },
];

const buildDocument = (overrides: Partial<DocumentRecord>): DocumentRecord => ({
  id: 'doc-default',
  spaceId: 'space-1',
  folderId: 'folder-product',
  title: '默认文档',
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

describe('deriveSidebarAssociations', () => {
  test('derives similar documents from content overlap only and exposes preview snippets', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '知识关联侧栏',
      tags: [
        { id: 'tag-product', label: '#产品', tone: 'primary' },
        { id: 'tag-sidebar', label: '#侧栏', tone: 'neutral' },
      ],
      backlinks: [
        {
          id: 'backlink-mentioned',
          sourceDocumentId: 'doc-mentioned',
          title: '被其他文档提及',
          description: '用于验证显式关系不会进入相似文稿',
        },
      ],
      sections: [
        { id: 'heading-sidebar', type: 'heading', title: '知识关联设计' },
        { id: 'paragraph-sidebar-1', type: 'paragraph', content: '知识库语义面板需要展示被引用、被提及和相似内容。' },
        { id: 'paragraph-sidebar-2', type: 'paragraph', content: '鼠标移上相似文稿后，在左侧预览对应片段。' },
      ],
      outline: [{ id: 'heading-sidebar', title: '知识关联设计', level: 1 }],
    });

    const contentSimilarDocument = buildDocument({
      id: 'doc-related',
      title: '相似片段预览',
      tags: [
        { id: 'tag-ui', label: '#UI交互', tone: 'neutral' },
      ],
      sections: [
        { id: 'heading-related', type: 'heading', title: '知识库语义' },
        { id: 'paragraph-related-1', type: 'paragraph', content: '知识库语义面板应该展示被引用和被提及的内容。' },
        { id: 'paragraph-related-2', type: 'paragraph', content: '鼠标移上相似文稿后，在左侧预览对应片段和命中原因。' },
      ],
    });

    const sharedTagOnlyDocument = buildDocument({
      id: 'doc-tag-only',
      title: '标签整理',
      tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
      sections: [{ id: 'paragraph-tag-only', type: 'paragraph', content: '机票、酒店和行李整理' }],
    });

    const explicitMentionOnlyDocument = buildDocument({
      id: 'doc-mentioned',
      title: '引用网络',
      sections: [{ id: 'paragraph-mentioned', type: 'paragraph', content: '这是另一篇文稿的引用来源，但内容并不相似。' }],
    });

    const unrelatedDocument = buildDocument({
      id: 'doc-unrelated',
      title: '出差清单',
      tags: [{ id: 'tag-travel', label: '#出差', tone: 'neutral' }],
      sections: [{ id: 'paragraph-travel', type: 'paragraph', content: '机票、酒店和行李整理' }],
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [
        activeDocument,
        contentSimilarDocument,
        sharedTagOnlyDocument,
        explicitMentionOnlyDocument,
        unrelatedDocument,
      ],
      folders,
    });

    expect(result.relatedDocuments).toHaveLength(1);
    expect(result.relatedDocuments[0]).toMatchObject({
      documentId: 'doc-related',
      title: '相似片段预览',
      folderPath: '产品',
      reason: expect.stringContaining('内容相似'),
      currentSnippet: expect.any(String),
      matchedSnippet: expect.any(String),
      matchedSnippets: expect.any(Array),
      previewMatches: expect.any(Array),
      matchCount: expect.any(Number),
    });
    expect(result.relatedDocuments[0].currentSnippet?.length).toBeGreaterThan(0);
    expect(result.relatedDocuments[0].matchedSnippet?.length).toBeGreaterThan(0);
    expect(result.relatedDocuments[0].matchedSnippets?.length).toBeGreaterThan(1);
    expect(result.relatedDocuments[0].previewMatches?.[0]).toEqual(
      expect.objectContaining({
        blockId: expect.any(String),
        label: expect.any(String),
        snippet: expect.any(String),
        searchText: expect.any(String),
      }),
    );
    expect(result.relatedDocuments[0].matchCount).toBeGreaterThan(0);
    expect(result.relatedDocuments.map((document) => document.documentId)).not.toContain('doc-tag-only');
    expect(result.relatedDocuments.map((document) => document.documentId)).not.toContain('doc-mentioned');
    expect(result.relatedTags).toContainEqual(
      expect.objectContaining({
        id: 'tag-ui',
        label: '#UI交互',
      }),
    );
  });

  test('derives similar blocks and suggested links for a focused outline item', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: 'WorkKnowlage 方案',
      tags: [{ id: 'tag-product', label: '#产品', tone: 'primary' }],
      outline: [{ id: 'heading-focus', title: '认知侧边栏', level: 1 }],
      sections: [
        { id: 'heading-focus', type: 'heading', title: '认知侧边栏' },
        { id: 'paragraph-focus', type: 'paragraph', content: '目录、上下文和关联卡片保持稳定联动' },
      ],
    });

    const similarDocument = buildDocument({
      id: 'doc-similar',
      title: '图谱侧栏方案',
      tags: [{ id: 'tag-graph', label: '#图谱', tone: 'neutral' }],
      sections: [
        { id: 'block-similar', type: 'paragraph', content: '关联卡片与上下文卡片应该保持稳定联动' },
      ],
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, similarDocument],
      folders,
      focusedOutlineItem: activeDocument.outline[0],
    });

    expect(result.similarBlocks).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-similar',
        blockId: 'block-similar',
      }),
    );
    expect(result.suggestedLinks).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-similar',
        blockId: 'block-similar',
      }),
    );
  });

  test('ignores short label style overlaps when a document also contains longer unrelated body text', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '任务系统方案',
      sections: [
        {
          id: 'paragraph-active',
          type: 'paragraph',
          content: '任务登记弹窗需要支持状态回写、责任人校验和批量提交。',
        },
      ],
    });

    const misleadingDocument = buildDocument({
      id: 'doc-misleading',
      title: '卸船机操作规程',
      sections: [
        { id: 'paragraph-short-label', type: 'paragraph', content: '任务登记弹窗' },
        {
          id: 'paragraph-unrelated',
          type: 'paragraph',
          content: '卸船机默认状态切换后，需要重新确认电流阈值和机械臂轨迹。',
        },
      ],
    });

    const trulySimilarDocument = buildDocument({
      id: 'doc-similar',
      title: '任务执行流程',
      sections: [
        {
          id: 'paragraph-similar',
          type: 'paragraph',
          content: '任务登记弹窗应支持责任人校验、状态回写以及批量提交确认。',
        },
      ],
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, misleadingDocument, trulySimilarDocument],
      folders,
    });

    expect(result.relatedDocuments.map((document) => document.documentId)).toContain('doc-similar');
    expect(result.relatedDocuments.map((document) => document.documentId)).not.toContain('doc-misleading');
  });

  test('derives text evidence for short phrases inside long target paragraphs without promoting them to related topics', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '测试文档',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'phrase-product-route',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '公司坚定不移践行产品化路线', styles: {} }],
          children: [],
        },
        {
          id: 'phrase-series',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '六大产品系列', styles: {} }],
          children: [],
        },
      ]),
    });

    const targetDocument = buildDocument({
      id: 'doc-target',
      title: '问题清单宣贯稿内容',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'long-context',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text:
                '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。当前现场问题、优化建议及新需求主要通过线下沟通或零散文档记录。为了支撑调试岗位建设，系统还需要覆盖责任分配、状态回写、统计口径、跨设备复盘、会议跟踪、验收反馈、历史问题归档、处理时效分析、责任人协同、版本追踪、流程宣贯和数据复用等多个管理环节。',
              styles: {},
            },
          ],
          children: [],
        },
      ]),
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, targetDocument],
      folders,
    });

    expect(result.relatedDocuments.map((document) => document.documentId)).not.toContain('doc-target');
    expect(result.textEvidence).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-target',
        blockId: 'long-context',
        matchedText: '公司坚定不移践行产品化路线',
        reason: expect.stringContaining('关键句'),
      }),
    );
  });

  test('keeps text evidence when a document is also a related topic and dedupes the wiki count', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '知识关联侧栏',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-context',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板需要展示被引用、被提及和相似内容。', styles: {} }],
          children: [],
        },
        {
          id: 'phrase-product-route',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '公司坚定不移践行产品化路线', styles: {} }],
          children: [],
        },
      ]),
    });

    const targetDocument = buildDocument({
      id: 'doc-target',
      title: '问题清单宣贯稿内容',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-match',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板应该展示被引用和被提及的内容。', styles: {} }],
          children: [],
        },
        {
          id: 'long-context',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text:
                '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。当前现场问题、优化建议及新需求主要通过线下沟通或零散文档记录。为了支撑调试岗位建设，系统还需要覆盖责任分配、状态回写、统计口径、跨设备复盘、会议跟踪、验收反馈、历史问题归档、处理时效分析、责任人协同、版本追踪、流程宣贯和数据复用等多个管理环节。',
              styles: {},
            },
          ],
          children: [],
        },
      ]),
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, targetDocument],
      folders,
    });

    expect(result.relatedDocuments).toContainEqual(
      expect.objectContaining({ documentId: 'doc-target' }),
    );
    expect(result.textEvidence).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-target',
        matchedText: '公司坚定不移践行产品化路线',
      }),
    );
    expect(result.summary.wikiAssociationCount).toBe(1);
  });

  test('aggregates semantic and text evidence under one associated document', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '知识关联侧栏',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-context',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板需要展示被引用、被提及和相似内容。', styles: {} }],
          children: [],
        },
        {
          id: 'phrase-product-route',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '公司坚定不移践行产品化路线', styles: {} }],
          children: [],
        },
      ]),
    });

    const targetDocument = buildDocument({
      id: 'doc-target',
      title: '问题清单宣贯稿内容',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-match',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板应该展示被引用和被提及的内容。', styles: {} }],
          children: [],
        },
        {
          id: 'long-context',
          type: 'paragraph',
          props: {},
          content: [
            {
              type: 'text',
              text:
                '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。当前现场问题、优化建议及新需求主要通过线下沟通或零散文档记录。为了支撑调试岗位建设，系统还需要覆盖责任分配、状态回写、统计口径、跨设备复盘、会议跟踪、验收反馈、历史问题归档、处理时效分析、责任人协同、版本追踪、流程宣贯和数据复用等多个管理环节。',
              styles: {},
            },
          ],
          children: [],
        },
      ]),
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, targetDocument],
      folders,
    });

    expect(result.associatedDocuments).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-target',
        title: '问题清单宣贯稿内容',
        badges: expect.arrayContaining(['主题相似', '原文命中']),
        recommendationReason: '命中关键句',
        evidenceStrength: 'high',
        similarityEvidence: expect.arrayContaining([
          expect.objectContaining({ blockId: 'semantic-match' }),
        ]),
        textEvidence: expect.arrayContaining([
          expect.objectContaining({ matchedText: '公司坚定不移践行产品化路线' }),
        ]),
      }),
    );
    expect(result.associatedDocuments.filter((document) => document.documentId === 'doc-target')).toHaveLength(1);
    expect(result.summary.wikiAssociationCount).toBe(1);
  });

  test('detects original text evidence from BlockNote list items', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '测试文档',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'phrase-plc-point',
          type: 'numberedListItem',
          props: {},
          content: [{ type: 'text', text: 'LC 点位是否正确', styles: {} }],
          children: [],
        },
        {
          id: 'phrase-device-action',
          type: 'checkListItem',
          props: {},
          content: [{ type: 'text', text: '设备动作是否正常', styles: {} }],
          children: [],
        },
      ]),
    });

    const targetDocument = buildDocument({
      id: 'doc-target',
      title: '无标题文档',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'target-plc-point',
          type: 'numberedListItem',
          props: {},
          content: [{ type: 'text', text: 'PLC 点位是否正确', styles: {} }],
          children: [],
        },
        {
          id: 'target-device-action',
          type: 'checkListItem',
          props: {},
          content: [{ type: 'text', text: '设备动作是否正常', styles: {} }],
          children: [],
        },
      ]),
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, targetDocument],
      folders,
    });

    expect(result.textEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-target',
          blockId: 'target-plc-point',
          matchedText: 'LC 点位是否正确',
        }),
        expect.objectContaining({
          documentId: 'doc-target',
          blockId: 'target-device-action',
          matchedText: '设备动作是否正常',
        }),
      ]),
    );
    expect(result.associatedDocuments).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-target',
        title: '无标题文档',
        badges: ['原文命中'],
        recommendationReason: '2 条原文线索',
        evidenceStrength: 'high',
        textEvidence: expect.arrayContaining([
          expect.objectContaining({ matchedText: 'LC 点位是否正确' }),
          expect.objectContaining({ matchedText: '设备动作是否正常' }),
        ]),
      }),
    );
  });

  test('explains topic-only associated documents with low evidence strength', () => {
    const activeDocument = buildDocument({
      id: 'doc-active',
      title: '知识关联侧栏',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-context',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板需要展示被引用、被提及和相似内容。', styles: {} }],
          children: [],
        },
      ]),
    });

    const targetDocument = buildDocument({
      id: 'doc-target',
      title: '关系图方案',
      sections: [],
      contentJson: JSON.stringify([
        {
          id: 'semantic-match',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '知识库语义面板应该展示被引用和被提及的内容。', styles: {} }],
          children: [],
        },
      ]),
    });

    const result = deriveSidebarAssociations({
      activeDocument,
      documents: [activeDocument, targetDocument],
      folders,
    });

    expect(result.associatedDocuments).toContainEqual(
      expect.objectContaining({
        documentId: 'doc-target',
        badges: ['主题相似'],
        recommendationReason: '主题相似',
        evidenceStrength: 'low',
      }),
    );
  });

  test('returns stable empty arrays when no active document or matches exist', () => {
    expect(
      deriveSidebarAssociations({
        activeDocument: null,
        documents: [],
        folders,
      }),
    ).toEqual({
      relatedDocuments: [],
      relatedTags: [],
      similarBlocks: [],
      suggestedLinks: [],
      textEvidence: [],
      associatedDocuments: [],
      summary: {
        wikiAssociationCount: 0,
      },
    });

    const activeDocument = buildDocument({
      id: 'doc-lone',
      title: '孤立文档',
      sections: [{ id: 'paragraph', type: 'paragraph', content: '独立内容' }],
    });

    expect(
      deriveSidebarAssociations({
        activeDocument,
        documents: [activeDocument],
        folders,
      }),
    ).toEqual({
      relatedDocuments: [],
      relatedTags: [],
      similarBlocks: [],
      suggestedLinks: [],
      textEvidence: [],
      associatedDocuments: [],
      summary: {
        wikiAssociationCount: 0,
      },
    });
  });
});
