import type { WorkspaceSeed } from '../types/workspace';

const creativeDraftSections = [
  {
    id: 'section-core-goal',
    type: 'heading' as const,
    title: '1. 核心目标',
  },
  {
    id: 'section-core-copy',
    type: 'paragraph' as const,
    content:
      '我们的目标是建立一个能够通过简单的文本界面捕捉所有复杂想法的系统。这个系统必须是非线性的，允许用户通过双向链接在概念之间自由穿梭。',
  },
  {
    id: 'section-quote',
    type: 'quote' as const,
    content: '伟大的设计不在于增加了什么，而在于减少了什么直到无法再减。',
    caption: '某位著名的数字建筑师',
  },
  {
    id: 'section-tech-arch',
    type: 'heading' as const,
    title: '2. 技术架构',
  },
  {
    id: 'section-tech-copy',
    type: 'paragraph' as const,
    content:
      '基于本地文件系统的 SQLite 缓存层。我们将所有的 Markdown 文件视为原始数据，同时在内存中维护一个复杂的实体关系图。',
  },
  {
    id: 'section-tech-list',
    type: 'bullet-list' as const,
    items: ['实时 Markdown 解析与渲染', '毫秒级的全局模糊搜索', '离线优先的冲突解决机制'],
  },
  {
    id: 'section-gallery',
    type: 'gallery' as const,
    items: ['架构灵感图', '工作台参考'],
  },
];

const architectureDesignBlocks = [
  {
    id: 'section-arch-heading',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: '1. 三栏布局', styles: {} }],
    children: [],
  },
  {
    id: 'section-arch-copy',
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: '将空间导航、文稿主体和信息辅助拆分为三个独立但联动的工作区。延伸阅读：',
        styles: {},
      },
      {
        type: 'docMention',
        props: {
          documentId: 'doc-creative-draft',
          title: '创意草案',
        },
      },
      { type: 'text', text: '。', styles: {} },
    ],
    children: [],
  },
];

export const workspaceSeed: WorkspaceSeed = {
  spaces: [
    {
      id: 'personal-workspace',
      name: '个人工作空间',
      label: 'WORKSPACE',
    },
  ],
  quickLinks: [
    { id: 'all-notes', label: '所有笔记' },
    { id: 'favorites', label: '收藏夹' },
  ],
  folders: [
    {
      id: 'folder-inspiration',
      spaceId: 'personal-workspace',
      parentId: null,
      name: '灵感库',
    },
    {
      id: 'folder-plan-2024',
      spaceId: 'personal-workspace',
      parentId: null,
      name: '2024计划',
    },
  ],
  documents: [
    {
      id: 'doc-creative-draft',
      spaceId: 'personal-workspace',
      folderId: 'folder-inspiration',
      title: '创意草案',
      contentJson: JSON.stringify(creativeDraftSections),
      updatedAt: '2026-03-28T09:00:00.000Z',
      updatedAtLabel: '2024年3月15日',
      wordCountLabel: '1,240 字',
      badgeLabel: '产品构思',
      outline: [
        { id: 'outline-core-goal', title: '核心目标', level: 1 },
        { id: 'outline-tech-arch', title: '技术架构', level: 1 },
        { id: 'outline-two-way-link', title: '双向链接实现', level: 2 },
        { id: 'outline-next-plan', title: '下一步计划', level: 1 },
      ],
      tags: [
        { id: 'tag-product', label: '#产品', tone: 'primary' },
        { id: 'tag-idea', label: '#构思', tone: 'neutral' },
        { id: 'tag-2024', label: '#2024', tone: 'neutral' },
        { id: 'tag-architecture', label: '#架构', tone: 'neutral' },
        { id: 'tag-important', label: '#重要', tone: 'neutral' },
      ],
      backlinks: [
        {
          id: 'backlink-roadmap',
          sourceDocumentId: 'doc-architecture-design',
          title: '2024年路线图',
          description: '提到：关于「创意草案」中提到的技术构想...',
        },
      ],
      sections: creativeDraftSections,
      isFavorite: false,
    },
    {
      id: 'doc-architecture-design',
      spaceId: 'personal-workspace',
      folderId: 'folder-inspiration',
      title: '架构设计',
      contentJson: JSON.stringify(architectureDesignBlocks),
      updatedAt: '2026-03-27T09:00:00.000Z',
      updatedAtLabel: '2024年3月13日',
      wordCountLabel: '860 字',
      badgeLabel: '技术方案',
      outline: [
        { id: 'outline-layout', title: '三栏布局', level: 1 },
        { id: 'outline-storage', title: '本地存储', level: 1 },
      ],
      tags: [
        { id: 'tag-arch', label: '#架构', tone: 'primary' },
        { id: 'tag-electron', label: '#Electron', tone: 'neutral' },
      ],
      backlinks: [],
      sections: [
        { id: 'section-arch-heading', type: 'heading', title: '1. 三栏布局' },
        {
          id: 'section-arch-copy',
          type: 'paragraph',
          content: '将空间导航、文稿主体和信息辅助拆分为三个独立但联动的工作区。延伸阅读：@创意草案。',
        },
      ],
      isFavorite: false,
    },
  ],
};
