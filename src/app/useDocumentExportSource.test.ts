import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const sourcePath = path.resolve(__dirname, './useDocumentExport.ts');

describe('useDocumentExport source', () => {
  test('loads export helpers through statically analyzable dynamic imports', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("import('../features/export/exportUtils')");
    expect(source).toContain("import('../features/export/docxExportUtils')");
    expect(source).not.toContain("new Function('specifier'");
  });
});
