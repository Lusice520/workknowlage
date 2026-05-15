import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

let changeListener: (() => void) | null = null;

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
  getDomActiveBlockId: () => 'table-copy',
  getDomActiveSelectionRect: () => null,
}));

import { SharedBlockNoteSurface } from './SharedBlockNoteSurface';

beforeEach(() => {
  changeListener = null;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  }) as typeof window.requestAnimationFrame);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  changeListener = null;
});

test('does not auto-scroll the editor after copying a table selection above a RichTable', () => {
  const pmDom = document.createElement('div');

  const editor = {
    document: [
      {
        id: 'table-copy',
        type: 'table',
        content: [],
        children: [],
      },
      {
        id: 'rich-table-below',
        type: 'richTable',
        content: {},
        children: [],
      },
    ],
    onChange: (listener: () => void) => {
      changeListener = listener;
      return () => undefined;
    },
    onBeforeChange: () => () => undefined,
    getBlock: (id: string) => editor.document.find((block: any) => block.id === id),
    getTextCursorPosition: () => ({
      block: editor.document[0],
    }),
    prosemirrorView: {
      composing: false,
      state: { selection: null },
      dom: pmDom,
    },
    _tiptapEditor: {
      isDestroyed: false,
      state: { doc: { type: 'doc' } },
      registerPlugin: () => {},
      unregisterPlugin: () => {},
      commands: {
        setTextSelection: () => {},
        focus: () => {},
      },
    },
  };

  render(<SharedBlockNoteSurface editor={editor as any} />);

  const surface = document.querySelector('.shared-blocknote-surface') as HTMLDivElement;
  const tableBlock = surface.querySelector('[data-id="table-copy"]') as HTMLDivElement;
  const scrollBy = vi.fn();

  Object.defineProperty(surface, 'scrollBy', {
    configurable: true,
    value: scrollBy,
  });
  Object.defineProperty(surface, 'clientHeight', {
    configurable: true,
    value: 320,
  });
  surface.getBoundingClientRect = () => new DOMRect(0, 120, 600, 320);
  tableBlock.getBoundingClientRect = () => new DOMRect(0, 24, 600, 48);

  surface.dispatchEvent(new Event('copy', { bubbles: true, cancelable: true }));
  changeListener?.();

  expect(scrollBy).not.toHaveBeenCalled();
});
