import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { createFallbackDesktopApi } from '../../shared/lib/workKnowlageApi';
import App from '../../app/App';

const originalApi = window.workKnowlage;

beforeEach(() => {
  window.workKnowlage = createFallbackDesktopApi();
});

afterEach(() => {
  window.workKnowlage = originalApi;
});

test('renders the compact article structure and visible share feedback', async () => {
  const saveText = vi.fn().mockResolvedValue({
    success: true,
    message: 'Markdown 已导出',
  });
  window.workKnowlage = {
    ...createFallbackDesktopApi(),
    exports: {
      saveText,
      saveBinary: vi.fn().mockResolvedValue({ success: true, message: 'Word 已导出' }),
      savePdfFromHtml: vi.fn().mockResolvedValue({ success: true, message: 'PDF 已导出' }),
    },
  } as any;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: vi.fn(() => []),
  });

  render(<App />);
  const user = userEvent.setup();

  const title = await screen.findByRole('heading', { name: '创意草案' });

  await waitFor(() => {
    expect(title).toBeInTheDocument();
  });

  const favoriteButton = await screen.findByRole('button', { name: '收藏文档 创意草案' });
  const shareButton = await screen.findByRole('button', { name: '开启分享' });

  expect(title.className).toContain('text-[22px]');
  expect(screen.getByRole('button', { name: '保存状态：已自动保存' })).toBeInTheDocument();
  expect(favoriteButton).toBeInTheDocument();
  expect(shareButton).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出' })).toBeInTheDocument();
  expect(favoriteButton.compareDocumentPosition(shareButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('分享未开启')).toBeInTheDocument();
  expect(screen.queryByText('已自动保存')).not.toBeInTheDocument();
  expect(screen.queryByText('开启分享')).not.toBeInTheDocument();
  expect(screen.getAllByText('1,240 字')).toHaveLength(1);

  expect(screen.queryByText('先接 SQLite 数据层')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '导出' }));
  const exportMarkdownItem = await screen.findByRole('menuitem', { name: '导出 Markdown' });
  expect(screen.getByRole('menuitem', { name: '导出 PDF' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '导出 Word' })).toBeInTheDocument();

  await user.click(exportMarkdownItem);

  await waitFor(() => {
    expect(saveText).toHaveBeenCalledWith(
      expect.stringContaining('创意草案'),
      expect.stringContaining('SQLite 缓存层'),
    );
  });

  await user.click(shareButton);

  await waitFor(() => {
    expect(screen.getByText('已复制分享链接')).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: '复制分享链接' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重新生成分享链接' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '关闭分享' })).toBeInTheDocument();
}, 10000);
