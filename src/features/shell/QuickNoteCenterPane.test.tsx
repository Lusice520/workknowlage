import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { createFallbackDesktopApi } from '../../shared/lib/workKnowlageApi';
import { QuickNoteCenterPane } from './QuickNoteCenterPane';

const originalApi = window.workKnowlage;

afterEach(() => {
  window.workKnowlage = originalApi;
});

test('renders the selected quick note content in the center pane', async () => {
  const api = createFallbackDesktopApi();

  api.quickNotes.get = async (noteDate) => (
    noteDate === '2026-03-25'
      ? {
          id: 'quick-note-2026-03-25',
          noteDate,
          title: '3月25日快记',
          contentJson: JSON.stringify([
            {
              id: 'note-1',
              type: 'paragraph',
              props: {},
              content: [{ type: 'text', text: '昨天补一个待办', styles: {} }],
              children: [],
            },
          ]),
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        }
      : null
  );

  window.workKnowlage = api;

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
      onUploadFiles={vi.fn(async () => [])}
    />
  );

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '3月25日快记' })).toBeInTheDocument();
    expect(screen.getByText('昨天补一个待办')).toBeInTheDocument();
  });

  expect(screen.queryByText('Alpha Space')).not.toBeInTheDocument();
  expect(screen.getByText('每日快记')).toBeInTheDocument();
});

test('exposes a quick-note capture action in the header', async () => {
  const handleCaptureQuickNote = vi.fn(async () => null);
  const api = createFallbackDesktopApi();

  api.quickNotes.get = async (noteDate) => (
    noteDate === '2026-03-25'
      ? {
          id: 'quick-note-2026-03-25',
          noteDate,
          title: '3月25日快记',
          contentJson: JSON.stringify([]),
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        }
      : null
  );

  window.workKnowlage = api;

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
      onCaptureQuickNote={handleCaptureQuickNote}
      onUploadFiles={vi.fn(async () => [])}
    />
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '沉淀为文档' })).toBeInTheDocument();
  });

  await act(async () => {
    screen.getByRole('button', { name: '沉淀为文档' }).click();
  });

  expect(handleCaptureQuickNote).toHaveBeenCalledWith('2026-03-25');
});
