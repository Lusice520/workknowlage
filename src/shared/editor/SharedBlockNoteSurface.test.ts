import fs from 'node:fs';
import path from 'node:path';
import { getDocumentMentionItems } from './editorSchema';
import { isEditorComposingInput, shouldTrapArrowLeftAfterRichTable } from './SharedBlockNoteSurface';

test('treats IME composition as a bypass condition for custom editor shortcuts', () => {
  expect(
    isEditorComposingInput({
      editor: { prosemirrorView: { composing: false } },
      event: { isComposing: true } as KeyboardEvent,
    })
  ).toBe(true);

  expect(
    isEditorComposingInput({
      editor: { prosemirrorView: { composing: true } },
      event: { isComposing: false } as KeyboardEvent,
    })
  ).toBe(true);

  expect(
    isEditorComposingInput({
      editor: { prosemirrorView: { composing: false } },
      event: { isComposing: false } as KeyboardEvent,
    })
  ).toBe(false);
});

test('traps ArrowLeft at the start of an empty paragraph after a rich table', () => {
  expect(
    shouldTrapArrowLeftAfterRichTable({
      event: {
        key: 'ArrowLeft',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as KeyboardEvent,
      currentBlock: {
        type: 'paragraph',
        content: [{ type: 'text', text: '' }],
      },
      prevBlock: {
        type: 'richTable',
      },
      selection: {
        empty: true,
        $from: {
          parentOffset: 0,
        },
      },
    })
  ).toBe(true);
});

test('does not trap ArrowLeft when the paragraph after a rich table already has content', () => {
  expect(
    shouldTrapArrowLeftAfterRichTable({
      event: {
        key: 'ArrowLeft',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as KeyboardEvent,
      currentBlock: {
        type: 'paragraph',
        content: [{ type: 'text', text: 'x' }],
      },
      prevBlock: {
        type: 'richTable',
      },
      selection: {
        empty: true,
        $from: {
          parentOffset: 0,
        },
      },
    })
  ).toBe(false);
});

test('restores the floating formatting toolbar controller after the isolation experiment', () => {
  const surfacePath = path.resolve(__dirname, 'SharedBlockNoteSurface.tsx');
  const source = fs.readFileSync(surfacePath, 'utf8');

  expect(source).toContain('<SelectionFormattingToolbarController');
});

test('uses the local knowledge base editor view instead of the default BlockNote wrapper', () => {
  const surfacePath = path.resolve(__dirname, 'SharedBlockNoteSurface.tsx');
  const source = fs.readFileSync(surfacePath, 'utf8');

  expect(source).toContain('<KnowledgeBaseEditorView');
  expect(source).not.toContain('<BlockNoteView');
});

test('registers an @ suggestion menu for document mentions', () => {
  const surfacePath = path.resolve(__dirname, 'SharedBlockNoteSurface.tsx');
  const source = fs.readFileSync(surfacePath, 'utf8');

  expect(source).toContain('triggerCharacter="@"');
});

test('filters mention items by title and path, ranks title hits higher, and limits the result count', () => {
  const editor = {
    insertInlineContent: () => {},
  };

  const items = getDocumentMentionItems(
    editor,
    '产品',
    [
      { id: 'doc-current', title: '产品策略', folderPath: '根目录', updatedAt: '2026-03-01T10:00:00.000Z' },
      { id: 'doc-1', title: '产品总览', folderPath: '根目录', updatedAt: '2026-03-01T10:00:00.000Z' },
      { id: 'doc-2', title: '新产品路线图', folderPath: '产品库 / 路线', updatedAt: '2026-03-02T10:00:00.000Z' },
      { id: 'doc-3', title: 'HMI 说明', folderPath: '产品库 / 船舶自动化', updatedAt: '2026-03-03T10:00:00.000Z' },
      { id: 'doc-4', title: '产品研究', folderPath: '产品库 / 市场', updatedAt: '2026-03-04T10:00:00.000Z' },
      { id: 'doc-5', title: '产品调研', folderPath: '产品库 / 市场', updatedAt: '2026-03-05T10:00:00.000Z' },
      { id: 'doc-6', title: '产品方案', folderPath: '产品库 / 市场', updatedAt: '2026-03-06T10:00:00.000Z' },
      { id: 'doc-7', title: '产品清单', folderPath: '产品库 / 市场', updatedAt: '2026-03-07T10:00:00.000Z' },
      { id: 'doc-8', title: '产品规范', folderPath: '产品库 / 市场', updatedAt: '2026-03-08T10:00:00.000Z' },
      { id: 'doc-9', title: '产品术语', folderPath: '产品库 / 市场', updatedAt: '2026-03-09T10:00:00.000Z' },
      { id: 'doc-10', title: '产品库导引', folderPath: '根目录', updatedAt: '2026-03-10T10:00:00.000Z' },
    ],
    'doc-current',
  );

  expect(items).toHaveLength(8);
  expect(items[0]?.title).toBe('@产品库导引');
  expect(items[1]?.title).toBe('@产品术语');
  expect(items.some((item) => item.title === '@产品策略')).toBe(false);
});

test('matches mention items by folder path query', () => {
  const items = getDocumentMentionItems(
    { insertInlineContent: () => {} },
    '船舶',
    [
      { id: 'doc-1', title: 'HMI 说明', folderPath: '产品库 / 船舶自动化', updatedAt: '2026-03-03T10:00:00.000Z' },
      { id: 'doc-2', title: 'APS 方案', folderPath: '产品库 / 工厂控制', updatedAt: '2026-03-04T10:00:00.000Z' },
    ],
    null,
  );

  expect(items).toHaveLength(1);
  expect(items[0]?.title).toBe('@HMI 说明');
  expect(items[0]?.subtext).toBe('产品库 / 船舶自动化');
});
