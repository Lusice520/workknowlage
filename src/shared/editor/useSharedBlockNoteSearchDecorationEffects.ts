import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { Plugin } from '@tiptap/pm/state';
import { createProseMirrorSearchDecorations, type ProseMirrorSearchMatch } from './prosemirrorSearch';
import {
  SHARED_BLOCKNOTE_ACTIVE_SEARCH_MATCH_CLASS_NAME,
  SHARED_BLOCKNOTE_SEARCH_MATCH_CLASS_NAME,
  SHARED_BLOCKNOTE_SEARCH_PLUGIN_KEY,
} from './sharedBlockNoteSearchConstants';

export function useSharedBlockNoteSearchDecorationEffects({
  activeSearchResultIndex,
  activeSearchResultIndexRef,
  editor,
  editorBodyRef,
  focusSearchInput,
  hasEffectiveSearchQuery,
  isSearchOpen,
  searchNavigationRequest,
  searchResults,
  setActiveSearchResultIndex,
  setSearchNavigationRequest,
  tiptapEditor,
  transientSearchQuery,
  unregisterSearchPlugin,
}: {
  activeSearchResultIndex: number;
  activeSearchResultIndexRef: MutableRefObject<number>;
  editor: any;
  editorBodyRef: RefObject<HTMLDivElement>;
  focusSearchInput: ({ select }: { select?: boolean }) => void;
  hasEffectiveSearchQuery: boolean;
  isSearchOpen: boolean;
  searchNavigationRequest: { from: number; to: number } | null;
  searchResults: ProseMirrorSearchMatch[];
  setActiveSearchResultIndex: (value: number) => void;
  setSearchNavigationRequest: (value: { from: number; to: number } | null) => void;
  tiptapEditor: any;
  transientSearchQuery: string;
  unregisterSearchPlugin: () => void;
}) {
  useEffect(() => {
    unregisterSearchPlugin();
    if (!tiptapEditor || tiptapEditor.isDestroyed || !hasEffectiveSearchQuery) return undefined;

    const decorations = createProseMirrorSearchDecorations(
      tiptapEditor.state.doc,
      searchResults,
      activeSearchResultIndex,
      {
        matchClass: SHARED_BLOCKNOTE_SEARCH_MATCH_CLASS_NAME,
        activeMatchClass: SHARED_BLOCKNOTE_ACTIVE_SEARCH_MATCH_CLASS_NAME,
      },
    );

    const plugin = new Plugin({
      key: SHARED_BLOCKNOTE_SEARCH_PLUGIN_KEY,
      props: {
        decorations: () => decorations,
      },
    });

    tiptapEditor.registerPlugin(plugin);
    return () => {
      unregisterSearchPlugin();
    };
  }, [activeSearchResultIndex, hasEffectiveSearchQuery, searchResults, tiptapEditor, unregisterSearchPlugin]);

  useEffect(() => {
    if (!hasEffectiveSearchQuery || !searchNavigationRequest) return undefined;

    let focusTimeoutId: number | null = null;
    let attempts = 0;
    const maxTransientScrollAttempts = 8;

    const scrollSurfaceToRect = (targetRect: DOMRect | { top: number; bottom: number; height: number }) => {
      const editorSurface = editorBodyRef.current;
      if (!editorSurface) return false;

      const matchHeight = Math.max(targetRect.height || (targetRect.bottom - targetRect.top), 1);
      const surfaceRect = editorSurface.getBoundingClientRect();
      const nextTop = Math.max(
        0,
        editorSurface.scrollTop +
          (targetRect.top - surfaceRect.top) -
          Math.max((surfaceRect.height - matchHeight) / 2, 0),
      );

      if (typeof editorSurface.scrollTo === 'function') {
        editorSurface.scrollTo({ top: nextTop, behavior: 'smooth' });
      } else {
        editorSurface.scrollTop = nextTop;
      }

      return true;
    };

    const scrollToTransientActiveMatch = () => {
      const editorSurface = editorBodyRef.current;
      const activeMatch = editorSurface?.querySelector(`.${SHARED_BLOCKNOTE_ACTIVE_SEARCH_MATCH_CLASS_NAME}`) as HTMLElement | null;
      if (!activeMatch || typeof activeMatch.getBoundingClientRect !== 'function') {
        if (attempts >= maxTransientScrollAttempts) return;
        attempts += 1;
        focusTimeoutId = window.setTimeout(scrollToTransientActiveMatch, 50);
        return;
      }

      scrollSurfaceToRect(activeMatch.getBoundingClientRect());
    };

    focusTimeoutId = window.setTimeout(() => {
      if (!isSearchOpen) {
        scrollToTransientActiveMatch();
        return;
      }

      try {
        tiptapEditor?.commands?.setTextSelection?.({
          from: searchNavigationRequest.from,
          to: searchNavigationRequest.to,
        });
      } catch {
        focusSearchInput({});
        return;
      }

      const view = editor?.prosemirrorView;
      if (!view || typeof view.coordsAtPos !== 'function') {
        focusSearchInput({});
        return;
      }

      try {
        const start = view.coordsAtPos(searchNavigationRequest.from);
        const end = view.coordsAtPos(searchNavigationRequest.to, -1);
        scrollSurfaceToRect({
          top: Math.min(start.top, end.top),
          bottom: Math.max(start.bottom, end.bottom),
          height: Math.max(Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top), 1),
        });
      } catch {
        // jsdom and some editor edge cases cannot resolve coordinates reliably.
      }

      focusSearchInput({});
    }, 0);

    return () => {
      if (focusTimeoutId !== null) {
        window.clearTimeout(focusTimeoutId);
      }
    };
  }, [editor, editorBodyRef, focusSearchInput, hasEffectiveSearchQuery, isSearchOpen, searchNavigationRequest, tiptapEditor]);

  useEffect(() => {
    if (isSearchOpen || !transientSearchQuery.trim() || searchResults.length === 0) {
      return;
    }

    const firstResult = searchResults[0];
    if (!firstResult) return;

    activeSearchResultIndexRef.current = 0;
    setActiveSearchResultIndex(0);
    setSearchNavigationRequest({
      from: firstResult.from,
      to: firstResult.to,
    });
  }, [
    activeSearchResultIndexRef,
    isSearchOpen,
    searchResults,
    setActiveSearchResultIndex,
    setSearchNavigationRequest,
    transientSearchQuery,
  ]);
}
