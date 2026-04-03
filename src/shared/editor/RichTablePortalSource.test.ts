import fs from 'node:fs';
import path from 'node:path';

test('mounts the rich table toolbar and grips into body portals instead of the table block flow', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('createPortal(');
  expect(source).toContain('document.body');
  expect(source).toContain('className="rt-floating-controls-portal"');
  expect(source).toMatch(/className="rt-floating-controls-portal"[\s\S]*className="rt-add-col-handle"/);
  expect(source).toMatch(/className="rt-floating-controls-portal"[\s\S]*className="rt-add-row-handle"/);
  expect(source).not.toContain('className="rt-toolbar-overlay"');
});
