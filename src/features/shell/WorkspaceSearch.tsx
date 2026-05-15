import { Fragment, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';

export type WorkspaceSearchResultKind = 'document' | 'quick-note' | 'document-block';

export interface WorkspaceSearchResult {
  id: string;
  kind: WorkspaceSearchResultKind;
  title: string;
  preview: string;
  documentId?: string;
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
  'document-block': '片段',
  'quick-note': '快记',
};

const resultKindSectionLabels: Record<WorkspaceSearchResultKind, string> = {
  'document-block': '命中片段',
  document: '相关文档',
  'quick-note': '快记',
};

const resultKindActionHints: Record<WorkspaceSearchResultKind, string> = {
  'document-block': '跳到命中片段',
  document: '打开整篇文档',
  'quick-note': '打开这条快记',
};

const resultKindOrder: WorkspaceSearchResultKind[] = ['document-block', 'document', 'quick-note'];
const compactSearchInputStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

type IndexedWorkspaceSearchResult = {
  index: number;
  result: WorkspaceSearchResult;
};

const normalizeQueryParts = (query: string): string[] => Array.from(new Set(
  query
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length),
));

const renderHighlightedText = (text: string, query: string): ReactNode => {
  const queryParts = normalizeQueryParts(query);
  if (!text || queryParts.length === 0) {
    return text;
  }

  const normalizedText = text.toLocaleLowerCase();
  const normalizedParts = queryParts.map((part) => part.toLocaleLowerCase());
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextMatchLength = 0;

    normalizedParts.forEach((part) => {
      if (part && normalizedText.startsWith(part, cursor) && part.length > nextMatchLength) {
        nextMatchLength = part.length;
      }
    });

    if (nextMatchLength > 0) {
      const matchedText = text.slice(cursor, cursor + nextMatchLength);
      nodes.push(
        <mark
          key={`match-${cursor}`}
          data-search-match="true"
          className="rounded bg-amber-100/90 px-0.5 text-slate-700 ring-1 ring-amber-200/70"
        >
          {matchedText}
        </mark>,
      );
      cursor += nextMatchLength;
      continue;
    }

    let nextCursor = cursor + 1;
    while (nextCursor < text.length) {
      const hasMatch = normalizedParts.some((part) => part && normalizedText.startsWith(part, nextCursor));
      if (hasMatch) {
        break;
      }
      nextCursor += 1;
    }

    nodes.push(
      <Fragment key={`text-${cursor}`}>
        {text.slice(cursor, nextCursor)}
      </Fragment>,
    );
    cursor = nextCursor;
  }

  return nodes;
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

  const resultCounts = useMemo(() => ({
    total: results.length,
    'document-block': results.filter((result) => result.kind === 'document-block').length,
    document: results.filter((result) => result.kind === 'document').length,
    'quick-note': results.filter((result) => result.kind === 'quick-note').length,
  }), [results]);

  const groupedResults = useMemo(() => {
    const sections = resultKindOrder
      .map((kind) => ({
        kind,
        label: resultKindSectionLabels[kind],
        results: results.flatMap((result, index) => (
          result.kind === kind ? [{ index, result }] : []
        )),
      }))
      .filter((section) => section.results.length > 0);

    const fragmentSection = sections.find((section) => section.kind === 'document-block');
    const fragmentGroups = fragmentSection
      ? fragmentSection.results.reduce<Array<{
        documentId: string;
        title: string;
        results: IndexedWorkspaceSearchResult[];
      }>>((groups, entry) => {
        const documentId = entry.result.documentId ?? entry.result.title;
        const existingGroup = groups.find((group) => group.documentId === documentId);

        if (existingGroup) {
          existingGroup.results.push(entry);
          return groups;
        }

        groups.push({
          documentId,
          title: entry.result.title,
          results: [entry],
        });
        return groups;
      }, [])
      : [];

    return {
      fragmentGroups,
      sections,
    };
  }, [results]);

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
          placeholder="搜索文档、片段和快记..."
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
            <>
              <div
                data-testid="workspace-search-summary"
                className="mb-2 rounded-[10px] border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[11px] text-slate-500"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">找到 {resultCounts.total} 条结果</span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    {resultKindOrder.map((kind) => (
                      resultCounts[kind] > 0 ? (
                        <span
                          key={kind}
                          className="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/80"
                        >
                          {resultKindLabels[kind]} {resultCounts[kind]}
                        </span>
                      ) : null
                    ))}
                  </span>
                </div>
              </div>
              <ul
                role="list"
                aria-label="搜索结果"
                data-active-index={highlightedIndex >= 0 ? highlightedIndex : undefined}
                className="space-y-2"
              >
                {groupedResults.sections.map((section) => (
                  <li key={section.kind}>
                    <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {section.label}
                    </div>
                    {section.kind === 'document-block' ? (
                      <div className="space-y-2">
                        {groupedResults.fragmentGroups.map((group) => (
                          <div
                            key={group.documentId}
                            data-testid={`workspace-search-fragment-group-${group.documentId}`}
                            className="rounded-[12px] border border-slate-200/80 bg-white/90 p-2 ring-1 ring-slate-200/50"
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-semibold leading-[1.25] text-slate-700">
                                  {group.title}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  片段命中
                                </div>
                              </div>
                              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {group.results.length} 处命中
                              </span>
                            </div>
                            <div className="space-y-1">
                              {group.results.map(({ result, index }) => {
                                const isActive = index === highlightedIndex;

                                return (
                                  <div key={result.id}>
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
                                        <span className="block truncate text-[11px] leading-[1.35] text-slate-500">
                                          {renderHighlightedText(result.preview, query)}
                                        </span>
                                        <span
                                          className={`mt-1 block text-[10px] font-medium ${
                                            isActive ? 'text-blue-600' : 'text-slate-400'
                                          }`}
                                        >
                                          {resultKindActionHints[result.kind]}
                                        </span>
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {section.results.map(({ result, index }) => {
                          const isActive = index === highlightedIndex;

                          return (
                            <div key={result.id}>
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
                                    {renderHighlightedText(result.preview, query)}
                                  </span>
                                  <span
                                    className={`mt-1 block text-[10px] font-medium ${
                                      isActive ? 'text-blue-600' : 'text-slate-400'
                                    }`}
                                  >
                                    {resultKindActionHints[result.kind]}
                                  </span>
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
