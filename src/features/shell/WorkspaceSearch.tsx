import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

export type WorkspaceSearchResultKind = 'document' | 'quick-note';

export interface WorkspaceSearchResult {
  id: string;
  kind: WorkspaceSearchResultKind;
  title: string;
  preview: string;
}

export interface WorkspaceSearchProps {
  query: string;
  results: WorkspaceSearchResult[];
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onSelectResult: (result: WorkspaceSearchResult) => void;
}

const resultKindLabels: Record<WorkspaceSearchResultKind, string> = {
  document: '文档',
  'quick-note': '快记',
};
const compactSearchInputStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

export function WorkspaceSearch({
  query,
  results,
  isLoading,
  onQueryChange,
  onSelectResult,
}: WorkspaceSearchProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const resultsSignature = useMemo(() => results.map((result) => result.id).join('|'), [results]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, resultsSignature]);

  const hasQuery = query.trim().length > 0;
  const showResultsPanel = hasQuery;

  const highlightedResult = useMemo(
    () => (highlightedIndex >= 0 ? results[highlightedIndex] ?? null : null),
    [highlightedIndex, results],
  );

  const moveHighlight = (direction: 1 | -1) => {
    if (results.length === 0) {
      return;
    }

    setHighlightedIndex((current) => {
      if (direction === 1) {
        return current < 0 ? 0 : (current + 1) % results.length;
      }

      if (current < 0) {
        return results.length - 1;
      }

      return (current - 1 + results.length) % results.length;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!hasQuery || isLoading || results.length === 0) {
      if (event.key === 'Escape') {
        setHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }

    if (event.key === 'Enter') {
      if (highlightedResult) {
        event.preventDefault();
        onSelectResult(highlightedResult);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setHighlightedIndex(-1);
    }
  };

  return (
    <section data-testid="workspace-search" className="relative">
      <label className="relative block">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          aria-label="搜索工作区"
          type="text"
          value={query}
          placeholder="搜索文档和快记..."
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          style={compactSearchInputStyle}
          className="h-8 w-full rounded-[10px] border border-slate-200/80 bg-white/92 py-1.5 pl-8 pr-3 text-[12px] tracking-[-0.01em] text-slate-800 outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {showResultsPanel ? (
        <div
          data-testid="workspace-search-panel"
          className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-[12px] border border-slate-200/90 bg-white/96 p-2 shadow-[0_14px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl ring-1 ring-slate-200/60"
        >
          {isLoading ? (
            <div className="rounded-[10px] border border-dashed border-slate-200/80 bg-slate-50/70 px-3 py-3 text-[11px] leading-[1.4] text-slate-500">
              正在搜索工作区内容...
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-slate-200/80 bg-slate-50/70 px-3 py-3 text-[11px] leading-[1.4] text-slate-500">
              <p className="font-medium text-slate-600">没有找到匹配结果</p>
              <p className="mt-1">试试更短的关键词，或换个标题片段。</p>
            </div>
          ) : (
            <ul
              role="list"
              aria-label="搜索结果"
              data-active-index={highlightedIndex >= 0 ? highlightedIndex : undefined}
              className="space-y-1"
            >
              {results.map((result, index) => {
                const isActive = index === highlightedIndex;

                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      data-active={isActive ? 'true' : 'false'}
                      aria-label={`打开${resultKindLabels[result.kind]} ${result.title}`}
                      onClick={() => onSelectResult(result)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`group flex w-full items-start gap-2 rounded-[10px] border px-2.5 py-2 text-left transition-all ${
                        isActive
                          ? 'border-blue-200 bg-blue-50/80 text-blue-700 shadow-sm'
                          : 'border-transparent bg-slate-50/70 text-slate-700 hover:border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          isActive
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-200/70 text-slate-500'
                        }`}
                      >
                        {resultKindLabels[result.kind]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[12px] leading-[1.3] font-medium ${
                            isActive ? 'text-blue-700' : 'text-slate-800'
                          }`}
                        >
                          {result.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-[1.35] text-slate-500">
                          {result.preview}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
