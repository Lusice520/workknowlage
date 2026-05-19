import { render, screen, waitFor } from '@testing-library/react';
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

const renderCenterPane = (activeDocument: DocumentRecord) => render(
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
    onRegenerateShareDocument={vi.fn().mockResolvedValue(undefined)}
    onDisableShareDocument={vi.fn().mockResolvedValue(undefined)}
    onExportMarkdown={vi.fn().mockResolvedValue(undefined)}
    onExportPdf={vi.fn().mockResolvedValue(undefined)}
    onExportWord={vi.fn().mockResolvedValue(undefined)}
    exportBusy={false}
  />,
);

test('routes spreadsheet documents to the spreadsheet host without note-only tools', async () => {
  renderCenterPane(createDocument());

  expect(await screen.findByTestId('spreadsheet-editor-host')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByTestId('blocknote-editor-host')).not.toBeInTheDocument();
  });
  expect(screen.queryByRole('button', { name: '分享' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '导出' })).not.toBeInTheDocument();
});
