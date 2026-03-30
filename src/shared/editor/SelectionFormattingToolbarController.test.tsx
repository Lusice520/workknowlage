import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SelectionFormattingToolbarController } from './SelectionFormattingToolbarController';

const useEditorStateMock = vi.fn();
const useExtensionMock = vi.fn();
const useExtensionStateMock = vi.fn();

vi.mock('./blocknoteReactNoComments', () => ({
  PositionPopover: ({ children }: { children?: ReactNode }) => (
    <div data-testid="formatting-toolbar-controller">
      {children ? 'custom-toolbar' : 'default-toolbar'}
    </div>
  ),
  useEditorState: (options: unknown) => useEditorStateMock(options),
  useExtension: (options: unknown) => useExtensionMock(options),
  useExtensionState: (options: unknown) => useExtensionStateMock(options),
}));

test('does not mount the formatting toolbar controller while no text selection is active', () => {
  useExtensionMock.mockReturnValue({ store: { setState: vi.fn(), state: true } });
  useExtensionStateMock.mockReturnValue(true);
  useEditorStateMock
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce('left');

  render(
    <SelectionFormattingToolbarController
      editor={{} as any}
      formattingToolbar={() => null}
    />
  );

  expect(screen.queryByTestId('formatting-toolbar-controller')).not.toBeInTheDocument();
});

test('mounts the formatting toolbar controller only when a text selection is active', () => {
  useExtensionMock.mockReturnValue({ store: { setState: vi.fn(), state: true } });
  useExtensionStateMock.mockReturnValue(true);
  useEditorStateMock
    .mockReturnValueOnce(true)
    .mockReturnValueOnce({ from: 1, to: 3 })
    .mockReturnValueOnce('left');

  render(
    <SelectionFormattingToolbarController
      editor={{} as any}
      formattingToolbar={() => null}
    />
  );

  expect(screen.getByTestId('formatting-toolbar-controller')).toHaveTextContent('custom-toolbar');
});
