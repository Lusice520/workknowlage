import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const findProseMirrorMatches = vi.fn();
const createProseMirrorSearchDecorations = vi.fn();

const renderEditorBlocks = (blocks: any[]): React.ReactNode[] => (
  blocks.flatMap((block) => {
    const text = Array.isArray(block?.content)
      ? block.content.map((node: any) => node?.text || '').join('')
      : '';

    return [
      <div key={block.id} data-id={block.id}>
        <div className="bn-block-content" data-content-type={block.type}>
          {text}
        </div>
        {Array.isArray(block.children) ? renderEditorBlocks(block.children) : null}
      </div>,
    ];
  })
);

vi.mock('./blocknoteReactNoComments', () => ({
  FilePanelController: () => null,
  GridSuggestionMenuController: () => null,
  LinkToolbarController: () => null,
  SideMenuController: () => null,
  SuggestionMenuController: () => null,
  TableHandlesController: () => null,
  getDefaultReactSlashMenuItems: () => [],
  useEditorChange: () => undefined,
}));

vi.mock('./editorSchema', () => ({
  getDocumentMentionItems: () => [],
  getKnowledgeBaseSlashItems: () => [],
  isImageAttachment: () => false,
}));

vi.mock('./KnowledgeBaseEditorView', () => ({
  KnowledgeBaseEditorView: ({ editor, children }: { editor: any; children?: React.ReactNode }) => (
    <div className="blocknote-unified-editor">
      <div aria-label="Editor content">{renderEditorBlocks(editor.document)}</div>
      {children}
    </div>
  ),
}));

vi.mock('./KnowledgeBaseFormattingToolbar', () => ({
  KnowledgeBaseFormattingToolbar: () => null,
}));

vi.mock('./KnowledgeBaseImagePreview', () => ({
  KnowledgeBaseImagePreview: () => null,
}));

vi.mock('./SelectionFormattingToolbarController', () => ({
  SelectionFormattingToolbarController: () => null,
}));

vi.mock('./scrollUtils', () => ({
  getCursorScrollDelta: () => 0,
}));

vi.mock('./editorBodyFocusUtils', () => ({
  blockNeedsTrailingParagraph: () => false,
  getDomActiveBlockId: () => null,
  getDomActiveSelectionRect: () => null,
}));

vi.mock('./prosemirrorSearch', () => ({
  findProseMirrorMatches: (...args: unknown[]) => findProseMirrorMatches(...args),
  createProseMirrorSearchDecorations: (...args: unknown[]) => createProseMirrorSearchDecorations(...args),
}));

import { SharedBlockNoteSurface } from './SharedBlockNoteSurface';

afterEach(() => {
  vi.restoreAllMocks();
  findProseMirrorMatches.mockReset();
  createProseMirrorSearchDecorations.mockReset();
});

