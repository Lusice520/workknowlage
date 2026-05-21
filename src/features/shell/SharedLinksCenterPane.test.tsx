import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createFallbackDesktopApi } from '../../shared/lib/workKnowlageApi';
import { SharedLinksCenterPane } from './SharedLinksCenterPane';

const originalApi = window.workKnowlage;

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  window.workKnowlage = originalApi;
});

test('lists workspace shares and supports copy, close, reset, and close all actions', async () => {
  const listForSpace = vi.fn()
    .mockResolvedValueOnce([
      {
        id: 'share-1',
        documentId: 'doc-1',
        documentTitle: '共享方案',
        documentKind: 'note',
        token: 'local-token',
        enabled: true,
        localUrl: 'http://192.168.1.2:60300/share/local-token',
        publicToken: 'public-token',
        publicEnabled: true,
        publicUrl: 'https://demo.trycloudflare.com/public/share/public-token',
        publicExpiresAt: '2026-05-21T12:00:00.000Z',
        createdAt: '2026-05-21T10:00:00.000Z',
        updatedAt: '2026-05-21T10:00:00.000Z',
      },
    ])
    .mockResolvedValue([]);
  const disable = vi.fn().mockResolvedValue(null);
  const disablePublic = vi.fn().mockResolvedValue(null);
  const createPublic = vi.fn().mockResolvedValue({
    documentId: 'doc-1',
    token: 'local-token',
    publicToken: 'public-token-2',
    publicEnabled: true,
    publicUrl: 'https://demo.trycloudflare.com/public/share/public-token-2',
    publicPassword: 'new-password',
    createdAt: '2026-05-21T10:00:00.000Z',
    updatedAt: '2026-05-21T10:00:00.000Z',
  });
  const disableAllForSpace = vi.fn().mockResolvedValue(1);
  window.workKnowlage = {
    ...createFallbackDesktopApi(),
    shares: {
      ...createFallbackDesktopApi().shares,
      listForSpace,
      disable,
      disablePublic,
      createPublic,
      disableAllForSpace,
    },
  };

  render(
    <SharedLinksCenterPane
      activeSpace={{ id: 'space-1', name: '默认空间', label: 'WORKSPACE' }}
      folders={[]}
      onOpenDocument={vi.fn()}
      onListSharesForSpace={listForSpace}
      onDisableLocalShare={disable}
      onDisablePublicShare={disablePublic}
      onResetPublicShare={createPublic}
      onDisableAllSharesForSpace={disableAllForSpace}
    />,
  );

  expect(await screen.findByText('共享方案')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: '复制' })[0]);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://192.168.1.2:60300/share/local-token');

  fireEvent.click(screen.getByRole('button', { name: '重置' }));
  await waitFor(() => {
    expect(createPublic).toHaveBeenCalledWith('doc-1', {
      expiresAt: '2026-05-21T12:00:00.000Z',
    });
  });
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining('new-password'));

  await waitFor(() => {
    expect(screen.getAllByText('当前空间没有共享链接').length).toBeGreaterThan(0);
  });

  fireEvent.click(screen.getByRole('button', { name: '一键关闭所有链接' }));
  expect(disableAllForSpace).not.toHaveBeenCalled();
});
