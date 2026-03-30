import { describe, expect, test } from 'vitest';
import { sanitizeFileName, toMarkdownFromBlocks, toPrintHtmlDocumentFromBlocks, toPrintHtmlFromBlocks } from './exportUtils';

describe('exportUtils', () => {
  test('sanitizes export file names', () => {
    expect(sanitizeFileName('  项目/导出:草稿  ')).toBe('项目-导出-草稿');
  });

  test('renders markdown for headings, tables, and attachments', () => {
    const markdown = toMarkdownFromBlocks([
      {
        id: 'heading-1',
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: '导出标题', styles: {} }],
        children: [],
      },
      {
        id: 'attachment-1',
        type: 'kbAttachment',
        props: {
          name: '示例附件',
          url: '/uploads/example.png',
        },
        children: [],
      },
      {
        id: 'table-1',
        type: 'richTable',
        props: {
          data: JSON.stringify({
            content: [
              {
                type: 'table',
                content: [
                  {
                    type: 'tableRow',
                    content: [
                      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A', styles: {} }] }] },
                      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B', styles: {} }] }] },
                    ],
                  },
                  {
                    type: 'tableRow',
                    content: [
                      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1', styles: {} }] }] },
                      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2', styles: {} }] }] },
                    ],
                  },
                ],
              },
            ],
          }),
        },
        children: [],
      },
    ]);

    expect(markdown).toContain('## 导出标题');
    expect(markdown).toContain('[示例附件](/uploads/example.png)');
    expect(markdown).toContain('| A | B |');
  });

  test('renders printable html for alerts and images', () => {
    const html = toPrintHtmlFromBlocks([
      {
        id: 'alert-1',
        type: 'alert',
        props: { type: 'warning' },
        content: [{ type: 'text', text: '提醒内容', styles: {} }],
        children: [],
      },
      {
        id: 'image-1',
        type: 'image',
        props: {
          url: 'https://example.com/demo.png',
          caption: '远程图片',
        },
        children: [],
      },
    ]);

    expect(html).toContain('kb-export-alert');
    expect(html).toContain('<img src="https://example.com/demo.png" alt="远程图片" />');
    expect(html).toContain('<figcaption>远程图片</figcaption>');
  });

  test('builds a printable html document that preserves inline formatting', () => {
    const html = toPrintHtmlDocumentFromBlocks([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: '粗体', styles: { bold: true } },
          { type: 'text', text: ' 与 ', styles: {} },
          { type: 'text', text: '代码', styles: { code: true } },
          { type: 'text', text: ' ', styles: {} },
          { type: 'docMention', props: { title: '关联文档' } },
          {
            type: 'link',
            attrs: { href: 'https://example.com' },
            content: [{ type: 'text', text: '查看详情', styles: {} }],
          },
        ],
        children: [],
      },
      {
        id: 'alert-1',
        type: 'alert',
        props: { type: 'warning' },
        content: [{ type: 'text', text: '提醒内容', styles: { bold: true } }],
        children: [],
      },
    ], '导出测试');

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('<code>代码</code>');
    expect(html).toContain('class="kb-doc-mention">@关联文档</span>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">查看详情</a>');
    expect(html).toContain('kb-export-alert-warning');
    expect(html).toContain('.kb-export-alert-warning');
  });
});
