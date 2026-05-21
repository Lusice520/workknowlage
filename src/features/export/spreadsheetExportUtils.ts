import JSZip from 'jszip';

type WorkbookRecord = Record<string, unknown>;
type CellRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is WorkbookRecord =>
  typeof value === 'object' && value !== null;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnNameFromIndex = (index: number) => {
  let value = Math.max(0, Math.floor(index)) + 1;
  let name = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
};

const safeSheetName = (name: unknown, fallback: string) => {
  const normalized = String(name || fallback)
    .replace(/[\][:*?/\\]/g, ' ')
    .trim()
    .slice(0, 31);

  return normalized || fallback;
};

const parseWorkbookJson = (workbookJson: string): WorkbookRecord => {
  const parsed = JSON.parse(workbookJson) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('表格数据格式无效');
  }

  return parsed;
};

const getSheetEntries = (workbook: WorkbookRecord) => {
  const sheets = isRecord(workbook.sheets) ? workbook.sheets : {};
  const sheetOrder = Array.isArray(workbook.sheetOrder)
    ? workbook.sheetOrder.filter((id): id is string => typeof id === 'string' && id in sheets)
    : [];
  const orderedIds = sheetOrder.length > 0 ? sheetOrder : Object.keys(sheets);

  return orderedIds
    .map((id, index) => {
      const sheet = sheets[id];
      return isRecord(sheet)
        ? {
          id,
          name: safeSheetName(sheet.name, `Sheet${index + 1}`),
          sheet,
        }
        : null;
    })
    .filter((entry): entry is { id: string; name: string; sheet: WorkbookRecord } => Boolean(entry));
};

const getCellValue = (cell: unknown) => {
  if (!isRecord(cell)) {
    return null;
  }

  const record = cell as CellRecord;
  if (record.v !== undefined && record.v !== null) {
    return record.v;
  }
  if (record.p !== undefined && record.p !== null) {
    return record.p;
  }

  return null;
};

const renderCellXml = (rowIndex: number, columnIndex: number, cell: unknown) => {
  const value = getCellValue(cell);
  if (value === null || value === '') {
    return '';
  }

  const ref = `${columnNameFromIndex(columnIndex)}${rowIndex + 1}`;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
};

const renderWorksheetXml = (sheet: WorkbookRecord) => {
  const cellData: WorkbookRecord = isRecord(sheet.cellData) ? sheet.cellData : {};
  const rowIndexes = Object.keys(cellData)
    .map((key) => Number(key))
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((left, right) => left - right);
  const rowsXml = rowIndexes.map((rowIndex) => {
    const rowValue = cellData[String(rowIndex)];
    const row: WorkbookRecord = isRecord(rowValue) ? rowValue : {};
    const cellIndexes = Object.keys(row)
      .map((key) => Number(key))
      .filter((index) => Number.isInteger(index) && index >= 0)
      .sort((left, right) => left - right);
    const cellsXml = cellIndexes
      .map((columnIndex) => renderCellXml(rowIndex, columnIndex, row[String(columnIndex)]))
      .filter(Boolean)
      .join('');

    return cellsXml ? `<row r="${rowIndex + 1}">${cellsXml}</row>` : '';
  }).filter(Boolean).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
};

export async function buildXlsxBytesFromWorkbookJson(workbookJson: string): Promise<Uint8Array> {
  const workbook = parseWorkbookJson(workbookJson);
  const sheetEntries = getSheetEntries(workbook);
  const sheets = sheetEntries.length > 0
    ? sheetEntries
    : [{
      id: 'sheet-1',
      name: 'Sheet1',
      sheet: { cellData: {} },
    }];
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n  ')}
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('\n    ')}
  </sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('\n  ')}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`);

  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, renderWorksheetXml(sheet.sheet));
  });

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Excel 导出失败：生成的文件不是有效的 XLSX');
  }

  return bytes;
}
