import fs from 'node:fs';
import path from 'node:path';
import { Editor } from '@tiptap/core';
import { afterEach, expect, test, vi } from 'vitest';
import { buildDefaultRichTableDoc } from './richTableLayout';
import { createRichTableEditorExtensions, flushPendingRichTablePersist } from './RichTable';

const activeEditors: Editor[] = [];

const waitForInputRule = () => new Promise((resolve) => setTimeout(resolve, 0));

const getFirstBodyCellParagraphCursor = (editor: Editor) => {
  let target: number | null = null;
  let paragraphCount = 0;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return;
    paragraphCount += 1;
    if (paragraphCount === 3) {
      target = pos + 1;
      return false;
    }
  });

  if (target == null) {
    throw new Error('Could not find first body-cell paragraph inside RichTable document');
  }

  return target;
};

const createRichTableTestEditor = () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: createRichTableEditorExtensions(),
    content: buildDefaultRichTableDoc(2),
  });

  activeEditors.push(editor);
  return editor;
};

const getFirstBodyCellContent = (editor: Editor) => {
  const doc = editor.getJSON() as any;
  const table = doc?.content?.[0] as any;
  const bodyRow = table?.content?.[1] as any;
  const firstBodyCell = bodyRow?.content?.[0] as any;
  return firstBodyCell?.content;
};

const typeTextLikeUser = (editor: Editor, text: string) => {
  for (const character of Array.from(text)) {
    const { view } = editor;
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: any) => {
      handled = handleTextInput(view, from, to, character) || handled;
      return handled;
    });

    if (!handled) {
      view.dispatch(view.state.tr.insertText(character, from, to));
    }
  }
};

afterEach(() => {
  while (activeEditors.length > 0) {
    activeEditors.pop()?.destroy();
  }
});

test('documents the RichTable user contract and browser regression matrix', () => {
  const matrixPath = path.resolve(
    __dirname,
    '../../../docs/plans/2026-04-05-rich-table-browser-regression-matrix.md'
  );
  const matrix = fs.readFileSync(matrixPath, 'utf8');

  expect(matrix).toContain('page scroll with active table');
  expect(matrix).toContain('editor scroll with active table');
  expect(matrix).toContain('toolbar visibility and anchor semantics');
  expect(matrix).toContain('add-row and add-col affordances');
  expect(matrix).toContain('rounded corners');
  expect(matrix).toContain('equal-width action');
  expect(matrix).toContain('merged-cell guardrail');
});

test('RichTable exposes one overlay render entry point and the overlay host adapter', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('useRichTableCommands');
  expect(source).toContain('useRichTableOverlayModel');
  expect(source).toContain('<RichTableOverlay');
  expect(source).toContain('getRichTableTableMinWidth');
  expect(source).toContain('--rt-table-min-width');
  expect(source).not.toContain('--rt-col-edge-lane-width');
  expect(source).not.toContain('createPortal(');
  expect(source).not.toContain('document.body');
});

test('overlay model state owns toolbar position and add-col visibility', () => {
  const sourcePath = path.resolve(__dirname, 'useRichTableOverlayModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('toolbarViewportPosition');
  expect(source).toContain('addColVisible');
  expect(source).toContain('colTopAddButtonPos');
  expect(source).toContain('editorClip');
});

test('RichTable no longer keeps duplicate toolbar visibility state after the overlay extraction', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).not.toContain('const [showToolbar');
  expect(source).not.toContain('const [toolbarViewportPosition');
});

test('RichTable wires checklist support into the embedded editor and static HTML output', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain("@tiptap/extension-list/task-list");
  expect(source).toContain("@tiptap/extension-list/task-item");
  expect(source).toContain("const RichTableInlineCode = Code.extend({");
  expect(source).toContain("if (type === 'code')");
  expect(source).toContain('html = `<code>${html}</code>`;');
  expect(source).toContain('TaskList');
  expect(source).toContain('TaskItem');
  expect(source).toContain("node.type === 'taskList'");
  expect(source).toContain("node.type === 'taskItem'");
  expect(source).toContain('toggleInlineCode');
  expect(source).not.toContain('richTableTaskInput');
  expect(source).not.toContain('RICH_TABLE_TASK_INPUT_REGEX');
  expect(source).toContain('flushPendingRichTablePersist');
  expect(source).toContain('compositionstart');
  expect(source).toContain('compositionend');
});

