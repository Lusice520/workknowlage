/// <reference types="node" />
// @vitest-environment node

import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  getContentJsonStorageKind,
  migrateLegacyContentJsonToBlocks,
} = require('../../electron/db/documentContent.cjs') as {
  getContentJsonStorageKind: (contentJson: string) => 'empty' | 'legacy-sections' | 'blocks';
  migrateLegacyContentJsonToBlocks: (contentJson: string) => string;
};

describe('electron document content migration', () => {
  test('classifies empty, legacy, and modern content_json shapes', () => {
    expect(getContentJsonStorageKind('[]')).toBe('empty');
    expect(getContentJsonStorageKind(JSON.stringify([{ id: 'legacy', type: 'paragraph', content: '旧段落' }]))).toBe('legacy-sections');
    expect(
      getContentJsonStorageKind(
        JSON.stringify([
          {
            id: 'modern',
            type: 'paragraph',
            content: [{ type: 'text', text: '现代段落', styles: {} }],
            children: [],
          },
        ]),
      ),
    ).toBe('blocks');
  });

  test('migrates legacy section-like content_json to block content', () => {
    const legacySections = [
      { id: 'legacy-heading', type: 'heading', title: '1. 旧标题' },
      { id: 'legacy-paragraph', type: 'paragraph', content: '旧段落内容' },
      { id: 'legacy-list', type: 'bullet-list', items: ['A', 'B'] },
    ];

    expect(JSON.parse(migrateLegacyContentJsonToBlocks(JSON.stringify(legacySections)))).toEqual([
      {
        id: 'legacy-heading',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '1. 旧标题', styles: {} }],
        children: [],
      },
      {
        id: 'legacy-paragraph',
        type: 'paragraph',
        content: [{ type: 'text', text: '旧段落内容', styles: {} }],
        children: [],
      },
      {
        id: 'legacy-list-item-0',
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'A', styles: {} }],
        children: [],
      },
      {
        id: 'legacy-list-item-1',
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'B', styles: {} }],
        children: [],
      },
    ]);
  });

  test('keeps modern block content_json unchanged', () => {
    const modernBlocks = [
      {
        id: 'modern-heading',
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: '现代标题', styles: {} }],
        children: [],
      },
      {
        id: 'modern-paragraph',
        type: 'paragraph',
        props: { textAlignment: 'left' },
        content: [{ type: 'text', text: '现代块内容', styles: {} }],
        children: [],
      },
    ];

    expect(JSON.parse(migrateLegacyContentJsonToBlocks(JSON.stringify(modernBlocks)))).toEqual(modernBlocks);
  });
});
