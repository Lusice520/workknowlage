/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildShareHtml } = require('./render.cjs');

test('renders spreadsheet documents as read-only shared tables', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '预算表',
      kind: 'spreadsheet',
      updatedAtLabel: '刚刚',
    },
    spreadsheetWorkbookJson: JSON.stringify({
      sheetOrder: ['sheet-1'],
      sheets: {
        'sheet-1': {
          name: 'Sheet1',
          cellData: {
            0: {
              0: { v: '项目' },
              1: { v: '金额' },
            },
            1: {
              0: { v: '设计' },
              1: { v: 1200 },
            },
          },
        },
      },
    }),
  });

  expect(html).toContain('预算表 - WorkKnowlage');
  expect(html).toContain('<span class="pill">#表格</span>');
  expect(html).toContain('share-spreadsheet-table');
  expect(html).toContain('<td>项目</td>');
  expect(html).toContain('<td>1200</td>');
});

test('renders native BlockNote tables in shared html', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '原生表格分享',
      contentJson: JSON.stringify([
        {
          id: 'table-native-1',
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            headerRows: 1,
            rows: [
              {
                cells: [
                  {
                    type: 'tableCell',
                    props: {
                      backgroundColor: 'default',
                      textColor: 'default',
                      textAlignment: 'left',
                      colspan: 1,
                      rowspan: 1,
                    },
                    content: [{ type: 'text', text: '列 1', styles: {} }],
                  },
                  {
                    type: 'tableCell',
                    props: {
                      backgroundColor: 'default',
                      textColor: 'default',
                      textAlignment: 'left',
                      colspan: 1,
                      rowspan: 1,
                    },
                    content: [{ type: 'text', text: '列 2', styles: {} }],
                  },
                ],
              },
              {
                cells: [
                  {
                    type: 'tableCell',
                    props: {
                      backgroundColor: '#dbeafe',
                      textColor: '#1e3a8a',
                      textAlignment: 'center',
                      colspan: 1,
                      rowspan: 1,
                    },
                    content: [{ type: 'text', text: '值 A', styles: {} }],
                  },
                  {
                    type: 'tableCell',
                    props: {
                      backgroundColor: 'default',
                      textColor: 'default',
                      textAlignment: 'left',
                      colspan: 1,
                      rowspan: 1,
                    },
                    content: [{ type: 'text', text: '值 B', styles: {} }],
                  },
                ],
              },
            ],
          },
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('<table class="share-table">');
  expect(html).toContain('<th');
  expect(html).toContain('列 1');
  expect(html).toContain('值 A');
  expect(html).toContain('background-color:#dbeafe');
  expect(html).toContain('text-align:center');
  expect(html).not.toContain('background-color:default');
  expect(html).not.toContain('color:default');
});

test('renders shared alert blocks with editor-aligned status classes and icons', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '提醒块分享',
      contentJson: JSON.stringify([
        {
          id: 'alert-warning',
          type: 'alert',
          props: { type: 'warning' },
          content: [{ type: 'text', text: '警告内容', styles: {} }],
          children: [],
        },
        {
          id: 'alert-error',
          type: 'alert',
          props: { type: 'error' },
          content: [{ type: 'text', text: '错误内容', styles: {} }],
          children: [],
        },
        {
          id: 'alert-info',
          type: 'alert',
          props: { type: 'info' },
          content: [{ type: 'text', text: '提示内容', styles: {} }],
          children: [],
        },
        {
          id: 'alert-success',
          type: 'alert',
          props: { type: 'success' },
          content: [{ type: 'text', text: '成功内容', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('share-alert-warning');
  expect(html).toContain('share-alert-error');
  expect(html).toContain('share-alert-info');
  expect(html).toContain('share-alert-success');
  expect(html).toContain('<svg class="share-alert-icon"');
  expect(html).toContain('role="img" aria-label="警告"');
  expect(html).toContain('role="img" aria-label="错误"');
  expect(html).toContain('role="img" aria-label="提示"');
  expect(html).toContain('role="img" aria-label="成功"');
  expect(html).toContain('--share-alert-bg: #fff7df');
  expect(html).toContain('--share-alert-bg: #ffecec');
  expect(html).toContain('--share-alert-bg: #eef1ff');
  expect(html).toContain('--share-alert-bg: #ebffed');
  expect(html).not.toContain('aria-label="警告">⚠');
  expect(html).toContain('.share-alert-icon {');
  expect(html).toContain('margin-top: 2px;');
  expect(html).not.toContain('margin-top: 4px;');
});

test('preserves BlockNote line breaks inside shared quotes', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '引用换行测试',
      contentJson: JSON.stringify([
        {
          id: 'quote-1',
          type: 'quote',
          content: [{ type: 'text', text: '给这个项目写 PRD\n初始化需求文档体系\n给某个功能写 SPEC', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('<p>给这个项目写 PRD<br />初始化需求文档体系<br />给某个功能写 SPEC</p>');
});

test('keeps shared pages readable for long Chinese document titles', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: 'Q1：对于系统的测试工作到底是谁来进行，职责边界？因为在五一期间很明显登记的问题清单很大一部分是在重载测试过程中没有任何人关注',
      contentJson: JSON.stringify([
        {
          id: 'paragraph-1',
          type: 'paragraph',
          content: [{ type: 'text', text: '正文内容', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('font-size: clamp(24px, 2.2vw, 32px);');
  expect(html).toContain('line-height: 1.32;');
  expect(html).toContain('letter-spacing: 0;');
  expect(html).toContain('max-width: 1180px;');
  expect(html).not.toContain('font-size: clamp(30px, 6vw, 48px);');
  expect(html).not.toContain('letter-spacing: -0.05em;');
  expect(html).not.toContain('radial-gradient(circle at top left');
});

test('keeps the shared table of contents compact for long Chinese headings', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '目录测试',
      contentJson: JSON.stringify([
        {
          id: 'heading-1',
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Q1：对于系统的测试工作到底是谁来进行，职责边界？因为在五一期间很明显登记的问题清单很大一部分是在重载测试过程中没有任何人关注', styles: {} }],
          children: [],
        },
        {
          id: 'heading-2',
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: '问题分析', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('max-height: calc(100vh - 48px);');
  expect(html).toContain('overflow: auto;');
  expect(html).toContain('font-size: 12px;');
  expect(html).toContain('line-height: 1.55;');
  expect(html).toContain('overflow-wrap: anywhere;');
  expect(html).toContain('.share-toc-level-2 { padding-left: 12px; color: #64748b; }');
  expect(html).toContain('border-left: 1px solid var(--border);');
  expect(html).not.toContain('.share-toc { display: grid; gap: 8px; }');
});

test('uses a quiet document-reading layout instead of card-heavy glass styling', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '阅读布局测试',
      contentJson: JSON.stringify([
        {
          id: 'paragraph-1',
          type: 'paragraph',
          content: [{ type: 'text', text: '正文内容', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('width: min(calc(100vw - 56px), 1600px);');
  expect(html).toContain('grid-template-columns: minmax(0, 1180px) minmax(220px, 260px);');
  expect(html).toContain('justify-content: center;');
  expect(html).toContain('gap: clamp(32px, 2.4vw, 44px);');
  expect(html).toContain('padding: 38px clamp(40px, 3vw, 56px);');
  expect(html).toContain('max-width: none;');
  expect(html).toContain('font-size: 15px;');
  expect(html).toContain('line-height: 1.78;');
  expect(html).toContain('background: var(--bg);');
  expect(html).toContain('background: var(--paper);');
  expect(html).not.toContain('backdrop-filter: blur(20px);');
  expect(html).not.toContain('--card: rgba(255,255,255,0.88);');
});

test('colors ordered and unordered list markers like the editor document surface', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '列表颜色测试',
      contentJson: JSON.stringify([
        {
          id: 'ordered-1',
          type: 'numberedListItem',
          content: [{ type: 'text', text: '第一项', styles: {} }],
          children: [
            {
              id: 'ordered-child-code',
              type: 'codeBlock',
              props: { language: 'text' },
              content: [{ type: 'text', text: 'AGENTS.md\n  -> docs/agents/project-profile.md', styles: {} }],
              children: [],
            },
            {
              id: 'ordered-child-paragraph',
              type: 'paragraph',
              content: [{ type: 'text', text: '目的：', styles: {} }],
              children: [],
            },
            {
              id: 'ordered-child-1',
              type: 'bulletListItem',
              content: [{ type: 'text', text: '缩进要点', styles: {} }],
              children: [],
            },
          ],
        },
        {
          id: 'ordered-2',
          type: 'numberedListItem',
          content: [{ type: 'text', text: '第二项', styles: {} }],
          children: [],
        },
        {
          id: 'bullet-1',
          type: 'bulletListItem',
          content: [{ type: 'text', text: '要点', styles: {} }],
          children: [
            {
              id: 'bullet-child-ordered',
              type: 'numberedListItem',
              content: [{ type: 'text', text: '缩进数字', styles: {} }],
              children: [],
            },
          ],
        },
      ]),
    },
  });

  expect(html).toContain('--list-marker: #2563eb;');
  expect(html).not.toContain('--list-marker-muted');
  expect(html).toContain('--share-list-marker-column: 28px;');
  expect(html).toContain('--share-list-content-indent: var(--share-list-marker-column);');
  expect(html).toContain('--share-list-marker-center: calc(var(--share-list-marker-column) / 2);');
  expect(html).toContain('--share-list-marker-dot-size: 6px;');
  expect(html).not.toContain('--share-list-content-indent: 38px;');
  expect(html).not.toContain('--share-list-marker-size: 16px;');
  expect(html).toContain('list-style: none;');
  expect(html).toContain('.content .share-list-item::before');
  expect(html).toContain('.content ul > .share-list-item::before');
  expect(html).toContain('.content ol > .share-list-item::before');
  expect(html).toContain('content: counter(share-list-index) ".";');
  expect(html).toContain('left: calc(var(--share-list-marker-center) - (var(--share-list-marker-dot-size) / 2));');
  expect(html).toContain('width: var(--share-list-marker-dot-size);');
  expect(html).toContain('height: var(--share-list-marker-dot-size);');
  expect(html).toContain('background: var(--list-marker);');
  expect(html).toContain('border: 1px solid var(--list-marker);');
  expect(html).not.toContain('content: "•";');
  expect(html).not.toContain('content: "◦";');
  expect(html).not.toContain('content: "▪";');
  expect(html).not.toContain('.content li::marker');
  expect(html).not.toContain('::marker');
  expect(html).toContain('color: var(--list-marker);');
  expect(html).toContain('<ol>');
  expect(html).toContain('<ul>');
  expect(html).toContain('class="share-list-item share-list-item-with-children"');
  expect(html).toContain('<div class="share-block-children">');
  expect(html).toContain('.content .share-list-item > .share-block-children::before');
  expect(html).toContain('left: var(--share-list-marker-center);');
  expect(html).toContain('border-left: 1px solid #cbd5e1;');
  expect(html).not.toContain('.content li > ul,');
  expect(html).toMatch(/第一项[\s\S]*<div class="share-block-children">[\s\S]*share-code-block[\s\S]*目的：[\s\S]*<ul>[\s\S]*缩进要点/);
  expect(html).toMatch(/要点[\s\S]*<div class="share-block-children">[\s\S]*<ol>[\s\S]*缩进数字/);
  expect(html).toContain('AGENTS.md');
  expect(html).toContain('目的：');
  expect(html).toContain('缩进要点');
  expect(html).toContain('缩进数字');
});

test('renders BlockNote inline styles in shared html', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '富文本分享',
      contentJson: JSON.stringify([
        {
          id: 'paragraph-rich-1',
          type: 'paragraph',
          content: [
            { type: 'text', text: '粗体', styles: { bold: true } },
            { type: 'text', text: '斜体', styles: { italic: true } },
            { type: 'text', text: '下划线', styles: { underline: true } },
            { type: 'text', text: '删除线', styles: { strike: true } },
            { type: 'text', text: '代码', styles: { code: true } },
            { type: 'text', text: '蓝色', styles: { textColor: 'blue' } },
            { type: 'text', text: '高亮', styles: { backgroundColor: 'yellow' } },
            { type: 'docMention', props: { title: '关联文档' } },
            {
              type: 'link',
              href: 'https://example.com/details',
              content: [{ type: 'text', text: '查看详情', styles: { bold: true } }],
            },
          ],
          children: [],
        },
        {
          id: 'paragraph-rich-2',
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '富表格颜色标记',
              styles: {},
              marks: [{ type: 'rtTextColor', attrs: { color: '#1e3a8a' } }],
            },
          ],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('<strong>粗体</strong>');
  expect(html).toContain('<em>斜体</em>');
  expect(html).toContain('<u>下划线</u>');
  expect(html).toContain('<s>删除线</s>');
  expect(html).toContain('<code>代码</code>');
  expect(html).toContain('<span style="color:#2f6fdd">蓝色</span>');
  expect(html).toContain('<span style="background-color:#fbf3db">高亮</span>');
  expect(html).toContain('<span class="kb-doc-mention">@关联文档</span>');
  expect(html).toContain('<a href="https://example.com/details" target="_blank" rel="noreferrer"><strong>查看详情</strong></a>');
  expect(html).toContain('<span style="color:#1e3a8a">富表格颜色标记</span>');
  expect(html).toContain('.content code:not(.share-code-block code)');
  expect(html).toContain('background: rgba(241, 245, 249, 0.92);');
  expect(html).toContain('.content a {');
  expect(html).toContain('color: var(--accent);');
});

test('renders common BlockNote media and utility blocks in shared html', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '分享块覆盖',
      contentJson: JSON.stringify([
        {
          id: 'image-1',
          type: 'image',
          props: {
            url: '/uploads/doc-1/demo.png',
            caption: '示例图片',
          },
          children: [],
        },
        {
          id: 'check-1',
          type: 'checkListItem',
          props: { checked: true },
          content: [{ type: 'text', text: '完成项', styles: {} }],
          children: [],
        },
        {
          id: 'divider-1',
          type: 'divider',
          children: [],
        },
        {
          id: 'toggle-1',
          type: 'toggleListItem',
          content: [{ type: 'text', text: '折叠标题', styles: {} }],
          children: [
            {
              id: 'toggle-child-1',
              type: 'paragraph',
              content: [{ type: 'text', text: '折叠内容', styles: {} }],
              children: [],
            },
          ],
        },
      ]),
    },
  });

  expect(html).toContain('<figure class="share-image">');
  expect(html).toContain('<img src="http://127.0.0.1:8787/uploads/doc-1/demo.png" alt="示例图片" loading="lazy" />');
  expect(html).toContain('<figcaption>示例图片</figcaption>');
  expect(html).toContain('<ul class="share-check-list">');
  expect(html).toContain('<input type="checkbox" checked disabled />');
  expect(html).toContain('完成项');
  expect(html).toContain('<hr class="share-divider" />');
  expect(html).toContain('<details class="share-toggle" open>');
  expect(html).toContain('<summary>折叠标题</summary>');
  expect(html).toContain('折叠内容');
  expect(html).toContain('.share-image img');
  expect(html).toContain('.share-check-list input');
  expect(html).toContain('.share-divider');
  expect(html).toContain('.share-toggle summary');
});

test('renders BlockNote code blocks in shared html', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: '代码块分享',
      contentJson: JSON.stringify([
        {
          id: 'code-1',
          type: 'codeBlock',
          props: { language: 'typescript' },
          content: [{ type: 'text', text: 'const answer = 42 < 100;\\nconsole.log(answer);', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('<pre class="share-code-block"><code class="language-typescript" data-language="typescript">const answer = 42 &lt; 100;\\nconsole.log(answer);</code></pre>');
  expect(html).toContain('.share-code-block');
  expect(html).toContain('background: #f3f4f6;');
  expect(html).toContain('white-space: pre;');
  expect(html).not.toContain('/vendor/mermaid/');
});

test('renders Mermaid code blocks as diagrams in shared html', () => {
  const html = buildShareHtml({
    origin: 'http://127.0.0.1:8787',
    share: { enabled: true },
    document: {
      title: 'Mermaid 分享',
      contentJson: JSON.stringify([
        {
          id: 'mermaid-1',
          type: 'codeBlock',
          props: { language: 'mermaid' },
          content: [{ type: 'text', text: 'graph TD\nA[PRD] --> B[SPEC]', styles: {} }],
          children: [],
        },
      ]),
    },
  });

  expect(html).toContain('<figure class="share-mermaid" data-language="mermaid">');
  expect(html).toContain('<pre class="share-mermaid-source"><code class="language-mermaid" data-language="mermaid">graph TD\nA[PRD] --&gt; B[SPEC]</code></pre>');
  expect(html).toContain("import mermaid from '/vendor/mermaid/mermaid.esm.min.mjs';");
  expect(html).toContain("securityLevel: 'strict'");
  expect(html).toContain('window.__wkMermaidReady = true;');
  expect(html).toContain('.share-mermaid[data-rendered="true"] .share-mermaid-source');
});
