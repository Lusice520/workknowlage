import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { type ProseMirrorSearchMatch } from './prosemirrorSearch';
import { isEditorComposingInput } from './sharedBlockNoteEditorBehavior';
import { useSharedBlockNoteSearchDecorationEffects } from './useSharedBlockNoteSearchDecorationEffects';

const isFindShortcut = (event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>) => (
  (event.metaKey || event.ctrlKey) &&
  !event.shiftKey &&
  !event.altKey &&
  String(event.key || '').toLowerCase() === 'f'
);

export function useSharedBlockNoteSearchEffects({
  activeSearchResultIndex,
  activeSearchResultIndexRef,
  editor,
  editorBodyRef,
  focusSearchInput,
  hasCommittedSearchNavigationRef,
  hasEffectiveSearchQuery,
  isSearchOpen,
  onTransientSearchStatusChange,
  openSearch,
  searchNavigationRequest,
  searchQuery,
  searchResults,
  searchResultsRef,
  setActiveSearchResultIndex,
  setSearchNavigationRequest,
  setSearchResults,
  setTransientSearchQuery,
  syncSearchResults,
  tiptapEditor,
  transientSearchClearTimeoutRef,
  transientSearchQuery,
  transientSearchReportedKeyRef,
  transientSearchRequest,
  transientSearchStatusTimeoutRef,
  unregisterSearchPlugin,
}: {
  activeSearchResultIndex: number;
  activeSearchResultIndexRef: MutableRefObject<number>;
  editor: any;
  editorBodyRef: RefObject<HTMLDivElement>;
  focusSearchInput: ({ select }: { select?: boolean }) => void;
  hasCommittedSearchNavigationRef: MutableRefObject<boolean>;
  hasEffectiveSearchQuery: boolean;
  isSearchOpen: boolean;
  onTransientSearchStatusChange?: (event: {
    matchCount: number;
    query: string;
    requestKey: number;
    status: 'matched' | 'no-match';
  }) => void;
  openSearch: () => void;
  searchNavigationRequest: { from: number; to: number } | null;
  searchQuery: string;
  searchResults: ProseMirrorSearchMatch[];
  searchResultsRef: MutableRefObject<ProseMirrorSearchMatch[]>;
  setActiveSearchResultIndex: (value: number) => void;
  setSearchNavigationRequest: (value: { from: number; to: number } | null) => void;
  setSearchResults: (value: ProseMirrorSearchMatch[]) => void;
  setTransientSearchQuery: (value: string) => void;
  syncSearchResults: () => void;
  tiptapEditor: any;
  transientSearchClearTimeoutRef: MutableRefObject<number | null>;
  transientSearchQuery: string;
  transientSearchReportedKeyRef: MutableRefObject<string | null>;
  transientSearchRequest?: {
    autoClearMs?: number;
    query: string;
    requestKey: number;
  } | null;
  transientSearchStatusTimeoutRef: MutableRefObject<number | null>;
  unregisterSearchPlugin: () => void;
}) {
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults, searchResultsRef]);

  useEffect(() => {
    activeSearchResultIndexRef.current = activeSearchResultIndex;
  }, [activeSearchResultIndex, activeSearchResultIndexRef]);

  useEffect(() => {
    if (!editor || !tiptapEditor) return undefined;
    syncSearchResults();
    if (!hasEffectiveSearchQuery) return undefined;

    const unsubscribe = editor.onChange?.(syncSearchResults);
    return () => {
      unsubscribe?.();
    };
  }, [editor, hasEffectiveSearchQuery, syncSearchResults, tiptapEditor]);

  useEffect(() => {
    hasCommittedSearchNavigationRef.current = false;
    setSearchNavigationRequest(null);
  }, [hasCommittedSearchNavigationRef, searchQuery, setSearchNavigationRequest, transientSearchQuery]);

  useEffect(() => {
    if (!transientSearchRequest || !String(transientSearchRequest.query || '').trim()) {
      transientSearchReportedKeyRef.current = null;
      return;
    }

    setTransientSearchQuery(transientSearchRequest.query);
    hasCommittedSearchNavigationRef.current = false;

    if (transientSearchClearTimeoutRef.current !== null) {
      window.clearTimeout(transientSearchClearTimeoutRef.current);
    }

    transientSearchClearTimeoutRef.current = window.setTimeout(() => {
      setTransientSearchQuery('');
      if (!isSearchOpen) {
        setSearchResults([]);
        setActiveSearchResultIndex(-1);
        setSearchNavigationRequest(null);
        searchResultsRef.current = [];
        activeSearchResultIndexRef.current = -1;
        unregisterSearchPlugin();
      }
    }, transientSearchRequest.autoClearMs ?? 2600);
  }, [
    activeSearchResultIndexRef,
    hasCommittedSearchNavigationRef,
    isSearchOpen,
    searchResultsRef,
    setActiveSearchResultIndex,
    setSearchNavigationRequest,
    setSearchResults,
    setTransientSearchQuery,
    transientSearchClearTimeoutRef,
    transientSearchReportedKeyRef,
    transientSearchRequest,
    unregisterSearchPlugin,
  ]);

  useEffect(() => {
    return () => {
      if (transientSearchClearTimeoutRef.current !== null) {
        window.clearTimeout(transientSearchClearTimeoutRef.current);
      }
      if (transientSearchStatusTimeoutRef.current !== null) {
        window.clearTimeout(transientSearchStatusTimeoutRef.current);
      }
    };
  }, [transientSearchClearTimeoutRef, transientSearchStatusTimeoutRef]);

  useEffect(() => {
    if (transientSearchStatusTimeoutRef.current !== null) {
      window.clearTimeout(transientSearchStatusTimeoutRef.current);
      transientSearchStatusTimeoutRef.current = null;
    }

    if (
      isSearchOpen ||
      !transientSearchRequest ||
      !String(transientSearchRequest.query || '').trim() ||
      !onTransientSearchStatusChange
    ) {
      if (!transientSearchRequest || !String(transientSearchRequest.query || '').trim()) {
        transientSearchReportedKeyRef.current = null;
      }
      return;
    }

    const query = String(transientSearchRequest.query || '').trim();
    const requestKey = transientSearchRequest.requestKey;

    transientSearchStatusTimeoutRef.current = window.setTimeout(() => {
      const matchCount = searchResultsRef.current.length;
      const status = matchCount > 0 ? 'matched' : 'no-match';
      const reportKey = `${requestKey}:${status}:${matchCount}`;
      if (transientSearchReportedKeyRef.current === reportKey) return;

      transientSearchReportedKeyRef.current = reportKey;
      onTransientSearchStatusChange({
        requestKey,
        query,
        matchCount,
        status,
      });
    }, 120);

    return () => {
      if (transientSearchStatusTimeoutRef.current !== null) {
        window.clearTimeout(transientSearchStatusTimeoutRef.current);
        transientSearchStatusTimeoutRef.current = null;
      }
    };
  }, [
    isSearchOpen,
    onTransientSearchStatusChange,
    searchResults,
    searchResultsRef,
    transientSearchReportedKeyRef,
    transientSearchRequest,
    transientSearchStatusTimeoutRef,
  ]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!isFindShortcut(event) || isEditorComposingInput({ editor, event })) return;

      const eventTarget = event.target instanceof Node ? event.target : null;
      const activeElement = document.activeElement;
      const isWithinEditor = Boolean(
        isSearchOpen ||
        (eventTarget && editorBodyRef.current?.contains(eventTarget)) ||
        (activeElement && editorBodyRef.current?.contains(activeElement))
      );

      if (!isWithinEditor) return;
      event.preventDefault();
      openSearch();
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [editor, editorBodyRef, isSearchOpen, openSearch]);

  useSharedBlockNoteSearchDecorationEffects({
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
  });
}
