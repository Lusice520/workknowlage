import fs from 'node:fs';
import path from 'node:path';

test('keeps rich table edge handles visually attached to the table and extends their root hit area', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const geometryPath = path.resolve(__dirname, 'richTableToolbarPortal.ts');
  const cssPath = path.resolve(__dirname, 'RichTable.css');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const geometry = fs.readFileSync(geometryPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(source).toContain('getRichTableEdgeHandleViewportPosition');
  expect(geometry).toContain('visualGap = 4');
  expect(css).toContain('.rt-add-col-handle::before,');
  expect(css).toContain('.rt-add-row-handle::before {');
  expect(css).toContain('pointer-events: auto;');
});
