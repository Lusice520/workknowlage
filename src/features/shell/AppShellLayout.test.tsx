import { render, screen, waitFor } from '@testing-library/react';
import App from '../../app/App';

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
