import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { WorkspaceSearch, type WorkspaceSearchResult } from './WorkspaceSearch';

const sampleResults: WorkspaceSearchResult[] = [
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

  fireEvent.click(screen.getByRole('button', { name: /技术架构/ }));

  expect(onSelectResult).toHaveBeenCalledWith(sampleResults[0]);
});

test('ArrowDown highlights the first result and Enter selects it', () => {
  const { onSelectResult } = renderSearch({ query: '架构' });
  const input = screen.getByRole('textbox', { name: '搜索工作区' });

  fireEvent.keyDown(input, { key: 'ArrowDown' });

  expect(within(screen.getByRole('list')).getByRole('button', { name: /技术架构/ })).toHaveAttribute('data-active', 'true');

  fireEvent.keyDown(input, { key: 'Enter' });

  expect(onSelectResult).toHaveBeenCalledWith(sampleResults[0]);
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
