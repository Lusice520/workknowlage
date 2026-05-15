import type { KeyboardEvent, RefObject } from 'react';

interface SharedBlockNoteSearchPanelProps {
  activeSearchResultIndex: number;
  onClose: () => void;
  onJumpToNext: () => void;
  onJumpToPrevious: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onQueryChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  searchQuery: string;
  searchResultsCount: number;
}

export function SharedBlockNoteSearchPanel({
  activeSearchResultIndex,
  onClose,
  onJumpToNext,
  onJumpToPrevious,
  onKeyDown,
  onQueryChange,
  searchInputRef,
  searchQuery,
  searchResultsCount,
}: SharedBlockNoteSearchPanelProps) {
  return (
    <div className="wk-editor-search-panel" role="search" aria-label="文档搜索">
      <input
        ref={searchInputRef}
        type="search"
        value={searchQuery}
        placeholder="搜索文档内容"
        aria-label="搜索文档内容"
        className="wk-editor-search-input"
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="wk-editor-search-count">
        {searchResultsCount === 0 ? '0 / 0' : `${activeSearchResultIndex + 1} / ${searchResultsCount}`}
      </span>
      <button
        type="button"
        className="wk-editor-search-button"
        aria-label="上一条结果"
        disabled={searchResultsCount === 0}
        onClick={onJumpToPrevious}
      >
        上一条
      </button>
      <button
        type="button"
        className="wk-editor-search-button"
        aria-label="下一条结果"
        disabled={searchResultsCount === 0}
        onClick={onJumpToNext}
      >
        下一条
      </button>
      <button
        type="button"
        className="wk-editor-search-close"
        aria-label="关闭搜索"
        onClick={onClose}
      >
        关闭
      </button>
    </div>
  );
}
