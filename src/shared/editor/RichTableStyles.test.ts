import fs from 'node:fs';
import path from 'node:path';

test('styles rich table editor surface and edge handles like the WorkPlan implementation', () => {
  const cssPath = path.resolve(__dirname, 'RichTable.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(css).toContain('.rt-container {');
  expect(css).toContain('padding: 4px 0;');
  expect(css).toContain('.rt-editor-shell {');
  expect(css).toContain('min-height: 0;');
  expect(css).toContain('.rt-editor {');
  expect(css).toContain('.rt-editor .tableWrapper {');
  expect(css).toContain('.rt-editor ul {');
  expect(css).toContain('list-style-type: disc;');
  expect(css).toContain('.rt-editor ol {');
  expect(css).toContain('list-style-type: decimal;');
  expect(css).toContain('.rt-editor li {');
  expect(css).toContain('display: list-item;');
  expect(css).toContain('.rt-editor table {');
  expect(css).toContain('width: max(100%, max-content);');
  expect(css).toContain('.rt-editor th,');
  expect(css).toContain('.rt-editor td {');
  expect(css).toContain('border: 1px solid #e2e8f0;');
  expect(css).toContain('.rt-editor th {');
  expect(css).toContain('background: #f8fafc;');
  expect(css).toContain('.rt-container .bn-extend-button-add-remove-columns,');
  expect(css).toContain('.rt-container .bn-extend-button-add-remove-rows {');
  expect(css).toContain('display: none !important;');
  expect(css).toContain('.rt-table-grip.row {');
  expect(css).toContain('.rt-table-grip.col {');
  expect(css).toContain('.rt-add-col-handle {');
  expect(css).toContain('.rt-add-row-handle {');
});
