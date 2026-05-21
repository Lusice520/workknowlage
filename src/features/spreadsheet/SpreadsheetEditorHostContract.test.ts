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

test('replaces the Univer ribbon row with a toolbar-left dropdown entry', () => {
  const cssPath = path.resolve(__dirname, 'SpreadsheetEditor.css');
  const source = fs.readFileSync(cssPath, 'utf8');

  expect(source).toContain('.wk-spreadsheet-ribbon-picker');
  expect(source).toContain('.wk-univer-ribbon-row');
  expect(source).toContain('height: 0 !important;');
  expect(source).toContain('.wk-univer-toolbar-row');
  expect(source).toContain('padding-left: 112px !important;');
});