test('RichTable converts `[ ] ` into a checklist inside table cells and keeps following text editable', async () => {
  const editor = createRichTableTestEditor();
  editor.commands.setTextSelection(getFirstBodyCellParagraphCursor(editor));

  editor.commands.insertContent('[ ] ', { applyInputRules: true });
  await waitForInputRule();

  expect(getFirstBodyCellContent(editor)).toMatchObject([
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph' }],
        },
      ],
    },
  ]);

  editor.commands.insertContent('后续文字');

  expect(getFirstBodyCellContent(editor)).toMatchObject([
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '后续文字' }],
            },
          ],
        },
      ],
    },
  ]);
});

test('typing `[ ] ` through the text-input pipeline keeps subsequent text inside the same checklist item', () => {
  const editor = createRichTableTestEditor();
  editor.commands.setTextSelection(getFirstBodyCellParagraphCursor(editor));

  typeTextLikeUser(editor, '[ ] 后续文字');

  expect(getFirstBodyCellContent(editor)).toMatchObject([
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '后续文字' }],
            },
          ],
        },
      ],
    },
  ]);
});

test('RichTable toggles inline code with Mod-e like the main editor', () => {
  const editor = createRichTableTestEditor();
  editor.commands.setTextSelection(getFirstBodyCellParagraphCursor(editor));
  editor.commands.insertContent('code');

  const anchor = getFirstBodyCellParagraphCursor(editor);
  editor.commands.setTextSelection({ from: anchor, to: anchor + 4 });

  expect(editor.commands.keyboardShortcut('Mod-e')).toBe(true);
  expect(getFirstBodyCellContent(editor)).toMatchObject([
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'code',
          marks: [{ type: 'code' }],
        },
      ],
    },
  ]);

  expect(editor.commands.keyboardShortcut('Mod-e')).toBe(true);
  expect(getFirstBodyCellContent(editor)).toMatchObject([
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'code',
        },
      ],
    },
  ]);
});

test('RichTable defers block persistence until IME composition has finished', () => {
  const pendingSerializedRef = { current: '{"type":"doc","content":[]}' };
  const lastSerializedRef = { current: '' };
  const updateBlock = vi.fn();

  expect(
    flushPendingRichTablePersist({
      blockId: 'block-1',
      bnEditor: { updateBlock },
      isComposing: () => true,
      lastSerializedRef,
      pendingSerializedRef,
    })
  ).toBe(false);
  expect(updateBlock).not.toHaveBeenCalled();
  expect(pendingSerializedRef.current).toBe('{"type":"doc","content":[]}');

  expect(
    flushPendingRichTablePersist({
      blockId: 'block-1',
      bnEditor: { updateBlock },
      isComposing: () => false,
      lastSerializedRef,
      pendingSerializedRef,
    })
  ).toBe(true);
  expect(updateBlock).toHaveBeenCalledTimes(1);
  expect(updateBlock).toHaveBeenCalledWith('block-1', {
    type: 'richTable',
    props: { data: '{"type":"doc","content":[]}' },
  });
  expect(lastSerializedRef.current).toBe('{"type":"doc","content":[]}');
  expect(pendingSerializedRef.current).toBeNull();
});

test('RichTable preserves the editor surface scroll position while persisting resized content', () => {
  const pendingSerializedRef = { current: '{"type":"doc","content":[]}' };
  const lastSerializedRef = { current: '' };
  const scrollSurface = document.createElement('div');
  scrollSurface.className = 'shared-blocknote-surface';
  scrollSurface.scrollTop = 480;
  scrollSurface.scrollLeft = 36;

  const requestAnimationFrameSpy = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  const updateBlock = vi.fn(() => {
    scrollSurface.scrollTop = 0;
    scrollSurface.scrollLeft = 0;
  });

  expect(
    flushPendingRichTablePersist({
      blockId: 'block-1',
      bnEditor: { updateBlock },
      isComposing: () => false,
      lastSerializedRef,
      pendingSerializedRef,
      scrollSurface,
    })
  ).toBe(true);

  expect(updateBlock).toHaveBeenCalledTimes(1);
  expect(scrollSurface.scrollTop).toBe(480);
  expect(scrollSurface.scrollLeft).toBe(36);

  requestAnimationFrameSpy.mockRestore();
});
