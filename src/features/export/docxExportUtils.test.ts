import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { buildDocxBlobFromBlocks, buildDocxBytesFromBlocks } from './docxExportUtils';

describe('docxExportUtils', () => {
  test('builds a non-empty docx blob for exported blocks', async () => {
    const blob = await buildDocxBlobFromBlocks([
      {
        id: 'heading-1',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Word 导出', styles: {} }],
        children: [],
      },
      {
        id: 'attachment-1',
        type: 'kbAttachment',
        props: {
          name: '示例图片',
          url: 'https://example.com/demo.png',
          isImage: true,
        },
        children: [],
      },
    ], {
      title: 'Word 导出',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(0);
  });

  test('builds DOCX zip bytes for exported blocks', async () => {
    const bytes = await buildDocxBytesFromBlocks([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '可打开的 Word 文档', styles: { bold: true } }],
        children: [],
      },
    ], {
      title: 'Word 导出',
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(4);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  test('writes a stable Chinese font into DOCX styles and text runs', async () => {
    const bytes = await buildDocxBytesFromBlocks([
      {
        id: 'heading-1',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '一、项目核心成员情况', styles: { bold: true } }],
        children: [],
      },
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '公司现有产研中心人员 16 人。', styles: {} }],
        children: [],
      },
    ], {
      title: '字体导出',
    });

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const stylesXml = await zip.file('word/styles.xml')?.async('string');

    expect(documentXml).toBeTruthy();
    expect(stylesXml).toBeTruthy();
    expect(stylesXml).toContain('w:eastAsia="Microsoft YaHei"');
    expect(documentXml).toContain('w:eastAsia="Microsoft YaHei"');
    expect(`${stylesXml}\n${documentXml}`).not.toContain('PingFang SC');
  });

  test('normalizes editor color tokens before writing docx colors', async () => {
    const bytes = await buildDocxBytesFromBlocks([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: '红色文本', styles: { textColor: 'red' } }],
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
                      {
                        type: 'tableHeader',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: '表头' }] }],
                      },
                    ],
                  },
                  {
                    type: 'tableRow',
                    content: [
                      {
                        type: 'tableCell',
                        attrs: { textColor: 'blue', backgroundColor: 'yellow' },
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: '表格颜色' }] }],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        },
        children: [],
      },
    ], {
      title: '颜色导出',
    });

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    expect(documentXml).toBeTruthy();
    expect(documentXml).toContain('w:val="E03E3E"');
    expect(documentXml).toContain('w:val="2F6FDD"');
    expect(documentXml).toContain('w:fill="FBF3DB"');
    expect(documentXml).not.toContain('w:val="red"');
    expect(documentXml).not.toContain('w:fill="yellow"');
  });

  test('does not force black shading onto rich table body cells without background colors', async () => {
    const bytes = await buildDocxBytesFromBlocks([
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
                      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '列 1' }] }] },
                      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '列 2' }] }] },
                    ],
                  },
                  {
                    type: 'tableRow',
                    content: [
                      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '普通单元格 A' }] }] },
                      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '普通单元格 B' }] }] },
                    ],
                  },
                ],
              },
            ],
          }),
        },
        children: [],
      },
    ], {
      title: 'Word 导出',
    });

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    expect(documentXml).toBeTruthy();
    expect(documentXml?.match(/<w:shd\b/g)?.length ?? 0).toBe(2);
    expect(documentXml).not.toContain('w:fill="auto"');
    expect(documentXml).not.toContain('w:fill="000000"');
  });

  test('exports ordered, bullet, and checklist blocks as native Word numbering instead of text prefixes', async () => {
    const bytes = await buildDocxBytesFromBlocks([
      {
        id: 'ordered-1',
        type: 'numberedListItem',
        props: {},
        content: [{ type: 'text', text: '有序项', styles: {} }],
        children: [],
      },
      {
        id: 'ordered-2',
        type: 'numberedListItem',
        props: {},
        content: [{ type: 'text', text: '第二项', styles: {} }],
        children: [],
      },
      {
        id: 'bullet-1',
        type: 'bulletListItem',
        props: {},
        content: [{ type: 'text', text: '无序项', styles: {} }],
        children: [],
      },
      {
        id: 'check-1',
        type: 'checkListItem',
        props: { checked: false },
        content: [{ type: 'text', text: '待办项', styles: {} }],
        children: [],
      },
      {
        id: 'check-2',
        type: 'checkListItem',
        props: { checked: true },
        content: [{ type: 'text', text: '已完成项', styles: {} }],
        children: [],
      },
    ], {
      title: '列表导出',
    });

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const numberingXml = await zip.file('word/numbering.xml')?.async('string');

    expect(documentXml).toBeTruthy();
    expect(numberingXml).toBeTruthy();
    expect(documentXml).toContain('<w:numPr>');
    expect(documentXml).not.toContain('1. 有序项');
    expect(documentXml).not.toContain('• 无序项');
    expect(documentXml).not.toContain('[ ] 待办项');
    expect(documentXml).not.toContain('[x] 已完成项');
    expect(numberingXml).toContain('☐');
    expect(numberingXml).toContain('☑');
    expect(numberingXml).toContain('decimal');
    expect(numberingXml).toContain('bullet');
  });
});
