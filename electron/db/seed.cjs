/**
 * Seeds the database with initial data (mirrors the old mock workspace.ts).
 * Only runs on first launch when tables are empty.
 */
const { rebuildBacklinksForSpace } = require('./repositories/backlinks.cjs');

function seedDatabase(db) {
  const insertSpace = db.prepare(
    'INSERT INTO spaces (id, name, label) VALUES (?, ?, ?)'
  );
  const insertFolder = db.prepare(
    'INSERT INTO folders (id, space_id, parent_id, name, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const insertDoc = db.prepare(
    'INSERT INTO documents (id, space_id, folder_id, title, content_json, word_count, badge_label) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertTag = db.prepare(
    'INSERT OR IGNORE INTO tags (id, label, tone) VALUES (?, ?, ?)'
  );
  const insertDocTag = db.prepare(
    'INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)'
  );
  const seedAll = db.transaction(() => {
    // Space
    insertSpace.run('personal-workspace', '个人工作空间', 'WORKSPACE');

    // Folders
    insertFolder.run('folder-inspiration', 'personal-workspace', null, '灵感库', 0);
    insertFolder.run('folder-plan-2024', 'personal-workspace', null, '2024计划', 1);

    // Document 1: 创意草案
    const doc1Sections = JSON.stringify([
      { id: 'section-core-goal', type: 'heading', title: '1. 核心目标' },
      {
        id: 'section-core-copy',
        type: 'paragraph',
        content:
          '我们的目标是建立一个能够通过简单的文本界面捕捉所有复杂想法的系统。这个系统必须是非线性的，允许用户通过双向链接在概念之间自由穿梭。',
      },
      {
        id: 'section-quote',
        type: 'quote',
        content: '伟大的设计不在于增加了什么，而在于减少了什么直到无法再减。',
        caption: '某位著名的数字建筑师',
      },
      { id: 'section-tech-arch', type: 'heading', title: '2. 技术架构' },
      {
        id: 'section-tech-copy',
        type: 'paragraph',
        content:
          '基于本地文件系统的 SQLite 缓存层。我们将所有的 Markdown 文件视为原始数据，同时在内存中维护一个复杂的实体关系图。',
      },
      {
        id: 'section-tech-list',
        type: 'bullet-list',
        items: ['实时 Markdown 解析与渲染', '毫秒级的全局模糊搜索', '离线优先的冲突解决机制'],
      },
      { id: 'section-gallery', type: 'gallery', items: ['架构灵感图', '工作台参考'] },
    ]);
    insertDoc.run('doc-creative-draft', 'personal-workspace', 'folder-inspiration', '创意草案', doc1Sections, 1240, '产品构思');

    // Document 2: 架构设计
    const doc2Sections = JSON.stringify([
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
          { type: 'text', text: '将空间导航、文稿主体和信息辅助拆分为三个独立但联动的工作区，并回链到 ', styles: {} },
          {
            type: 'docMention',
            props: {
              documentId: 'doc-creative-draft',
              title: '创意草案',
            },
          },
          { type: 'text', text: ' 中定义的核心目标。', styles: {} },
        ],
        children: [],
      },
    ]);
    insertDoc.run('doc-architecture-design', 'personal-workspace', 'folder-inspiration', '架构设计', doc2Sections, 860, '技术方案');

    // Tags
    insertTag.run('tag-product', '#产品', 'primary');
    insertTag.run('tag-idea', '#构思', 'neutral');
    insertTag.run('tag-2024', '#2024', 'neutral');
    insertTag.run('tag-architecture', '#架构', 'neutral');
    insertTag.run('tag-important', '#重要', 'neutral');
    insertTag.run('tag-electron', '#Electron', 'neutral');

    // Document <-> Tags
    insertDocTag.run('doc-creative-draft', 'tag-product');
    insertDocTag.run('doc-creative-draft', 'tag-idea');
    insertDocTag.run('doc-creative-draft', 'tag-2024');
    insertDocTag.run('doc-creative-draft', 'tag-architecture');
    insertDocTag.run('doc-creative-draft', 'tag-important');
    insertDocTag.run('doc-architecture-design', 'tag-architecture');
    insertDocTag.run('doc-architecture-design', 'tag-electron');
    rebuildBacklinksForSpace('personal-workspace', db);
  });

  seedAll();
}

module.exports = { seedDatabase };
