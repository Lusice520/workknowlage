import fs from 'node:fs';
import path from 'node:path';

test('documents the RichTable user contract and browser regression matrix', () => {
  const matrixPath = path.resolve(
    __dirname,
    '../../../docs/plans/2026-04-05-rich-table-browser-regression-matrix.md'
  );
  const matrix = fs.readFileSync(matrixPath, 'utf8');

  expect(matrix).toContain('page scroll with active table');
  expect(matrix).toContain('editor scroll with active table');
  expect(matrix).toContain('toolbar visibility and anchor semantics');
  expect(matrix).toContain('add-row and add-col affordances');
  expect(matrix).toContain('rounded corners');
  expect(matrix).toContain('equal-width action');
  expect(matrix).toContain('merged-cell guardrail');
});

test('RichTable exposes one overlay render entry point and the overlay host adapter', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('useRichTableCommands');
  expect(source).toContain('useRichTableOverlayModel');
  expect(source).toContain('<RichTableOverlay');
  expect(source).toContain('getRichTableTableMinWidth');
  expect(source).toContain('RICH_TABLE_COL_EDGE_ACTION_LANE_WIDTH');
  expect(source).toContain('--rt-table-min-width');
  expect(source).toContain('--rt-col-edge-lane-width');
  expect(source).not.toContain('createPortal(');
  expect(source).not.toContain('document.body');
});

test('overlay model state owns toolbar position and add-col visibility', () => {
  const sourcePath = path.resolve(__dirname, 'useRichTableOverlayModel.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain('toolbarViewportPosition');
  expect(source).toContain('addColVisible');
  expect(source).toContain('editorClip');
});
