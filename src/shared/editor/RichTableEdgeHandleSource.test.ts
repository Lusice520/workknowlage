import fs from 'node:fs';
import path from 'node:path';

test('keeps rich table edge handles visually attached to the table and extends their root hit area', () => {
  const sourcePath = path.resolve(__dirname, 'RichTable.tsx');
  const overlayModelPath = path.resolve(__dirname, 'useRichTableOverlayModel.ts');
  const geometryPath = path.resolve(__dirname, 'richTableToolbarPortal.ts');
  const cssPath = path.resolve(__dirname, 'RichTable.css');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const overlayModel = fs.readFileSync(overlayModelPath, 'utf8');
  const geometry = fs.readFileSync(geometryPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  expect(source).toContain('getRichTableTableMinWidth');
  expect(source).toContain('getRichTableTrackMinWidth');
  expect(source).toContain('updateTableGripPositions(cell);');
  expect(source).toContain('updateTableGripPositions();');
  expect(overlayModel).toContain('getRichTableEdgeHandleViewportPosition');
  expect(overlayModel).toContain('clampRichTableEdgeHandleViewportPosition');
  expect(overlayModel).toContain('intersectRichTableClipRects');
  expect(geometry).toContain('visualGap = 4');
  expect(geometry).toContain('clampRichTableEdgeHandleViewportPosition');
  expect(geometry).toContain('intersectRichTableClipRects');
  expect(css).toContain('.rt-add-col-handle::before,');
  expect(css).toContain('.rt-add-row-handle::before {');
  expect(css).toContain('pointer-events: auto;');
});
