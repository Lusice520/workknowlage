import { createContext, useContext } from 'react';
import type { WorkspaceSearchResultRecord } from '../../shared/types/preload';

export interface SearchContextValue {
  searchQuery: string;
  searchResults: WorkspaceSearchResultRecord[];
  searchLoading: boolean;
  onSearchQueryChange: (query: string) => void;
  onSelectSearchResult: (result: WorkspaceSearchResultRecord) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export const SearchContextProvider = SearchContext.Provider;

export const useSearchContext = (): SearchContextValue => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchContext 必须在 SearchContextProvider 内使用');
  return ctx;
};
