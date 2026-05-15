import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

test('keeps BlockNote native table handles enabled for document editing', () => {
  const sourcePath = path.resolve(__dirname, 'EditorHost.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).not.toContain("disableExtensions: ['tableHandles']");
});
