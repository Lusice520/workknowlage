import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { WorkKnowlageDesktopApi } from '../../shared/types/preload';
import { ExternalFileApp } from './ExternalFileApp';

type ExternalFilesApi = NonNullable<WorkKnowlageDesktopApi['externalFiles']>;
type EditorChangeListener = () => void;

let changeListener: EditorChangeListener | null = null;
const mockEditor = {
  document: [
    {
      id: 'initial',
      type: 'paragraph',
      content: [{ type: 'text', text: '', styles: {} }],
      children: [],
    },
  ],
  prosemirrorView: { composing: false },
  tryParseMarkdownToBlocks: vi.fn(() => [
    {
      id: 'heading-roadmap',
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Roadmap', styles: {} }],
      children: [],
    },
    {
      id: 'paragraph-body',
      type: 'paragraph',
      content: [{ type: 'text', text: '正文内容', styles: {} }],
      children: [],
    },
  ]),
  replaceBlocks: vi.fn((_oldBlocks, nextBlocks) => {
    mockEditor.document = nextBlocks;
  }),
  blocksToMarkdownLossy: vi.fn(() => '# Roadmap\n\n正文内容'),
  onChange: vi.fn((listener: EditorChangeListener) => {
    changeListener = listener;
    return () => {
      if (changeListener === listener) {
        changeListener = null;
      }
    };
  }),
};

vi.mock('../../shared/editor', () => ({
  SharedBlockNoteSurface: () => <div data-testid="external-editor-surface">Mock BlockNote</div>,
  kbSchema: {},
  serializeEditorDocument: (blocks: unknown) => JSON.stringify(blocks),
}));

vi.mock('../../shared/editor/blocknoteReactNoComments', () => ({
  useCreateBlockNote: () => mockEditor,
}));

vi.mock('../../shared/editor/numberedListHydrationExtension', () => ({
  NumberedListHydrationExtension: {},
}));

const createApi = (overrides: Partial<ExternalFilesApi> = {}) => ({
  externalFiles: {
    getInitial: vi.fn().mockResolvedValue({
      filePath: '/Users/lusice/Desktop/Roadmap.md',
      title: 'Roadmap',
      markdown: '# Roadmap\n\n正文内容',
      updatedAt: '2026-05-20T06:00:00.000Z',
      updatedAtLabel: '修改 5月20日 14:00',
    }),
    saveMarkdown: vi.fn().mockResolvedValue({
      filePath: '/Users/lusice/Desktop/Roadmap.md',
      title: 'Roadmap',
      markdown: '# Roadmap\n\n正文内容 updated',
      updatedAt: '2026-05-20T06:01:00.000Z',
      updatedAtLabel: '修改 5月20日 14:01',
    }),
    revealInFinder: vi.fn().mockResolvedValue(true),
    importToWorkspace: vi.fn().mockResolvedValue({
      success: true,
      message: '已导入知识库',
      document: { id: 'doc-imported', title: 'Roadmap' },
    }),
    ...overrides,
  },
}) as unknown as WorkKnowlageDesktopApi;

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  changeListener = null;
  mockEditor.document = [
    {
      id: 'initial',
      type: 'paragraph',
      content: [{ type: 'text', text: '', styles: {} }],
      children: [],
    },
  ];
  mockEditor.blocksToMarkdownLossy.mockReturnValue('# Roadmap\n\n正文内容');
  window.workKnowlage = createApi();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.workKnowlage;
});

test('renders external file metadata, left outline, and top-right actions', async () => {
  render(<ExternalFileApp externalFilesApi={window.workKnowlage!.externalFiles} />);

  expect(await screen.findByRole('heading', { name: 'Roadmap' })).toBeInTheDocument();
  expect(screen.getByText('外部文件')).toBeInTheDocument();
  expect(screen.getByText('/Users/lusice/Desktop/Roadmap.md')).toBeInTheDocument();
  expect(screen.getByText('修改 5月20日 14:00')).toBeInTheDocument();
  expect(screen.getByText('11 字')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: '外部文件目录' })).toHaveTextContent('Roadmap');
  expect(screen.getByRole('button', { name: '在 Finder 中显示' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导入知识库' })).toBeInTheDocument();
  expect(screen.queryByText('Wiki')).not.toBeInTheDocument();
  expect(screen.getByTestId('external-editor-surface')).toBeInTheDocument();
});

test('autosaves editor changes back to Markdown after hydration', async () => {
  const api = window.workKnowlage!;

  render(<ExternalFileApp externalFilesApi={window.workKnowlage!.externalFiles} />);
  await screen.findByRole('heading', { name: 'Roadmap' });
  await waitFor(() => {
    expect(mockEditor.onChange).toHaveBeenCalled();
  });
  vi.useFakeTimers();

  expect(api.externalFiles?.saveMarkdown).not.toHaveBeenCalled();
  mockEditor.blocksToMarkdownLossy.mockReturnValue('# Roadmap\n\n正文内容 updated');

  act(() => {
    changeListener?.();
  });
  expect(screen.getByText('正在自动保存...')).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  await act(async () => {
    await Promise.resolve();
  });

  expect(api.externalFiles?.saveMarkdown).toHaveBeenCalledWith('# Roadmap\n\n正文内容 updated');
  expect(screen.getByText('已自动保存')).toBeInTheDocument();
  expect(screen.getByText('修改 5月20日 14:01')).toBeInTheDocument();
});

test('preserves YAML frontmatter when autosaving external Markdown edits', async () => {
  const api = createApi({
    getInitial: vi.fn().mockResolvedValue({
      filePath: '/Users/lusice/Desktop/Roadmap.md',
      title: 'Roadmap',
      markdown: '---\ntitle: Roadmap\ntags:\n  - work\n---\n\n# Roadmap\n\n正文内容',
      updatedAt: '2026-05-20T06:00:00.000Z',
      updatedAtLabel: '修改 5月20日 14:00',
    }),
  });
  window.workKnowlage = api;

  render(<ExternalFileApp externalFilesApi={api.externalFiles} />);
  await screen.findByRole('heading', { name: 'Roadmap' });
  await waitFor(() => {
    expect(mockEditor.onChange).toHaveBeenCalled();
  });
  vi.useFakeTimers();

  mockEditor.blocksToMarkdownLossy.mockReturnValue('# Roadmap\n\n正文内容 updated');

  act(() => {
    changeListener?.();
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  expect(api.externalFiles?.saveMarkdown).toHaveBeenCalledWith(
    '---\ntitle: Roadmap\ntags:\n  - work\n---\n\n# Roadmap\n\n正文内容 updated',
  );
});

test('top actions reveal in Finder and import current editor content', async () => {
  const user = userEvent.setup();
  const api = window.workKnowlage!;

  render(<ExternalFileApp externalFilesApi={window.workKnowlage!.externalFiles} />);
  await screen.findByRole('heading', { name: 'Roadmap' });

  await user.click(screen.getByRole('button', { name: '在 Finder 中显示' }));
  expect(api.externalFiles?.revealInFinder).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole('button', { name: '导入知识库' }));
  expect(api.externalFiles?.importToWorkspace).toHaveBeenCalledWith({
    title: 'Roadmap',
    contentJson: JSON.stringify(mockEditor.document),
  });
  expect(await screen.findByText('已导入知识库')).toBeInTheDocument();
});
