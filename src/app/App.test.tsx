import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { createFallbackDesktopApi } from '../shared/lib/workKnowlageApi';

import App from './App';

const originalApi = window.workKnowlage;

beforeEach(() => {
  window.workKnowlage = createFallbackDesktopApi();
});

afterEach(() => {
  window.workKnowlage = originalApi;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function clickAsync(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

function openSidebarMenu(sidebar: HTMLElement, label: string) {
  fireEvent.click(within(sidebar).getByRole('button', { name: label }));
}


test('confirms before restoring a backup from settings', async () => {
  const api = createFallbackDesktopApi();
  const restoreBackup = vi.fn().mockResolvedValue({
    success: true,
    message: '备份已恢复',
  });
  const confirmSpy = vi.fn(() => false);
  vi.stubGlobal('confirm', confirmSpy);

  window.workKnowlage = {
    ...api,
    maintenance: {
      openDataDirectory: vi.fn().mockResolvedValue({ success: true, message: '已打开数据目录' }),
      createBackup: vi.fn().mockResolvedValue({ success: true, message: '备份已创建' }),
      restoreBackup,
      rebuildSearchIndex: vi.fn().mockResolvedValue({ success: true, message: '搜索索引已重建' }),
      cleanupOrphanAttachments: vi.fn().mockResolvedValue({
        success: true,
        message: '已清理 1 个孤儿附件',
      }),
    },
  } as any;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
  });

  await clickAsync(screen.getByTestId('space-switcher-trigger'));
  await clickAsync(screen.getByRole('button', { name: '设置' }));
  await clickAsync(screen.getByRole('button', { name: '从备份恢复' }));

  expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('整包覆盖当前本地数据'));
  expect(restoreBackup).not.toHaveBeenCalled();
});

test('shows 根目录 in the breadcrumb for a root-level document', async () => {
  const api = createFallbackDesktopApi();
  const rootDocument = {
    id: 'doc-root',
    spaceId: 'space-root',
    folderId: null as unknown as string,
    title: '根目录文档',
    contentJson: '[]',
    updatedAtLabel: 'today',
    wordCountLabel: '0 字',
    badgeLabel: '',
    outline: [],
    tags: [],
    backlinks: [],
    sections: [],
  };

  window.workKnowlage = {
    ...api,
    workspace: {
      getSnapshot: async () => ({
        folders: [],
        documents: [rootDocument],
      }),
    },
    spaces: {
      ...api.spaces,
      list: async () => [{ id: 'space-root', name: 'Root Space', label: 'WORKSPACE' }],
    },
    folders: {
      ...api.folders,
      list: async () => [],
    },
    documents: {
      ...api.documents,
      list: async (...args: any[]) => {
        const [spaceId, folderId] = args.length === 2
          ? [args[0], args[1]]
          : [undefined, args[0]];

        if (spaceId === 'space-root' && folderId === null) {
          return [rootDocument];
        }

        return [];
      },
      getById: async (id: string) => (id === 'doc-root' ? rootDocument : null),
    },
  } as any;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '根目录文档' })).toBeInTheDocument();
  });

  expect(screen.getByTestId('center-pane')).toHaveTextContent('根目录');
});

test('adds and removes tags for the active document', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByText('标签云')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '添加标签' }));

  const tagInput = screen.getByPlaceholderText('输入标签...');
  fireEvent.change(tagInput, { target: { value: '#测试标签' } });
  fireEvent.keyDown(tagInput, { key: 'Enter' });

  await waitFor(() => {
    expect(screen.getByText('#测试标签')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '移除标签 #测试标签' }));

  await waitFor(() => {
    expect(screen.queryByText('#测试标签')).not.toBeInTheDocument();
  });
});

test('clears workspace search after switching spaces', async () => {
  const api = createFallbackDesktopApi();
  const secondSpace = await api.spaces.create({ name: '第二空间', label: 'WORKSPACE' });
  window.workKnowlage = api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  const searchInput = screen.getByLabelText('搜索工作区') as HTMLInputElement;
  fireEvent.change(searchInput, { target: { value: '创意' } });

  await waitFor(() => {
    expect(searchInput.value).toBe('创意');
    expect(screen.getByTestId('workspace-search-panel')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: secondSpace.name }));

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('第二空间');
  });

  expect((screen.getByLabelText('搜索工作区') as HTMLInputElement).value).toBe('');
  expect(screen.queryByTestId('workspace-search-panel')).not.toBeInTheDocument();
});

