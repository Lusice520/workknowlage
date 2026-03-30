import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import React from 'react';

const prefetchQuickNoteRecord = vi.fn();
const cacheQuickNoteRecord = vi.fn();
const uploadFilesSpy = vi.fn();
const sharedSurfaceProps: { uploadFiles?: (files: File[]) => Promise<string[]> } = {};

vi.mock('../../shared/editor/blocknoteReactNoComments', () => ({
  useCreateBlockNote: () => ({}),
}));

vi.mock('../../shared/editor', () => ({
  SharedBlockNoteSurface: (props: { uploadFiles?: (files: File[]) => Promise<string[]> }) => {
    sharedSurfaceProps.uploadFiles = props.uploadFiles;
    return React.createElement('div', { 'data-testid': 'quick-note-surface' });
  },
  fromDocumentToInitialBlocks: () => [],
  kbSchema: {},
}));

vi.mock('../editor-host/useEditorPersistence', () => ({
  useEditorPersistence: () => 'saved',
}));

vi.mock('./quickNoteCache', () => ({
  prefetchQuickNoteRecord: (...args: unknown[]) => prefetchQuickNoteRecord(...args),
  cacheQuickNoteRecord: (...args: unknown[]) => cacheQuickNoteRecord(...args),
}));

import { QuickNoteCenterPane } from './QuickNoteCenterPane';

afterEach(() => {
  prefetchQuickNoteRecord.mockReset();
  cacheQuickNoteRecord.mockReset();
  uploadFilesSpy.mockReset();
  sharedSurfaceProps.uploadFiles = undefined;
});

test('wires quick-note uploads into the shared editor surface with the persisted note id', async () => {
  prefetchQuickNoteRecord.mockResolvedValue({
    id: 'quick-note-2026-03-25',
    noteDate: '2026-03-25',
    title: '3月25日快记',
    contentJson: '[]',
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  });
  uploadFilesSpy.mockResolvedValue(['/uploads/quick-note-2026-03-25/inline-image.png']);

  render(
    <QuickNoteCenterPane
      noteDate="2026-03-25"
      onSaveQuickNoteContent={vi.fn(async (_noteDate, contentJson) => ({
        id: 'quick-note-2026-03-25',
        noteDate: '2026-03-25',
        title: '3月25日快记',
        contentJson,
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      }))}
      onCaptureQuickNote={vi.fn(async () => null)}
      onUploadFiles={uploadFilesSpy}
    />
  );

  await waitFor(() => {
    expect(sharedSurfaceProps.uploadFiles).toBeTypeOf('function');
  });

  const file = new File(['image'], 'inline-image.png', { type: 'image/png' });
  await act(async () => {
    await sharedSurfaceProps.uploadFiles?.([file]);
  });

  expect(uploadFilesSpy).toHaveBeenCalledWith('quick-note-2026-03-25', [file]);
});

test('persists a new quick note before uploading assets when the day has no stored note yet', async () => {
  prefetchQuickNoteRecord.mockResolvedValue(null);
  uploadFilesSpy.mockResolvedValue(['/uploads/quick-note-2026-03-26/inline-image.png']);
  const handleSaveQuickNoteContent = vi.fn(async (_noteDate, contentJson) => ({
    id: 'quick-note-2026-03-26',
    noteDate: '2026-03-26',
    title: '3月26日快记',
    contentJson,
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
  }));

  render(
    <QuickNoteCenterPane
      noteDate="2026-03-26"
      onSaveQuickNoteContent={handleSaveQuickNoteContent}
      onCaptureQuickNote={vi.fn(async () => null)}
      onUploadFiles={uploadFilesSpy}
    />
  );

  await waitFor(() => {
    expect(sharedSurfaceProps.uploadFiles).toBeTypeOf('function');
  });

  const file = new File(['image'], 'inline-image.png', { type: 'image/png' });
  await act(async () => {
    await sharedSurfaceProps.uploadFiles?.([file]);
  });

  expect(handleSaveQuickNoteContent).toHaveBeenCalledWith('2026-03-26', '[]');
  expect(uploadFilesSpy).toHaveBeenCalledWith('quick-note-2026-03-26', [file]);
});
