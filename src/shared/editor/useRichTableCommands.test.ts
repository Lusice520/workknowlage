import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildDefaultRichTableDoc } from './richTableLayout';
import { useRichTableCommands } from './useRichTableCommands';

const editors: Editor[] = [];
const deferredCleanups: Array<() => void> = [];
const registerDeferredCleanup = (cleanup: () => void) => {
  deferredCleanups.push(cleanup);
};

const createEditor = (content: any) => {
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

afterEach(() => {
  while (deferredCleanups.length > 0) {
    deferredCleanups.pop()?.();
  }
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe('useRichTableCommands', () => {
  test('exposes the command surface needed by RichTable', () => {
    const api = useRichTableCommands({
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(),
      closeInlineMenus: vi.fn(),
      collapseCellSelectionToCursor: vi.fn(),
      editor: null,
      focusTableEditor: vi.fn(),
      getTableWidth: vi.fn(),
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      setHint: vi.fn(),
      toggleInlineCode: vi.fn(),
      updateTableGripPositions: vi.fn(),
    });

    expect(api.runEdgeAppendAction).toBeTypeOf('function');
    expect(api.equalizeTableColumnWidths).toBeTypeOf('function');
    expect(api.selectAxisFromHandle).toBeTypeOf('function');
    expect(api.runAddTableAction).toBeTypeOf('function');
    expect(api.runTableAction).toBeTypeOf('function');
    expect(api.applyCellAlign).toBeTypeOf('function');
    expect(api.applyCellBackground).toBeTypeOf('function');
    expect(api.applyTextColor).toBeTypeOf('function');
    expect(api.collapseCellSelectionToCursor).toBeTypeOf('function');
  });

  test('rejects equal-width requests for merged cells without mutating the document', () => {
    const editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 2, rowspan: 1 },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Merged' }] }],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph' }] },
                { type: 'tableCell', content: [{ type: 'paragraph' }] },
              ],
            },
          ],
        },
      ],
    });
    const before = editor.getJSON();
    const setHint = vi.fn();

    const api = useRichTableCommands({
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(),
      closeInlineMenus: vi.fn(),
      collapseCellSelectionToCursor: vi.fn(),
      editor,
      focusTableEditor: vi.fn(),
      getTableWidth: vi.fn(() => 480),
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      setHint,
      toggleInlineCode: vi.fn(),
      updateTableGripPositions: vi.fn(),
      registerDeferredCleanup,
    });

    expect(api.equalizeTableColumnWidths()).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    expect(setHint).toHaveBeenCalledWith('包含合并单元格时暂不支持调整相同宽度');
  });

  test('equalizes a plain table when the document has no merged cells', () => {
    const editor = createEditor(buildDefaultRichTableDoc(3));
    const getTableWidth = vi.fn(() => 510);
    const closeInlineMenus = vi.fn();
    const focusTableEditor = vi.fn(() => true);
    const updateTableGripPositions = vi.fn();
    const setHint = vi.fn();

    const api = useRichTableCommands({
      applyCellAlign: vi.fn(),
      applyCellBackground: vi.fn(),
      applyTextColor: vi.fn(),
      chainTableFocus: vi.fn(),
      closeInlineMenus,
      collapseCellSelectionToCursor: vi.fn(),
      editor,
      focusTableEditor,
      getTableWidth,
      runAddTableAction: vi.fn(),
      runEdgeAppendAction: vi.fn(),
      runTableAction: vi.fn(),
      selectAxisFromHandle: vi.fn(),
      setHint,
      toggleInlineCode: vi.fn(),
      updateTableGripPositions,
      registerDeferredCleanup,
    });

    expect(api.equalizeTableColumnWidths()).toBe(true);
    expect(closeInlineMenus).toHaveBeenCalled();
    expect(focusTableEditor).toHaveBeenCalled();
    expect(updateTableGripPositions).toHaveBeenCalled();
    expect(setHint).toHaveBeenCalledWith('已调整为等宽列');
    expect(getTableWidth).toHaveBeenCalled();
  });
});
