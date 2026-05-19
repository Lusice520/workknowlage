import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

test('registers Univer sheet locale and worker prerequisites', () => {
  const sourcePath = path.resolve(__dirname, 'SpreadsheetEditorHost.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');

  expect(source).toContain("@univerjs/preset-sheets-core/locales/zh-CN");
  expect(source).toContain('[LocaleType.ZH_CN]: sheetsCoreZhCN');
  expect(source).toContain("@univerjs/preset-sheets-core/worker");
  expect(source).toContain('workerURL: nextRpcWorker');
});
