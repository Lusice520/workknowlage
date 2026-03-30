import { useEffect, useState } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';
import type { WorkspaceSearchResultRecord } from '../shared/types/preload';
import type { DocumentRecord } from '../shared/types/workspace';

interface UseWorkspaceSearchOptions {
  activeSpaceId: string | null | undefined;
  documents: DocumentRecord[] | undefined;
  refreshKey: number;
}

export interface WorkspaceSearchState {
  searchQuery: string;
  searchResults: WorkspaceSearchResultRecord[];
  searchLoading: boolean;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
}

export function useWorkspaceSearch({
  activeSpaceId,
  documents,
  refreshKey,
}: UseWorkspaceSearchOptions): WorkspaceSearchState {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResultRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!activeSpaceId || trimmedQuery.length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const api = getWorkKnowlageApi();
    if (!api.search?.query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    api.search.query(activeSpaceId, trimmedQuery)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
        }
      })
      .catch((error) => {
        console.error('[App] Failed to search workspace:', error);
        if (!cancelled) {
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, documents, refreshKey, searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return {
    searchQuery,
    searchResults,
    searchLoading,
    setSearchQuery,
    clearSearch,
  };
}
