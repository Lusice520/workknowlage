import fs from 'node:fs';
import path from 'node:path';

test('moves the RichTable portal JSX into RichTableOverlay while RichTable becomes composition-only', () => {
  const overlayPath = path.resolve(__dirname, 'RichTableOverlay.tsx');
  const richTablePath = path.resolve(__dirname, 'RichTable.tsx');
  const overlaySource = fs.readFileSync(overlayPath, 'utf8');
  const richTableSource = fs.readFileSync(richTablePath, 'utf8');

  expect(overlaySource).toContain('createPortal(');
  expect(overlaySource).toContain('getRichTableOverlayHost');
  expect(overlaySource).toContain('rt-floating-controls-portal');
  expect(overlaySource).toContain('rt-top-toolbar-portal');
  expect(richTableSource).toContain('<RichTableOverlay');
  expect(richTableSource).not.toContain('createPortal(');
  expect(richTableSource).not.toContain('document.body');
});
