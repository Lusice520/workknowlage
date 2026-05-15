import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { afterEach, describe, expect, test } from 'vitest';
import { buildDefaultRichTableDoc } from './richTableLayout';
import {
  buildEqualizedRichTableColumnTransaction,
  buildNormalizedRichTableColumnWidthTransaction,
  getRichTableEqualColumnWidth,
} from './richTableColumnWidths';

const editors: Editor[] = [];

const createEditor = (content = buildDefaultRichTableDoc(3)) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
  });

  editors.push(editor);
  return editor;
};

const getTableContext = (editor: Editor) => {
  let tableNode: any = null;
  let tableStart = -1;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      tableNode = node;
      tableStart = pos;
      return false;
    }

    return undefined;
  });

  return { tableNode, tableStart };
};

const getFirstCellTextPosition = (editor: Editor) => {
  let textPosition = -1;

  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes('列 1')) {
      textPosition = pos + 1;
      return false;
    }

    return undefined;
  });

  return textPosition;
};

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe('richTableColumnWidths', () => {
  test('derives a stable equal width from the rendered table width', () => {
    expect(getRichTableEqualColumnWidth({ tableWidth: 509, columnCount: 3 })).toBe(169);
    expect(getRichTableEqualColumnWidth({ tableWidth: 40, columnCount: 3 })).toBe(25);
  });

  test('writes the same colwidth to every visible cell in the table', () => {
    const editor = createEditor();
    const { tableNode, tableStart } = getTableContext(editor);

    const tr = buildEqualizedRichTableColumnTransaction({
      state: editor.state,
      table: tableNode,
      tableStart,
      targetWidth: 180,
    });

    expect(tr.docChanged).toBe(true);

    const colwidths: Array<number[] | null> = [];
    tr.doc.descendants((node) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        colwidths.push(node.attrs.colwidth ?? null);
      }

      return undefined;
    });

    expect(colwidths).toEqual([[180], [180], [180], [180], [180], [180]]);
  });

  test('fills a newly inserted column with the neighboring rich-table width', () => {
    const editor = createEditor();
    const firstCellTextPosition = getFirstCellTextPosition(editor);

    expect(firstCellTextPosition).toBeGreaterThan(0);
    editor.commands.setTextSelection(firstCellTextPosition);
    expect(editor.commands.addColumnAfter()).toBe(true);

    const afterInsertJson: any = editor.getJSON();
    const insertedHeaderCells = afterInsertJson.content?.[0]?.content?.[0]?.content ?? [];
    expect(insertedHeaderCells).toHaveLength(4);
    expect(insertedHeaderCells.map((cell: any) => cell?.attrs?.colwidth ?? null)).toContain(null);

    const { tableNode, tableStart } = getTableContext(editor);
    const tr = buildNormalizedRichTableColumnWidthTransaction({
      state: editor.state,
      table: tableNode,
      tableStart,
    });

    expect(tr.docChanged).toBe(true);

    const colwidths: Array<number[] | null> = [];
    tr.doc.descendants((node) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        colwidths.push(node.attrs.colwidth ?? null);
      }

      return undefined;
    });

    expect(colwidths).toEqual([
      [160], [160], [160], [160],
      [160], [160], [160], [160],
    ]);
  });
});
