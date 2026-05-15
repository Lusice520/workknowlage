import { useCallback } from 'react';
import { blockNeedsTrailingParagraph } from './editorBodyFocusUtils';
import { EMPTY_TEXT_CONTENT } from './sharedBlockNoteEditorBehavior';

const isInteractiveSurfaceTarget = (target: Element) => (
  target.closest('.bn-inline-content') ||
  target.closest('.bn-block-content') ||
  target.closest('.bn-suggestion-menu') ||
  target.closest('.bn-suggestion-menu-item') ||
  target.closest('.bn-grid-suggestion-menu') ||
  target.closest('.bn-grid-suggestion-menu-item') ||
  target.closest('.bn-side-menu') ||
  target.closest('.bn-drag-handle-menu') ||
  target.closest('.rt-top-toolbar') ||
  target.closest('.rt-handle-menu') ||
  target.closest('.kb-attachment-open') ||
  target.closest('.kb-attachment-image-link') ||
  target.closest('button, a, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"]')
);

export function useSharedBlockNoteSurfaceFocus({ editor }: { editor: any }) {
  const insertTrailingParagraphAfterBlock = useCallback((blockId: string) => {
    if (!editor || !blockId) return null;
    const inserted = editor.insertBlocks(
      [{ type: 'paragraph', content: EMPTY_TEXT_CONTENT }],
      blockId,
      'after'
    )?.[0];

    if (inserted?.id) {
      editor.setTextCursorPosition(inserted.id, 'start');
      return inserted;
    }

    return null;
  }, [editor]);

  const focusEditorAtEnd = useCallback(() => {
    if (!editor) return;
    const blocks = Array.isArray(editor.document) ? editor.document : [];
    const fallbackBlock = blocks[blocks.length - 1];
    if (fallbackBlock?.id && blockNeedsTrailingParagraph(fallbackBlock)) {
      const inserted = insertTrailingParagraphAfterBlock(fallbackBlock.id);
      if (inserted?.id) {
        editor.prosemirrorView?.focus?.();
        return;
      }
    }
    if (fallbackBlock?.id) {
      editor.setTextCursorPosition(fallbackBlock.id, 'end');
    }
    editor.prosemirrorView?.focus?.();
  }, [editor, insertTrailingParagraphAfterBlock]);

  const handleEditorBodyMouseDownCapture = useCallback((event: React.MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (isInteractiveSurfaceTarget(target)) return;

    requestAnimationFrame(() => {
      focusEditorAtEnd();
    });
  }, [focusEditorAtEnd]);

  return {
    focusEditorAtEnd,
    handleEditorBodyMouseDownCapture,
    insertTrailingParagraphAfterBlock,
  };
}
