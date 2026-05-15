import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { WorkspaceSearch, type WorkspaceSearchResult } from './WorkspaceSearch';

const sampleResults: WorkspaceSearchResult[] = [
  {
    id: 'block:doc-architecture:section-1',
    kind: 'document-block',
    title: '技术架构',
    documentId: 'doc-architecture',
    preview: '缓存层命中片段：SQLite 索引会返回直接跳转到 block 的结果。',
  },
  {
    id: 'block:doc-architecture:section-2',
    kind: 'document-block',
    title: '技术架构',
    documentId: 'doc-architecture',
    preview: '命中第二段：结果现在会按文档聚合，而不是把同名标题刷很多次。',
  },
  {
    id: 'doc-architecture',
    kind: 'document',
    title: '技术架构',
    preview: 'SQLite 缓存层与本地实体关系图。',
  },
  {
    id: 'quick-note-2026-03-26',
    kind: 'quick-note',
    title: '2026-03-26 快记',
    preview: '今天先补搜索，再收口快记工作流。',
  },
];

function renderSearch(props: Partial<ComponentProps<typeof WorkspaceSearch>> = {}) {
  const onQueryChange = vi.fn();
  const onSelectResult = vi.fn();

  render(
    <WorkspaceSearch
      query=""
      results={sampleResults}
      isLoading={false}
      onQueryChange={onQueryChange}
      onSelectResult={onSelectResult}
      {...props}
    />,
  );

  return { onQueryChange, onSelectResult };
}

test('renders a compact search input and hides results when the query is empty', () => {
  renderSearch();

  const input = screen.getByRole('textbox', { name: '搜索工作区' });
  expect(input).toHaveValue('');
  expect(input).toHaveAttribute('placeholder', '搜索文档、片段和快记...');
  expect(input).toHaveStyle({ fontSize: '12px', lineHeight: '1.2' });
  expect(input.className).toContain('h-8');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.queryByText('技术架构')).not.toBeInTheDocument();
  expect(screen.queryByText('输入关键词，快速查找文档或快记。')).not.toBeInTheDocument();
});

test('shows a loading state for a non-empty query', () => {
  renderSearch({ query: '架构', isLoading: true, results: [] });

  expect(screen.getByRole('textbox', { name: '搜索工作区' })).toHaveValue('架构');
  expect(screen.getByTestId('workspace-search')).toHaveClass('relative');
  expect(screen.getByTestId('workspace-search-panel')).toHaveClass('absolute');
  expect(screen.getByText('正在搜索工作区内容...')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows an empty state when a non-empty query has no results', () => {
  renderSearch({ query: '不存在的内容', results: [], isLoading: false });

  expect(screen.getByText('没有找到匹配结果')).toBeInTheDocument();
  expect(screen.getByText('试试更短的关键词，或换个标题片段。')).toBeInTheDocument();
});

test('clicking a result calls onSelectResult', () => {
  const { onSelectResult } = renderSearch({ query: '架构' });

  fireEvent.click(screen.getAllByRole('button', { name: /技术架构/ })[0]!);

  expect(onSelectResult).toHaveBeenCalledWith(sampleResults[0]);
});

test('ArrowDown highlights the first result and Enter selects it', () => {
  const { onSelectResult } = renderSearch({ query: '架构' });
  const input = screen.getByRole('textbox', { name: '搜索工作区' });

  fireEvent.keyDown(input, { key: 'ArrowDown' });

  expect(within(screen.getByRole('list')).getAllByRole('button', { name: /技术架构/ })[0]).toHaveAttribute('data-active', 'true');

  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSelectResult).toHaveBeenCalledWith(sampleResults[0]);
});

test('renders block hits with the fragment label', () => {
  renderSearch({ query: '索引' });

  expect(screen.getAllByText('片段')).toHaveLength(2);
  expect(screen.getByText('命中片段')).toBeInTheDocument();
  expect(screen.getByText(/缓存层命中片段/)).toBeInTheDocument();
  expect(screen.getAllByText('跳到命中片段')).toHaveLength(2);
});

test('Escape clears the highlighted result', () => {
  const { onSelectResult } = renderSearch({ query: '架构' });
  const input = screen.getByRole('textbox', { name: '搜索工作区' });

  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Escape' });

  expect(screen.getByRole('list')).not.toHaveAttribute('data-active-index');
  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSelectResult).not.toHaveBeenCalled();
});

test('shows grouped section headers and result counts for non-empty queries', () => {
  renderSearch({ query: '架构' });

  expect(screen.getByTestId('workspace-search-summary')).toHaveTextContent('找到 4 条结果');
  expect(screen.getByTestId('workspace-search-summary')).toHaveTextContent('片段 2');
  expect(screen.getByTestId('workspace-search-summary')).toHaveTextContent('文档 1');
  expect(screen.getByTestId('workspace-search-summary')).toHaveTextContent('快记 1');
  expect(screen.getByText('命中片段')).toBeInTheDocument();
  expect(screen.getByText('相关文档')).toBeInTheDocument();
  expect(screen.getAllByText('快记')[0]).toBeInTheDocument();
});

test('renders action hints for document and quick note rows', () => {
  renderSearch({ query: '架构' });

  expect(screen.getByText('打开整篇文档')).toBeInTheDocument();
  expect(screen.getByText('打开这条快记')).toBeInTheDocument();
});

test('groups multiple fragment hits under the same parent document card', () => {
  renderSearch({ query: '架构' });

  const fragmentGroup = screen.getByTestId('workspace-search-fragment-group-doc-architecture');
  expect(fragmentGroup).toHaveTextContent('技术架构');
  expect(fragmentGroup).toHaveTextContent('2 处命中');
  expect(fragmentGroup).toHaveTextContent('缓存层命中片段');
  expect(fragmentGroup).toHaveTextContent('命中第二段');
});

test('highlights matched query terms inside fragment, document, and quick note previews', () => {
  renderSearch({
    query: 'SQLite 待办',
    results: [
      {
        id: 'block:doc-architecture:section-highlight',
        kind: 'document-block',
        title: '技术架构',
        documentId: 'doc-architecture',
        preview: 'SQLite 索引会返回直接跳转到 block 的结果。',
      },
      {
        id: 'doc-architecture',
        kind: 'document',
        title: '技术架构',
        documentId: 'doc-architecture',
        preview: 'SQLite 缓存层与本地实体关系图。',
      },
      {
        id: 'quick-note-2026-03-26',
        kind: 'quick-note',
        title: '2026-03-26 快记',
        preview: '今天先补待办，再收口快记工作流。',
      },
    ],
  });

  const matches = document.querySelectorAll('mark[data-search-match="true"]');
  expect(matches).toHaveLength(3);
  expect(matches[0]).toHaveTextContent('SQLite');
  expect(matches[1]).toHaveTextContent('SQLite');
  expect(matches[2]).toHaveTextContent('待办');
});
