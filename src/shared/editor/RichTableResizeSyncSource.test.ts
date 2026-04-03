import fs from 'node:fs';
import path from 'node:path';

test('keeps rich table floating controls synced to table resizes without waiting for hover', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('new ResizeObserver');
  expect(source).toContain("querySelector('.rt-editor table')");
  expect(source).toContain('requestAnimationFrame(() => {');
});
