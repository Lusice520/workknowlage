import { mergeCells, splitCell } from 'prosemirror-tables';
import { blockNeedsTrailingParagraph } from './editorBodyFocusUtils';
import { handleRichTableAdjacentDeletionWithoutScroll } from './richTableBoundaryDelete';
import {
  getCurrentLineTextBeforeCursor,
  shouldTrapArrowLeftAfterRichTable,
} from './sharedBlockNoteEditorBehavior';

const getTableContextAtCursor = (editor: any) => {
  const cursor = editor.getTextCursorPosition();
  const currentBlock = cursor?.block;
  if (!currentBlock) return null;
  if (currentBlock.type === 'table') return { tableBlock: currentBlock, currentBlock };
  const parent = editor.getParentBlock(currentBlock.id);
  if (parent?.type === 'table') return { tableBlock: parent, currentBlock };
  return null;
};

export function handleSharedBlockNoteTableKeydown({
  editor,
  event,
  insertTrailingParagraphAfterBlock,
}: {
  editor: any;
  event: KeyboardEvent;
  insertTrailingParagraphAfterBlock: (blockId: string) => unknown;
}) {
  const target = event.target instanceof Element ? event.target : null;
  const cursor = editor.getTextCursorPosition?.();
  const currentBlock = cursor?.block;
  const prevBlock = currentBlock?.id ? editor.getPrevBlock?.(currentBlock.id) : cursor?.prevBlock;
  const selection = editor.prosemirrorView?.state?.selection;
  const selectedBlocks = editor.getSelection()?.blocks;
  const selectedBlock = Array.isArray(selectedBlocks) && selectedBlocks.length === 1 ? selectedBlocks[0] : null;
  const blocks = Array.isArray(editor.document) ? editor.document : [];
  const fallbackBlock = blocks[blocks.length - 1];

  if (!target?.closest('.rt-editor') && shouldTrapArrowLeftAfterRichTable({ event, currentBlock, prevBlock, selection })) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    !target?.closest('.rt-editor') &&
    handleRichTableAdjacentDeletionWithoutScroll({
      key: event.key,
      state: editor.prosemirrorView?.state,
      dispatch: editor.prosemirrorView?.dispatch,
    })
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !target?.closest('.rt-editor') &&
    selectedBlock?.id &&
    selectedBlock.id === fallbackBlock?.id &&
    blockNeedsTrailingParagraph(selectedBlock)
  ) {
    event.preventDefault();
    event.stopPropagation();
    insertTrailingParagraphAfterBlock(selectedBlock.id);
    return true;
  }

  const tableContext = getTableContextAtCursor(editor);
  if (!tableContext) {
    return false;
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'm') {
    const view = editor.prosemirrorView;
    const state = view?.state;
    if (!view || !state) return false;
    event.preventDefault();
    event.stopPropagation();
    mergeCells(state, view.dispatch);
    return true;
  }

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'j') {
    const view = editor.prosemirrorView;
    const state = view?.state;
    if (!view || !state) return false;
    event.preventDefault();
    event.stopPropagation();
    splitCell(state, view.dispatch);
    return true;
  }

  if (event.key === ' ' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const currentLine = getCurrentLineTextBeforeCursor(editor);
    if (/^[-*+]$/.test(currentLine)) {
      event.preventDefault();
      event.stopPropagation();
      const view = editor.prosemirrorView;
      const state = view?.state;
      if (!view || !state) return true;
      const from = state.selection.from - currentLine.length;
      const to = state.selection.from;
      view.dispatch(state.tr.insertText('• ', from, to));
      return true;
    }
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const currentLine = getCurrentLineTextBeforeCursor(editor);
    const orderedMatch = currentLine.match(/^(\d+)\.\s+.+$/);
    const bulletMatch = currentLine.match(/^(?:[-*+]|•)\s+.+$/);
    if (!orderedMatch && !bulletMatch) return false;
    const nextPrefix = orderedMatch ? `${Number(orderedMatch[1]) + 1}. ` : '• ';
    setTimeout(() => {
      const stillInTable = getTableContextAtCursor(editor);
      if (!stillInTable) return;
      const lineAfterEnter = getCurrentLineTextBeforeCursor(editor);
      if (lineAfterEnter.trim() !== '') return;
      editor.insertInlineContent(nextPrefix);
    }, 0);
    return false;
  }

  return false;
}
