import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const surfacePath = path.resolve(__dirname, 'SharedBlockNoteSurface.tsx');
const source = fs.readFileSync(surfacePath, 'utf8');

test('keeps SharedBlockNoteSurface as a small composition shell', () => {
  expect(source.split('\n').length).toBeLessThan(220);
  expect(source).toContain("from './SharedBlockNoteSearchPanel'");
  expect(source).toContain("from './useSharedBlockNoteSearch'");
  expect(source).toContain("from './useSharedBlockNoteUploads'");
  expect(source).toContain("from './useSharedBlockNoteImagePreview'");
  expect(source).toContain("from './useSharedBlockNoteKeyboardGuards'");
  expect(source).toContain("from './useSharedBlockNoteCursorVisibility'");
  expect(source).not.toContain('wk-editor-search-panel');
  expect(source).not.toContain('const handlePaste =');
  expect(source).not.toContain('const keydownHandler =');
});
