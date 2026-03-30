import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

test('renders the WorkKnowlage shell title', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toHaveTextContent('个人工作空间');
  });

  expect(screen.getByTestId('center-pane')).toHaveTextContent('创意草案');
});

test('shows browser mock storage status and warns that new documents are session-only', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
  });

  expect(screen.queryByTestId('storage-status-banner')).not.toBeInTheDocument();
  expect(screen.queryByText('浏览器内存 Mock')).not.toBeInTheDocument();
  expect(screen.queryByText('覆盖：空间、文件夹、文档、快记')).not.toBeInTheDocument();
  expect(screen.queryByText('位置：浏览器会话内存')).not.toBeInTheDocument();

  await clickAsync(screen.getByTestId('space-switcher-trigger'));
  await clickAsync(screen.getByRole('button', { name: '设置' }));

  expect(screen.getByText('浏览器内存 Mock')).toBeInTheDocument();
  expect(screen.getByText('关闭页面后会丢失')).toBeInTheDocument();
  expect(screen.getByText('当前仅保存在浏览器会话')).toBeInTheDocument();
  expect(screen.getByText('覆盖：空间、文件夹、文档、快记')).toBeInTheDocument();
  expect(screen.getByText('位置：浏览器会话内存')).toBeInTheDocument();

  const sidebar = screen.getByTestId('left-sidebar');
  openSidebarMenu(sidebar, '根目录新建操作');
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建文件' }));

  await waitFor(() => {
    expect(screen.getByText('新建文件仅保存在浏览器会话')).toBeInTheDocument();
  });
});

test('shows sqlite runtime status when running through the desktop bridge', async () => {
  window.workKnowlage = {
    ...createFallbackDesktopApi(),
    meta: {
      version: '0.1.0',
      runtime: 'electron-sqlite',
      persistence: 'disk',
      storageLabel: 'SQLite 本地数据库',
      getStorageInfo: async () => ({
        storagePath: '/Users/demo/Library/Application Support/WorkKnowlage/workknowlage.db',
        scopeLabel: '空间、文件夹、文档、快记',
      }),
    },
  };

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
  });

  expect(screen.queryByTestId('storage-status-banner')).not.toBeInTheDocument();
  expect(screen.queryByText('SQLite 本地数据库')).not.toBeInTheDocument();
  expect(screen.queryByText('覆盖：空间、文件夹、文档、快记')).not.toBeInTheDocument();
  expect(
    screen.queryByText('位置：/Users/demo/Library/Application Support/WorkKnowlage/workknowlage.db')
  ).not.toBeInTheDocument();

  await clickAsync(screen.getByTestId('space-switcher-trigger'));
  await clickAsync(screen.getByRole('button', { name: '设置' }));

  expect(screen.getByText('SQLite 本地数据库')).toBeInTheDocument();
  expect(screen.getByText('会自动保存到本机')).toBeInTheDocument();
  expect(screen.getByText('当前写入会持久化到本地数据库')).toBeInTheDocument();
  expect(screen.getByText('覆盖：空间、文件夹、文档、快记')).toBeInTheDocument();
  expect(
    screen.getByText('位置：/Users/demo/Library/Application Support/WorkKnowlage/workknowlage.db')
  ).toBeInTheDocument();
});

test('shows data tool actions in settings and renders maintenance feedback', async () => {
  const api = createFallbackDesktopApi();
  const rebuildSearchIndex = vi.fn().mockResolvedValue({
    success: true,
    message: '搜索索引已重建',
  });

  window.workKnowlage = {
    ...api,
    maintenance: {
      openDataDirectory: vi.fn().mockResolvedValue({ success: true, message: '已打开数据目录' }),
      createBackup: vi.fn().mockResolvedValue({ success: true, message: '备份已创建' }),
      restoreBackup: vi.fn().mockResolvedValue({ success: true, message: '备份已恢复' }),
      rebuildSearchIndex,
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

  expect(screen.getByRole('button', { name: '打开数据目录' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '创建备份' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '从备份恢复' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重建搜索索引' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '清理孤儿附件' })).toBeInTheDocument();

  await clickAsync(screen.getByRole('button', { name: '重建搜索索引' }));

  await waitFor(() => {
    expect(rebuildSearchIndex).toHaveBeenCalledTimes(1);
  });

  expect(screen.getByText('搜索索引已重建')).toBeInTheDocument();
});

test('refreshes document backlinks from persistence when reopening a document', async () => {
  const api = createFallbackDesktopApi();
  window.workKnowlage = api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '打开来源文档 架构设计' })).toBeInTheDocument();
  });

  await api.documents.update('doc-architecture-design', {
    contentJson: JSON.stringify([]),
  });

  fireEvent.click(screen.getAllByText('架构设计')[0]!);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '架构设计' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByText('创意草案')[0]!);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '创意草案' })).toBeInTheDocument();
  });

  expect(screen.queryByRole('button', { name: '打开来源文档 架构设计' })).not.toBeInTheDocument();
});

test('opens a backlink source document and focuses the referenced block', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '打开来源文档 架构设计' })).toBeInTheDocument();
  });

  await clickAsync(screen.getByRole('button', { name: '打开来源文档 架构设计' }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '架构设计' })).toBeInTheDocument();
    const focusedBlock = screen
      .getByTestId('center-pane')
      .querySelector('[data-id="section-arch-copy"]') as HTMLElement | null;
    const focusedBlockContent = focusedBlock?.querySelector('.wk-block-focus-target-content') as HTMLElement | null;
    expect(focusedBlock).toBeTruthy();
    expect(
      focusedBlock?.classList.contains('wk-block-focus-target') ||
      focusedBlockContent?.classList.contains('wk-block-focus-target-content')
    ).toBe(true);
  }, { timeout: 5000 });
}, 10000);
