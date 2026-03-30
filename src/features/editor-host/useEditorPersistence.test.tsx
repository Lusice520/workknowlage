import { act, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { useEditorPersistence } from './useEditorPersistence';
import { serializeEditorDocument } from '../../shared/editor/blockAdapter';

vi.mock('../../shared/editor/blockAdapter', () => ({
  serializeEditorDocument: vi.fn(() => 'serialized-next-content'),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

type EditorChangeListener = () => void;

const createEditorStub = () => {
  let listener: EditorChangeListener | null = null;

  return {
    document: [{ id: 'block-1', type: 'paragraph', content: [] }],
    emitChange: () => {
      listener?.();
    },
    onChange: (nextListener: EditorChangeListener) => {
      listener = nextListener;
      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    },
  };
};

function HookHarness({
  debounceMs = 500,
  documentId = 'doc-1',
  editor,
  initialContentJson = '[]',
  onSaveDocumentContent,
}: {
  debounceMs?: number;
  documentId?: string;
  editor: ReturnType<typeof createEditorStub>;
  initialContentJson?: string;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
}) {
  const saveStatus = useEditorPersistence({
    debounceMs,
    documentId,
    editor,
    initialContentJson,
    onSaveDocumentContent,
  });

  return <div data-testid="save-status">{saveStatus}</div>;
}

test('coalesces rapid editor changes and serializes only once after the debounce window', async () => {
  vi.useFakeTimers();

  const editor = createEditorStub();
  const onSaveDocumentContent = vi.fn().mockResolvedValue(undefined);

  render(
    <HookHarness
      editor={editor}
      onSaveDocumentContent={onSaveDocumentContent}
    />
  );

  act(() => {
    editor.emitChange();
    editor.emitChange();
    editor.emitChange();
  });

  expect(screen.getByTestId('save-status')).toHaveTextContent('saving');
  expect(serializeEditorDocument).not.toHaveBeenCalled();
  expect(onSaveDocumentContent).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(499);
  });

  expect(serializeEditorDocument).not.toHaveBeenCalled();
  expect(onSaveDocumentContent).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });

  expect(serializeEditorDocument).toHaveBeenCalledTimes(1);
  expect(onSaveDocumentContent).toHaveBeenCalledTimes(1);
  expect(onSaveDocumentContent).toHaveBeenCalledWith('doc-1', 'serialized-next-content');
  expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
});

test('does not flip save status during IME composition', async () => {
  vi.useFakeTimers();

  const editor = {
    ...createEditorStub(),
    prosemirrorView: {
      composing: true,
    },
  };
  const onSaveDocumentContent = vi.fn().mockResolvedValue(undefined);

  render(
    <HookHarness
      editor={editor}
      onSaveDocumentContent={onSaveDocumentContent}
    />
  );

  act(() => {
    editor.emitChange();
  });

  expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
  expect(serializeEditorDocument).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });

  expect(serializeEditorDocument).toHaveBeenCalledTimes(1);
  expect(onSaveDocumentContent).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
});