test('clears workspace search after creating a space', async () => {
  const api = createFallbackDesktopApi();
  window.workKnowlage = api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  const searchInput = screen.getByLabelText('搜索工作区') as HTMLInputElement;
  fireEvent.change(searchInput, { target: { value: '创意' } });

  await waitFor(() => {
    expect(searchInput.value).toBe('创意');
    expect(screen.getByTestId('workspace-search-panel')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '新建空间' }));

  const createInput = screen.getByPlaceholderText('空间名称...');
  fireEvent.change(createInput, { target: { value: '新空间' } });
  fireEvent.keyDown(createInput, { key: 'Enter' });

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('新空间');
  });

  expect((screen.getByLabelText('搜索工作区') as HTMLInputElement).value).toBe('');
  expect(screen.queryByTestId('workspace-search-panel')).not.toBeInTheDocument();
});

test('clears workspace search after deleting the current space', async () => {
  const api = createFallbackDesktopApi();
  const secondSpace = await api.spaces.create({ name: '第二空间', label: 'WORKSPACE' });
  window.workKnowlage = api;
  vi.stubGlobal('confirm', () => true);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: secondSpace.name }));

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('第二空间');
  });

  const searchInput = screen.getByLabelText('搜索工作区') as HTMLInputElement;
  fireEvent.change(searchInput, { target: { value: '创意' } });

  await waitFor(() => {
    expect(searchInput.value).toBe('创意');
    expect(screen.getByTestId('workspace-search-panel')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '删除当前空间' }));

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  expect((screen.getByLabelText('搜索工作区') as HTMLInputElement).value).toBe('');
  expect(screen.queryByTestId('workspace-search-panel')).not.toBeInTheDocument();
});

test('renames and deletes the current workspace from the switcher', async () => {
  const api = createFallbackDesktopApi();
  const secondSpace = await api.spaces.create({ name: '第二空间', label: 'WORKSPACE' });
  window.workKnowlage = api;
  vi.stubGlobal('confirm', () => true);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '重命名当前空间' }));

  const renameInput = screen.getByDisplayValue('个人工作空间');
  fireEvent.change(renameInput, { target: { value: '主空间' } });
  fireEvent.keyDown(renameInput, { key: 'Enter' });

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('主空间');
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: secondSpace.name }));

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('第二空间');
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '删除当前空间' }));

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('主空间');
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));

  expect(screen.queryByRole('button', { name: secondSpace.name })).not.toBeInTheDocument();
});

test('opens collection views from the quick links and lets favorites flow into 收藏夹', async () => {
  window.workKnowlage = createFallbackDesktopApi();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '所有笔记' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '所有笔记' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '收藏文档 创意草案' }));
  fireEvent.click(screen.getByRole('button', { name: '收藏夹' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '收藏夹' })).toBeInTheDocument();
  });

  expect(
    within(screen.getByTestId('center-pane')).getByRole('button', { name: '打开文档 创意草案' })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '取消收藏文档 创意草案' }));

  await waitFor(() => {
    expect(
      within(screen.getByTestId('center-pane')).queryByRole('button', { name: '打开文档 创意草案' })
    ).not.toBeInTheDocument();
  });
});

test('moves a deleted document into the trash and restores it from the trash view', async () => {
  window.workKnowlage = createFallbackDesktopApi();
  vi.stubGlobal('confirm', () => true);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  openSidebarMenu(sidebar, '创意草案 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }));

  await waitFor(() => {
    expect(within(sidebar).queryByText('创意草案')).not.toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '回收站' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '回收站' })).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: /^恢复$/ })).toBeInTheDocument();
});

test('moves a deleted folder package into the trash and restores it as a package', async () => {
  window.workKnowlage = createFallbackDesktopApi();
  vi.stubGlobal('confirm', () => true);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  openSidebarMenu(sidebar, '灵感库 更多操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }));

  await waitFor(() => {
    expect(screen.queryByText('灵感库')).not.toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('space-switcher-trigger'));
  fireEvent.click(screen.getByRole('button', { name: '回收站' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '回收站' })).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: /^恢复$/ })).toBeInTheDocument();
});
