import { useEffect, type RefObject } from 'react';
import { blockNeedsTrailingParagraph, getDomActiveBlockId, getDomActiveSelectionRect } from './editorBodyFocusUtils';
import { getCursorScrollDelta } from './scrollUtils';

const isNodeWithinRoot = (node: Node | null | undefined, root: HTMLElement | null) => {
  if (!node || !root || typeof root.contains !== 'function') {
    return false;
  }

  return root.contains(node instanceof Element ? node : node.parentNode);
};

export function useSharedBlockNoteCursorVisibility({
  editor,
  editorBodyRef,
}: {
  editor: any;
  editorBodyRef: RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let clipboardScrollGuardUntil = 0;

    const armClipboardScrollGuard = (event: ClipboardEvent) => {
      const root = editorBodyRef.current;
      if (!root) return;

      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
      const activeElement = document.activeElement;
      const eventTarget = event.target instanceof Node ? event.target : null;
      const isWithinEditor = Boolean(
        (eventTarget && root.contains(eventTarget)) ||
        (activeElement && root.contains(activeElement)) ||
        isNodeWithinRoot(selection?.anchorNode ?? null, root) ||
        isNodeWithinRoot(selection?.focusNode ?? null, root)
      );

      if (!isWithinEditor) return;
      clipboardScrollGuardUntil = Date.now() + 120;
    };

    document.addEventListener('copy', armClipboardScrollGuard, true);
    document.addEventListener('cut', armClipboardScrollGuard, true);

    if (!editor) {
      return () => {
        document.removeEventListener('copy', armClipboardScrollGuard, true);
        document.removeEventListener('cut', armClipboardScrollGuard, true);
      };
    }

    let rafId: number | null = null;
    let dynamicBottomActive = false;
    const bodyElement = editorBodyRef.current;
    const baseBottomPadding = '6px';
    const topThreshold = 8;
    const minDelta = 4;
    const visibleZoneRatio = 0.15;
    const minActivationGapPx = 12;
    const deactivateGapRatio = 0.45;

    const setDynamicBottomSpace = (scroller: HTMLDivElement, value: string) => {
      if (scroller.style.getPropertyValue('--shared-editor-dynamic-bottom-space') !== value) {
        scroller.style.setProperty('--shared-editor-dynamic-bottom-space', value);
      }
    };

    const keepCursorVisible = () => {
      if (editor?.prosemirrorView?.composing) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (clipboardScrollGuardUntil > Date.now()) return;
        const scroller = editorBodyRef.current;
        if (!scroller) return;
        const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
        const domBlockId = getDomActiveBlockId({
          rootElement: scroller,
          activeElement: typeof document !== 'undefined' ? document.activeElement : null,
          anchorNode: selection?.anchorNode || null,
          focusNode: selection?.focusNode || null,
        });
        const block = (domBlockId && editor.getBlock?.(domBlockId)) || editor.getTextCursorPosition?.()?.block;
        if (!block?.id) return;
        if (blockNeedsTrailingParagraph(block)) return;
        const blockEl = scroller.querySelector(`[data-id="${block.id}"]`);
        if (!blockEl) return;

        const scrollerRect = scroller.getBoundingClientRect();
        const blockRect = (blockEl as HTMLElement).getBoundingClientRect();
        const caretRect = getDomActiveSelectionRect({
          selection,
          rootElement: scroller,
        });
        const targetRect = caretRect ?? blockRect;
        const scrollerHeight = Math.max(0, scrollerRect.bottom - scrollerRect.top);
        if (scrollerHeight <= 0) return;
        const safeBottom = scrollerRect.bottom - scrollerHeight * visibleZoneRatio;
        const bottomOverflow = targetRect.bottom - safeBottom;

        const bottomDelta = getCursorScrollDelta({
          scrollerTop: scrollerRect.top,
          scrollerBottom: scrollerRect.bottom,
          blockBottom: targetRect.bottom,
          visibleZoneRatio,
          minDelta: 1,
        });

        const activationGap = Math.max(minActivationGapPx, Math.round(scrollerHeight * 0.03));
        const shouldActivate = bottomOverflow > -activationGap;

        if (!dynamicBottomActive && shouldActivate) {
          dynamicBottomActive = true;
          setDynamicBottomSpace(scroller, `${Math.round(scroller.clientHeight * visibleZoneRatio)}px`);
          return;
        }

        if (dynamicBottomActive) {
          if (bottomOverflow < -Math.round(scrollerHeight * deactivateGapRatio)) {
            dynamicBottomActive = false;
            setDynamicBottomSpace(scroller, baseBottomPadding);
            return;
          }

          if (bottomDelta > minDelta) {
            const maxStep = Math.max(12, Math.round(scrollerHeight * 0.04));
            const step = Math.min(bottomDelta, maxStep);
            scroller.scrollBy({ top: step, behavior: 'auto' });
          }
          return;
        }

        const topOverflow = targetRect.top - (scrollerRect.top + topThreshold);
        if (topOverflow < -minDelta) {
          scroller.scrollBy({ top: topOverflow, behavior: 'auto' });
        }
      });
    };

    const unsubscribe = editor.onChange(keepCursorVisible);
    return () => {
      document.removeEventListener('copy', armClipboardScrollGuard, true);
      document.removeEventListener('cut', armClipboardScrollGuard, true);
      unsubscribe?.();
      if (rafId) cancelAnimationFrame(rafId);
      if (bodyElement) {
        bodyElement.style.setProperty('--shared-editor-dynamic-bottom-space', baseBottomPadding);
      }
      dynamicBottomActive = false;
    };
  }, [editor, editorBodyRef]);
}
