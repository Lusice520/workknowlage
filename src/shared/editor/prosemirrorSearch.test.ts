import { Schema } from '@tiptap/pm/model';
import { describe, expect, test } from 'vitest';
import { createProseMirrorSearchDecorations, findProseMirrorMatches } from './prosemirrorSearch';

const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    text: {},
  },
});

const createDoc = (text: string) => testSchema.node('doc', null, [
  testSchema.node('paragraph', null, [testSchema.text(text)]),
]);

describe('findProseMirrorMatches', () => {
  test('finds ordered case-insensitive match ranges inside a document', () => {
    const doc = createDoc('Alpha beta alpha gamma');

    expect(findProseMirrorMatches(doc, 'alpha')).toEqual([
      { from: 1, to: 6, text: 'Alpha' },
      { from: 12, to: 17, text: 'alpha' },
    ]);
  });

  test('returns multiple distinct matches from one text block', () => {
    const doc = createDoc('echo echo echo');

    expect(findProseMirrorMatches(doc, 'echo')).toEqual([
      { from: 1, to: 5, text: 'echo' },
      { from: 6, to: 10, text: 'echo' },
      { from: 11, to: 15, text: 'echo' },
    ]);
  });

  test('returns no matches for an empty query', () => {
    expect(findProseMirrorMatches(createDoc('anything'), '   ')).toEqual([]);
  });
});

describe('createProseMirrorSearchDecorations', () => {
  test('marks passive and active matches with distinct classes', () => {
    const doc = createDoc('Alpha beta alpha');
    const matches = findProseMirrorMatches(doc, 'alpha');
    const decorations = createProseMirrorSearchDecorations(doc, matches, 1, {
      matchClass: 'wk-search-match',
      activeMatchClass: 'wk-search-match-active',
    });

    const entries = decorations.find();

    expect(entries).toHaveLength(2);
    expect(entries.map((entry: any) => entry.type.attrs.class)).toEqual([
      'wk-search-match',
      'wk-search-match wk-search-match-active',
    ]);
  });
});
