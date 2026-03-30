import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFallbackDesktopApi } from '../shared/lib/workKnowlageApi';
import { useDocumentExport } from './useDocumentExport';

const originalApi = window.workKnowlage;

beforeEach(() => {
  window.workKnowlage = createFallbackDesktopApi();
});

describe('useDocumentExport', () => {
  test('saves the latest snapshot before exporting markdown', async () => {
    const saveDocumentContent = vi.fn().mockResolvedValue(undefined);
    const saveText = vi.fn().mockResolvedValue({
      success: true,
      message: 'Markdown 已导出',
    });
    window.workKnowlage = {
      ...createFallbackDesktopApi(),
      exports: {
        saveText,
        saveBinary: vi.fn(),
        savePdfFromHtml: vi.fn(),
      },
    } as any;

    let snapshot = '[]';
    const { result } = renderHook(() =>
      useDocumentExport({
        activeDocumentId: 'doc-creative-draft',
        activeDocumentTitle: '创意草案',
        activeQuickNoteDate: null,
        getCurrentContentJson: () => snapshot,
        onSaveDocumentContent: saveDocumentContent,
      })
    );

    snapshot = JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: '最新内容', styles: {} }], children: [] }]);

    await act(async () => {
      await result.current.exportMarkdown();
    });

    expect(saveDocumentContent).toHaveBeenCalledWith('doc-creative-draft', snapshot);
    expect(saveText).toHaveBeenCalledWith(expect.stringContaining('创意草案'), expect.stringContaining('最新内容'));
  });

  test('routes pdf and word exports through the export bridge', async () => {
    const saveDocumentContent = vi.fn().mockResolvedValue(undefined);
    const saveBinary = vi.fn().mockResolvedValue({
      success: true,
      message: 'Word 已导出',
    });
    const savePdfFromHtml = vi.fn().mockResolvedValue({
      success: true,
      message: 'PDF 已导出',
    });
    window.workKnowlage = {
      ...createFallbackDesktopApi(),
      exports: {
        saveText: vi.fn(),
        saveBinary,
        savePdfFromHtml,
      },
    } as any;

    const exportContent = JSON.stringify([
      {
        id: 'alert-1',
        type: 'alert',
        props: { type: 'warning' },
        content: [{ type: 'text', text: '提醒内容', styles: { bold: true } }],
        children: [
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
              { type: 'text', text: '粗体', styles: { bold: true } },
              { type: 'text', text: ' ', styles: {} },
              { type: 'text', text: '代码', styles: { code: true } },
              { type: 'text', text: ' ', styles: {} },
              { type: 'docMention', props: { documentId: 'doc-target', title: '关联文档' } },
              {
                type: 'link',
                attrs: { href: 'https://example.com' },
                content: [{ type: 'text', text: '查看详情', styles: {} }],
              },
            ],
            children: [],
          },
        ],
      },
    ]);

    const { result } = renderHook(() =>
      useDocumentExport({
        activeDocumentId: 'doc-creative-draft',
        activeDocumentTitle: '创意草案',
        activeQuickNoteDate: null,
        getCurrentContentJson: () => exportContent,
        onSaveDocumentContent: saveDocumentContent,
      })
    );

    await act(async () => {
      await result.current.exportPdf();
      await result.current.exportWord();
    });

    expect(savePdfFromHtml).toHaveBeenCalledWith(
      expect.stringContaining('创意草案'),
      expect.stringContaining('<!doctype html>'),
    );
    expect(savePdfFromHtml).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('kb-export-alert-warning'),
    );
    expect(savePdfFromHtml).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('<strong>粗体</strong>'),
    );
    expect(savePdfFromHtml).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('<code>代码</code>'),
    );
    expect(savePdfFromHtml).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('class="kb-doc-mention">@关联文档</span>'),
    );
    expect(saveBinary).toHaveBeenCalledTimes(1);
    const [wordFileName, wordBytes] = saveBinary.mock.calls[0] as [string, Uint8Array];
    expect(wordFileName).toContain('创意草案');
    expect(ArrayBuffer.isView(wordBytes)).toBe(true);
    expect(wordBytes[0]).toBe(0x50);
    expect(wordBytes[1]).toBe(0x4b);
  });
});

afterEach(() => {
  window.workKnowlage = originalApi;
});
