import { useCallback, useRef, useState, type RefObject } from 'react';
import { findProseMirrorMatches, type ProseMirrorSearchMatch } from './prosemirrorSearch';
import { SHARED_BLOCKNOTE_SEARCH_PLUGIN_KEY } from './sharedBlockNoteSearchConstants';
import { useSharedBlockNoteSearchEffects } from './useSharedBlockNoteSearchEffects';

const getNextSearchResultIndex = ({
  currentIndex,
  total,
  direction,
}: {
  currentIndex: number;
  total: number;
  direction: 1 | -1;
}) => {
  if (!total) return -1;
  if (currentIndex < 0) return direction === -1 ? total - 1 : 0;
  return (currentIndex + direction + total) % total;
};

export function useSharedBlockNoteSearch({
  editor,
  editorBodyRef,
  onTransientSearchStatusChange,
  transientSearchRequest = null,
}: {
  editor: any;
  editorBodyRef: RefObject<HTMLDivElement>;
  onTransientSearchStatusChange?: (event: {
    matchCount: number;
    query: string;
    requestKey: number;
    status: 'matched' | 'no-match';
  }) => void;
  transientSearchRequest?: {
    autoClearMs?: number;
    query: string;
    requestKey: number;
  } | null;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultsRef = useRef<ProseMirrorSearchMatch[]>([]);
  const hasCommittedSearchNavigationRef = useRef(false);
  const activeSearchResultIndexRef = useRef(-1);
  const transientSearchClearTimeoutRef = useRef<number | null>(null);
  const transientSearchStatusTimeoutRef = useRef<number | null>(null);
  const transientSearchReportedKeyRef = useRef<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProseMirrorSearchMatch[]>([]);
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(-1);
  const [searchNavigationRequest, setSearchNavigationRequest] = useState<{ from: number; to: number } | null>(null);
  const [transientSearchQuery, setTransientSearchQuery] = useState('');
  const tiptapEditor = editor?._tiptapEditor;
  const effectiveSearchQuery = isSearchOpen ? searchQuery : transientSearchQuery;
  const hasEffectiveSearchQuery = String(effectiveSearchQuery || '').trim().length > 0;

  const unregisterSearchPlugin = useCallback(() => {
    if (!tiptapEditor || tiptapEditor.isDestroyed) {
      return;
    }

    tiptapEditor.unregisterPlugin?.(SHARED_BLOCKNOTE_SEARCH_PLUGIN_KEY);
  }, [tiptapEditor]);

  const focusSearchInput = useCallback(({ select = false }: { select?: boolean } = {}) => {
    window.setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (select) {
        input.select();
      }
    }, 0);
  }, []);

  const syncSearchResults = useCallback(() => {
    const nextResults = tiptapEditor?.state?.doc
      ? findProseMirrorMatches(tiptapEditor.state.doc, effectiveSearchQuery)
      : [];
    const previousActiveResult = searchResultsRef.current[activeSearchResultIndexRef.current] ?? null;
    let nextActiveIndex = -1;

    if (nextResults.length > 0) {
      nextActiveIndex = previousActiveResult
        ? nextResults.findIndex((result) => (
          result.from === previousActiveResult.from &&
          result.to === previousActiveResult.to &&
          result.text === previousActiveResult.text
        ))
        : -1;

      if (nextActiveIndex < 0) {
        nextActiveIndex = 0;
      }
    }

    searchResultsRef.current = nextResults;
    activeSearchResultIndexRef.current = nextActiveIndex;
    setSearchResults(nextResults);
    setActiveSearchResultIndex(nextActiveIndex);
  }, [effectiveSearchQuery, tiptapEditor]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    hasCommittedSearchNavigationRef.current = false;
    if (!transientSearchQuery.trim()) {
      setSearchResults([]);
      setActiveSearchResultIndex(-1);
      setSearchNavigationRequest(null);
      searchResultsRef.current = [];
      activeSearchResultIndexRef.current = -1;
      unregisterSearchPlugin();
    }
  }, [transientSearchQuery, unregisterSearchPlugin]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    focusSearchInput({ select: true });
  }, [focusSearchInput]);

  const jumpToSearchResult = useCallback((direction: 1 | -1) => {
    const total = searchResultsRef.current.length;
    if (total === 0) return;

    const currentIndex = activeSearchResultIndexRef.current;
    const nextIndex = hasCommittedSearchNavigationRef.current
      ? getNextSearchResultIndex({ currentIndex, total, direction })
      : direction === 1
        ? (currentIndex >= 0 ? currentIndex : 0)
        : (currentIndex >= 0 ? (currentIndex - 1 + total) % total : total - 1);
    const nextResult = searchResultsRef.current[nextIndex];
    if (!nextResult) return;

    hasCommittedSearchNavigationRef.current = true;
    activeSearchResultIndexRef.current = nextIndex;
    setActiveSearchResultIndex(nextIndex);
    setSearchNavigationRequest({
      from: nextResult.from,
      to: nextResult.to,
    });
    focusSearchInput();
  }, [focusSearchInput]);

  useSharedBlockNoteSearchEffects({
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
  });

  return {
    activeSearchResultIndex,
    closeSearch,
    isSearchOpen,
    jumpToSearchResult,
    openSearch,
    searchInputRef,
    searchQuery,
    searchResults,
    setSearchQuery,
  };
}
