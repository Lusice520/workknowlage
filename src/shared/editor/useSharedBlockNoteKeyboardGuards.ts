import { useEffect, useRef } from 'react';
import {
  handleSharedBlockNoteContainerBeforeChange,
  handleSharedBlockNoteContainerKeydown,
  normalizeSharedBlockNoteAlertHeaders,
  type SharedBlockNoteContainerRefs,
} from './sharedBlockNoteContainerBehavior';
import { handleSharedBlockNoteTableKeydown } from './sharedBlockNoteTableBehavior';
import { isEditorComposingInput } from './sharedBlockNoteEditorBehavior';
import { useSharedBlockNoteSurfaceFocus } from './useSharedBlockNoteSurfaceFocus';

export function useSharedBlockNoteKeyboardGuards({ editor }: { editor: any }) {
  const refs: SharedBlockNoteContainerRefs = {
    alertExitArmedRef: useRef(false),
    alertExitPlaceholderRef: useRef<string | null>(null),
    alertExitTargetRef: useRef<string | null>(null),
    applyingAlertHeaderNormalizationRef: useRef(false),
    alertHeaderNormalizationDoneRef: useRef(false),
    redirectingListIntoAlertRef: useRef(false),
  };
  const { handleEditorBodyMouseDownCapture, insertTrailingParagraphAfterBlock } = useSharedBlockNoteSurfaceFocus({ editor });

  useEffect(() => {
    refs.alertHeaderNormalizationDoneRef.current = false;
    refs.applyingAlertHeaderNormalizationRef.current = false;
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;

    const normalizeAlerts = () => {
      normalizeSharedBlockNoteAlertHeaders(editor, refs);
    };

    const normalizationTimer = setTimeout(() => {
      normalizeAlerts();
    }, 0);
    const unsubscribeNormalization = editor.onChange(() => {
      normalizeAlerts();
    });
    const unsubscribeBeforeChange = editor.onBeforeChange(handleSharedBlockNoteContainerBeforeChange(editor, refs));

    const keydownHandler = (event: KeyboardEvent) => {
      if (isEditorComposingInput({ editor, event })) return;
      if (handleSharedBlockNoteTableKeydown({ editor, event, insertTrailingParagraphAfterBlock })) return;
      handleSharedBlockNoteContainerKeydown({ editor, event, refs });
    };

    const dom = editor.prosemirrorView?.dom;
    dom?.addEventListener('keydown', keydownHandler, true);
    return () => {
      clearTimeout(normalizationTimer);
      unsubscribeNormalization?.();
      unsubscribeBeforeChange?.();
      dom?.removeEventListener('keydown', keydownHandler, true);
    };
  }, [editor, insertTrailingParagraphAfterBlock, refs]);

  return {
    handleEditorBodyMouseDownCapture,
  };
}
