import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { buildXlsxBytesFromWorkbookJson } from './spreadsheetExportUtils';

describe('spreadsheetExportUtils', () => {
  test('builds a valid xlsx package from Univer workbook JSON', async () => {
    const bytes = await buildXlsxBytesFromWorkbookJson(JSON.stringify({
      sheetOrder: ['sheet-1'],
      sheets: {
        'sheet-1': {
          name: '预算/排期',
          cellData: {
            0: {
              0: { v: '项目' },
              1: { v: '金额' },
            },
            1: {
              0: { v: '设计' },
              1: { v: 1200 },
            },
          },
        },
      },
    }));

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(bytes);
    const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
    const worksheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');

    expect(workbookXml).toContain('name="预算 排期"');
    expect(worksheetXml).toContain('<c r="A1" t="inlineStr"><is><t>项目</t></is></c>');
    expect(worksheetXml).toContain('<c r="B2"><v>1200</v></c>');
  });
});