test('keeps focus in the search box while typing and only navigates on explicit commands', async () => {
  const setTextCursorPosition = vi.fn();
  const registerPlugin = vi.fn();
  const unregisterPlugin = vi.fn();
  const setTextSelection = vi.fn();
  const focus = vi.fn();

  findProseMirrorMatches.mockReturnValue([
    { from: 12, to: 17, text: 'alpha' },
    { from: 30, to: 35, text: 'alpha' },
  ]);
  createProseMirrorSearchDecorations.mockReturnValue({ fake: 'decorations' });

  render(
    <SharedBlockNoteSurface
      editor={{
        document: [
          {
            id: 'block-1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'alpha first hit' }],
            children: [],
          },
          {
            id: 'block-2',
            type: 'paragraph',
            content: [{ type: 'text', text: 'middle content' }],
            children: [],
          },
          {
            id: 'block-3',
            type: 'paragraph',
            content: [{ type: 'text', text: 'second alpha hit' }],
            children: [],
          },
        ],
        onChange: () => () => undefined,
        onBeforeChange: () => () => undefined,
        prosemirrorView: { composing: false, state: { selection: null } },
        setTextCursorPosition,
        _tiptapEditor: {
          isDestroyed: false,
          state: { doc: { type: 'doc' } },
          registerPlugin,
          unregisterPlugin,
          commands: {
            setTextSelection,
            focus,
          },
        },
      }}
    />
  );

  const surface = document.querySelector('.shared-blocknote-surface') as HTMLElement;
  surface.tabIndex = 0;
  surface.focus();

  fireEvent.keyDown(window, { key: 'f', metaKey: true });

  const searchInput = await screen.findByPlaceholderText('搜索文档内容');
  await waitFor(() => {
    expect(document.activeElement).toBe(searchInput);
  });

  fireEvent.change(searchInput, { target: { value: 'alpha' } });

  await waitFor(() => {
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  expect(registerPlugin).toHaveBeenCalled();
  expect(setTextSelection).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(searchInput);

  expect(createProseMirrorSearchDecorations).toHaveBeenCalledWith(
    { type: 'doc' },
    findProseMirrorMatches.mock.results[0]?.value,
    0,
    expect.any(Object),
  );
  expect(setTextCursorPosition).not.toHaveBeenCalled();

  fireEvent.keyDown(searchInput, { key: 'Enter' });

  await waitFor(() => {
    expect(setTextSelection).toHaveBeenCalledWith({ from: 12, to: 17 });
  });
  expect(document.activeElement).toBe(searchInput);

  fireEvent.click(screen.getByRole('button', { name: '下一条结果' }));

  await waitFor(() => {
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(setTextSelection).toHaveBeenLastCalledWith({ from: 30, to: 35 });
  });
  expect(document.activeElement).toBe(searchInput);

  fireEvent.keyDown(searchInput, { key: 'Escape' });

  await waitFor(() => {
    expect(screen.queryByPlaceholderText('搜索文档内容')).not.toBeInTheDocument();
    expect(unregisterPlugin).toHaveBeenCalled();
  });
});

test('reports transient search match status for jump highlighting diagnostics', async () => {
  vi.useFakeTimers();

  const onTransientSearchStatusChange = vi.fn();

  findProseMirrorMatches.mockReturnValue([]);
  createProseMirrorSearchDecorations.mockReturnValue({ fake: 'decorations' });

  const { rerender } = render(
    <SharedBlockNoteSurface
      editor={{
        document: [
          {
            id: 'block-1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'alpha first hit' }],
            children: [],
          },
        ],
        onChange: () => () => undefined,
        onBeforeChange: () => () => undefined,
        prosemirrorView: { composing: false, state: { selection: null } },
        setTextCursorPosition: vi.fn(),
        _tiptapEditor: {
          isDestroyed: false,
          state: { doc: { type: 'doc' } },
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          commands: {
            setTextSelection: vi.fn(),
            focus: vi.fn(),
          },
        },
      }}
      onTransientSearchStatusChange={onTransientSearchStatusChange}
      transientSearchRequest={{ query: 'missing text', requestKey: 7, autoClearMs: 2600 }}
    />
  );

  await act(async () => {
    vi.advanceTimersByTime(150);
  });

  expect(onTransientSearchStatusChange).toHaveBeenCalledWith({
    requestKey: 7,
    query: 'missing text',
    matchCount: 0,
    status: 'no-match',
  });

  onTransientSearchStatusChange.mockClear();
  findProseMirrorMatches.mockReturnValue([{ from: 1, to: 5, text: 'alpha' }]);

  rerender(
    <SharedBlockNoteSurface
      editor={{
        document: [
          {
            id: 'block-1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'alpha first hit' }],
            children: [],
          },
        ],
        onChange: () => () => undefined,
        onBeforeChange: () => () => undefined,
        prosemirrorView: { composing: false, state: { selection: null } },
        setTextCursorPosition: vi.fn(),
        _tiptapEditor: {
          isDestroyed: false,
          state: { doc: { type: 'doc' } },
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          commands: {
            setTextSelection: vi.fn(),
            focus: vi.fn(),
          },
        },
      }}
      onTransientSearchStatusChange={onTransientSearchStatusChange}
      transientSearchRequest={{ query: 'alpha', requestKey: 8, autoClearMs: 2600 }}
    />
  );

  await act(async () => {
    vi.advanceTimersByTime(150);
  });

  expect(onTransientSearchStatusChange).toHaveBeenCalledWith({
    requestKey: 8,
    query: 'alpha',
    matchCount: 1,
    status: 'matched',
  });
});
