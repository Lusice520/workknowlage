import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFallbackDesktopApi } from '../shared/lib/workKnowlageApi';
import { useDocumentShare } from './useDocumentShare';

const originalApi = window.workKnowlage;

beforeEach(() => {
  window.workKnowlage = createFallbackDesktopApi();
});

afterEach(() => {
  window.workKnowlage = originalApi;
});

describe('useDocumentShare', () => {
  test('does not create shares for spreadsheet documents', async () => {
    const saveDocumentContent = vi.fn().mockResolvedValue(undefined);
    const updateWorkbook = vi.fn().mockResolvedValue({
      documentId: 'sheet-1',
      workbookJson: '{}',
    });
    const createShare = vi.fn().mockResolvedValue({
      documentId: 'sheet-1',
      token: 'share-token',
      enabled: true,
      publicUrl: 'http://127.0.0.1/share/share-token',
    });
    window.workKnowlage = {
      ...createFallbackDesktopApi(),
      spreadsheets: {
        get: vi.fn(),
        update: updateWorkbook,
      },
      shares: {
        get: vi.fn().mockResolvedValue(null),
        create: createShare,
        regenerate: vi.fn(),
        disable: vi.fn(),
        getPublicUrl: vi.fn(),
      },
    } as any;

    const workbookJson = JSON.stringify({ sheets: {} });
    const { result } = renderHook(() =>
      useDocumentShare({
        activeDocumentId: 'sheet-1',
        activeDocumentKind: 'spreadsheet',
        activeQuickNoteDate: null,
        onSaveDocumentContent: saveDocumentContent,
      })
    );

    await act(async () => {
      await result.current.shareDocument('sheet-1', workbookJson);
    });

    expect(saveDocumentContent).not.toHaveBeenCalled();
    expect(updateWorkbook).not.toHaveBeenCalled();
    expect(createShare).not.toHaveBeenCalled();
    expect(result.current.shareStatusText).toBe('表格不支持分享');
  });

  test('creates temporary public shares and copies the link with generated password', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    const saveDocumentContent = vi.fn().mockResolvedValue(undefined);
    const createPublicShare = vi.fn().mockResolvedValue({
      documentId: 'doc-1',
      token: 'lan-token',
      publicToken: 'public-token',
      enabled: false,
      publicEnabled: true,
      publicUrl: 'https://demo.trycloudflare.com/public/share/public-token',
      publicPassword: 'generated-password',
      publicExpiresAt: '2026-05-20T12:00:00.000Z',
    });
    const disablePublicShare = vi.fn().mockResolvedValue({
      documentId: 'doc-1',
      token: 'lan-token',
      publicToken: 'public-token',
      enabled: false,
      publicEnabled: false,
    });
    window.workKnowlage = {
      ...createFallbackDesktopApi(),
      shares: {
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        regenerate: vi.fn(),
        disable: vi.fn(),
        getPublicUrl: vi.fn(),
        createPublic: createPublicShare,
        disablePublic: disablePublicShare,
      },
    } as any;

    const { result } = renderHook(() =>
      useDocumentShare({
        activeDocumentId: 'doc-1',
        activeDocumentKind: 'note',
        activeQuickNoteDate: null,
        onSaveDocumentContent: saveDocumentContent,
      })
    );

    await act(async () => {
      await result.current.sharePublicDocument('doc-1', '[]', {
        expiresAt: '2026-05-20T12:00:00.000Z',
      });
    });

    expect(saveDocumentContent).toHaveBeenCalledWith('doc-1', '[]');
    expect(createPublicShare).toHaveBeenCalledWith('doc-1', {
      expiresAt: '2026-05-20T12:00:00.000Z',
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://demo.trycloudflare.com/public/share/public-token'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('generated-password'));
    expect(result.current.shareStatusText).toBe('已复制公网链接和密码');
    expect(result.current.shareCanCopyPublicPassword).toBe(true);

    await act(async () => {
      await result.current.copyPublicShareLinkWithPassword();
    });

    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('generated-password'));
    expect(result.current.shareStatusText).toBe('已复制公网链接和密码');

    await act(async () => {
      await result.current.disablePublicShareDocument('doc-1');
    });

    expect(disablePublicShare).toHaveBeenCalledWith('doc-1');
    expect(result.current.shareStatusText).toBe('临时公网分享已关闭');
  });

  test('shows a failure state when temporary public share creation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveDocumentContent = vi.fn().mockResolvedValue(undefined);
    const createPublicShare = vi.fn().mockRejectedValue(new Error('cloudflared missing'));
    window.workKnowlage = {
      ...createFallbackDesktopApi(),
      shares: {
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        regenerate: vi.fn(),
        disable: vi.fn(),
        getPublicUrl: vi.fn(),
        createPublic: createPublicShare,
      },
    } as any;

    const { result } = renderHook(() =>
      useDocumentShare({
        activeDocumentId: 'doc-1',
        activeDocumentKind: 'note',
        activeQuickNoteDate: null,
        onSaveDocumentContent: saveDocumentContent,
      })
    );

    await act(async () => {
      await result.current.sharePublicDocument('doc-1', '[]', {
        expiresAt: '2026-05-20T12:00:00.000Z',
      });
    });

    expect(createPublicShare).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('[App] Failed to create public share:', expect.any(Error));
    expect(result.current.shareStatusText).toBe('公网分享失败：cloudflared missing');
    expect(result.current.shareBusy).toBe(false);
  });
});
