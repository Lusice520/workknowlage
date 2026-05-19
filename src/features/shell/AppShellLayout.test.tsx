import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../app/App';

vi.mock('../spreadsheet/SpreadsheetEditorHost', () => ({
  SpreadsheetEditorHost: () => <div data-testid="spreadsheet-editor-host" />,
}));

test('renders a locked lightweight shell with compact typography markers', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  expect(screen.getByTestId('app-shell')).toHaveAttribute('data-scroll-mode', 'locked');
  expect(screen.getByTestId('app-shell')).toHaveAttribute('data-shell-style', 'lightweight');
  expect(screen.getByTestId('app-shell')).toHaveAttribute('data-typography', 'editorial-compact');
  expect(screen.getByTestId('center-pane')).toHaveAttribute('data-pane-density', 'compact');
});

test('lets spreadsheet documents use the right sidebar space', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('right-sidebar')).toBeInTheDocument();
  });

  const sidebar = screen.getByTestId('left-sidebar');
  fireEvent.click(within(sidebar).getByRole('button', { name: '根目录新建操作' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '新建 Excel' }));

  await waitFor(() => {
    expect(screen.getByTestId('spreadsheet-editor-host')).toBeInTheDocument();
  });

  expect(screen.queryByTestId('right-sidebar')).not.toBeInTheDocument();
  expect(screen.queryByText('文稿概览')).not.toBeInTheDocument();
});
