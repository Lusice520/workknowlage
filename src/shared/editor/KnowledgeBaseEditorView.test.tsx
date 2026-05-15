import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { KnowledgeBaseEditorView } from './KnowledgeBaseEditorView';

const createEditorStub = () => {
  const portalElement = document.createElement('div');
  const mount = vi.fn();
  const unmount = vi.fn();
  const onChange = vi.fn(() => () => undefined);
  const onSelectionChange = vi.fn(() => () => undefined);

  return {
    editor: {
      portalElement,
      mount,
      unmount,
      onChange,
      onSelectionChange,
      isEditable: undefined,
      elementRenderer: undefined,
      _tiptapEditor: {
        isDestroyed: false,
        state: { doc: { type: 'doc' } },
      },
    },
    mount,
    unmount,
    onChange,
    onSelectionChange,
    portalElement,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('mounts the editor with the BlockNote 0.48 theme contract on both container and portal', async () => {
  const { editor, mount, onChange, onSelectionChange, portalElement } = createEditorStub();

  render(
    <KnowledgeBaseEditorView
      editor={editor}
      className="shared-blocknote-surface"
    >
      <span>Editor child</span>
    </KnowledgeBaseEditorView>
  );

  const container = document.querySelector('.shared-blocknote-surface') as HTMLElement;
  expect(container).toBeTruthy();
  expect(container.className).toContain('bn-root');
  expect(container.className).toContain('bn-container');
  expect(container.className).toContain('bn-mantine');
  expect(container.className).toContain('light');
  expect(container.getAttribute('data-color-scheme')).toBe('light');
  expect(container.getAttribute('data-mantine-color-scheme')).toBe('light');

  await waitFor(() => {
    expect(portalElement.className).toContain('bn-root');
    expect(portalElement.className).toContain('bn-mantine');
    expect(portalElement.className).toContain('light');
    expect(portalElement.getAttribute('data-color-scheme')).toBe('light');
    expect(portalElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
  expect(mount).toHaveBeenCalledTimes(1);
  expect(mount).toHaveBeenCalledWith(expect.any(HTMLElement));
  expect(editor.isEditable).toBe(true);
  expect(typeof editor.elementRenderer).toBe('function');

  const mountedElement = mount.mock.calls[0]?.[0] as HTMLElement;
  expect(mountedElement).toBeTruthy();
  expect(mountedElement).toHaveAttribute('aria-autocomplete', 'list');
  expect(mountedElement).toHaveAttribute('aria-haspopup', 'listbox');

  const contentComponent = (editor._tiptapEditor as any).contentComponent as {
    subscribe?: () => void;
    getSnapshot?: () => Record<string, unknown>;
    setRenderer?: () => void;
    removeRenderer?: () => void;
  };

  expect(typeof contentComponent?.subscribe).toBe('function');
  expect(typeof contentComponent?.getSnapshot).toBe('function');
  expect(typeof contentComponent?.setRenderer).toBe('function');
  expect(typeof contentComponent?.removeRenderer).toBe('function');
  expect(screen.getByText('Editor child')).toBeInTheDocument();
});

test('unmounts the editor and marks it non-editable when editable is disabled', async () => {
  const { editor, mount, unmount } = createEditorStub();

  const { unmount: cleanup } = render(
    <KnowledgeBaseEditorView
      editor={editor}
      editable={false}
    />
  );

  await waitFor(() => {
    expect(mount).toHaveBeenCalledTimes(1);
    expect(editor.isEditable).toBe(false);
  });

  cleanup();

  expect(unmount).toHaveBeenCalledTimes(1);
});
