import { describe, expect, test } from 'vitest';
import { fromDocumentToInitialBlocks, serializeEditorDocument } from './blockAdapter';

describe('blockAdapter', () => {
  test('prefers persisted contentJson when available', () => {
    const contentJson = JSON.stringify([
      {
        id: 'heading-1',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '来自 BlockNote', styles: {} }],
        children: [],
      },
    ]);

    const blocks = fromDocumentToInitialBlocks({
      contentJson,
      sections: [
        { id: 'legacy-heading', type: 'heading', title: '旧内容' },
      ],
    });

    expect(blocks).toEqual(JSON.parse(contentJson));
  });

  test('falls back to legacy sections when contentJson is empty', () => {
    const blocks = fromDocumentToInitialBlocks({
      contentJson: '[]',
      sections: [
        { id: 'section-heading', type: 'heading', title: '1. 旧标题' },
        { id: 'section-paragraph', type: 'paragraph', content: '旧段落' },
        { id: 'section-list', type: 'bullet-list', items: ['A', 'B'] },
      ],
    });

    expect(blocks).toEqual([
      {
        id: 'section-heading',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '1. 旧标题', styles: {} }],
        children: [],
      },
      {
        id: 'section-paragraph',
        type: 'paragraph',
        content: [{ type: 'text', text: '旧段落', styles: {} }],
        children: [],
      },
      {
        id: 'section-list-item-0',
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'A', styles: {} }],
        children: [],
      },
      {
        id: 'section-list-item-1',
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'B', styles: {} }],
        children: [],
      },
    ]);
  });

  test('returns a minimal empty paragraph document for brand-new docs', () => {
    expect(
      fromDocumentToInitialBlocks({
        contentJson: '',
        sections: [],
      })
    ).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '', styles: {} }],
      },
    ]);
  });

  test('serializes editor blocks without dropping custom blocks', () => {
    const blocks = [
      {
        id: 'alert-1',
        type: 'alert',
        props: { type: 'warning' },
        content: [{ type: 'text', text: '注意', styles: {} }],
        children: [],
      },
      {
        id: 'table-1',
        type: 'richTable',
        props: {
          data: '{"type":"doc","content":[]}',
        },
      },
    ];

    expect(serializeEditorDocument(blocks)).toBe(JSON.stringify(blocks));
  });
});
