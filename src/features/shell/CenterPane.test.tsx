import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { DocumentRecord } from '../../shared/types/workspace';
import { CenterPane } from './CenterPane';

vi.mock('../editor-host/EditorHost', () => ({
  EditorHost: () => <div data-testid="blocknote-editor-host" />,
}));

vi.mock('../spreadsheet/SpreadsheetEditorHost', () => ({
  SpreadsheetEditorHost: () => <div data-testid="spreadsheet-editor-host" />,
}));

const createDocument = (overrides: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'doc-1',
  spaceId: 'space-1',
  folderId: null,
  title: '无标题表格',
  kind: 'spreadsheet',
  contentJson: '[]',
  updatedAtLabel: '刚刚',
  wordCountLabel: '0 字',
  badgeLabel: '',
  outline: [],
  tags: [],
  backlinks: [],
  sections: [],
  ...overrides,
});

const renderCenterPane = (activeDocument: DocumentRecord, overrides: Partial<Parameters<typeof CenterPane>[0]> = {}) => render(
  <CenterPane
    activeDocument={activeDocument}
    activeQuickNoteDate={null}
    selectedQuickNoteDate="2026-05-19"
    activeFolder={null}
    activeSpace={{ id: 'space-1', name: '默认空间', label: 'WORKSPACE' }}
    activeCollectionView="tree"
    documents={[activeDocument]}
    folders={[]}
    trashItems={[]}
    onSaveDocumentContent={vi.fn().mockResolvedValue(undefined)}
    onLoadSpreadsheetWorkbook={vi.fn().mockResolvedValue(null)}
    onSaveSpreadsheetWorkbook={vi.fn().mockResolvedValue({
      documentId: activeDocument.id,
      workbookJson: '{}',
    })}
    onSaveQuickNoteContent={vi.fn().mockResolvedValue(null)}
    onCaptureQuickNote={vi.fn().mockResolvedValue(null)}
    onUploadFiles={vi.fn().mockResolvedValue([])}
    onUploadQuickNoteFiles={vi.fn().mockResolvedValue([])}
    onOpenDocument={vi.fn()}
    onSetDocumentFavorite={vi.fn().mockResolvedValue(undefined)}
    onRestoreTrashItem={vi.fn().mockResolvedValue(undefined)}
    onDeleteTrashItem={vi.fn().mockResolvedValue(undefined)}
    onEmptyTrash={vi.fn().mockResolvedValue(undefined)}
    onShareDocument={vi.fn().mockResolvedValue(undefined)}
    onSharePublicDocument={vi.fn().mockResolvedValue(undefined)}
    onRegenerateShareDocument={vi.fn().mockResolvedValue(undefined)}
    onDisableShareDocument={vi.fn().mockResolvedValue(undefined)}
    onDisablePublicShareDocument={vi.fn().mockResolvedValue(undefined)}
    onExportMarkdown={vi.fn().mockResolvedValue(undefined)}
    onExportPdf={vi.fn().mockResolvedValue(undefined)}
    onExportSpreadsheet={vi.fn().mockResolvedValue(undefined)}
    onExportWord={vi.fn().mockResolvedValue(undefined)}
    exportBusy={false}
    {...overrides}
  />,
);

test('routes spreadsheet documents to the spreadsheet host without note-only share tools', async () => {
  renderCenterPane(createDocument());

  expect(await screen.findByTestId('spreadsheet-editor-host')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByTestId('blocknote-editor-host')).not.toBeInTheDocument();
  });
  expect(screen.queryByRole('button', { name: '分享' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  expect(screen.getByRole('menuitem', { name: '导出 Excel' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: '导出 Markdown' })).not.toBeInTheDocument();
  expect(screen.getByTestId('document-title-area')).toHaveAttribute('data-title-layout', 'compact-spreadsheet');
});

test('shows local and temporary public share actions for note documents', async () => {
  const onShareDocument = vi.fn().mockResolvedValue(undefined);
  const onSharePublicDocument = vi.fn().mockResolvedValue(undefined);
  renderCenterPane(createDocument({
    kind: 'note',
    title: '分享测试文档',
  }), {
    onShareDocument,
    onSharePublicDocument,
  });

  expect(await screen.findByTestId('blocknote-editor-host')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '分享' }));
  expect(screen.getByRole('menuitem', { name: '开启局域分享' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '临时公网分享 30 分钟' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '临时公网分享 1 小时' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '临时公网分享 今天内' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '临时公网分享 手动关闭' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('menuitem', { name: '临时公网分享 1 小时' }));
  await waitFor(() => {
    expect(onSharePublicDocument).toHaveBeenCalledWith(
      'doc-1',
      '[]',
      expect.objectContaining({ expiresAt: expect.any(String) }),
    );
  });
});

test('shows share progress in the title capsule while share actions are busy', async () => {
  renderCenterPane(createDocument({
    kind: 'note',
    title: '分享状态文档',
  }), {
    shareBusy: true,
    shareStatusText: '正在生成公网链接...',
  });

  expect(await screen.findByText('正在生成公网链接...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '分享' })).toBeDisabled();
});

test('copies and resets temporary public links after a public share exists', async () => {
  const onCopyPublicShareLinkWithPassword = vi.fn().mockResolvedValue(undefined);
  const onSharePublicDocument = vi.fn().mockResolvedValue(undefined);
  renderCenterPane(createDocument({
    kind: 'note',
    title: '公网分享文档',
  }), {
    shareInfo: {
      token: 'local-token',
      enabled: false,
      publicToken: 'public-token',
      publicEnabled: true,
      publicUrl: 'https://demo.trycloudflare.com/public/share/public-token',
      publicExpiresAt: '2026-05-21T12:00:00.000Z',
    },
    shareStatusText: '临时公网分享已开启',
    shareCanCopyPublicPassword: true,
    onCopyPublicShareLinkWithPassword,
    onSharePublicDocument,
  });

  expect(await screen.findByTestId('blocknote-editor-host')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '分享' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '复制公网链接和密码' }));

  await waitFor(() => {
    expect(onCopyPublicShareLinkWithPassword).toHaveBeenCalled();
  });

  fireEvent.click(screen.getByRole('button', { name: '分享' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '重置公网链接和密码' }));

  await waitFor(() => {
    expect(onSharePublicDocument).toHaveBeenCalledWith('doc-1', '[]', {
      expiresAt: '2026-05-21T12:00:00.000Z',
    });
  });
});
