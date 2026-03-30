const TABLE_NODE_TYPE = 'table';
const TABLE_ROW_TYPE = 'tableRow';
const HEADER_CELL_TYPE = 'tableHeader';
const BODY_CELL_TYPE = 'tableCell';

const cloneDoc = (doc: any) => JSON.parse(JSON.stringify(doc || {}));

const createParagraphNode = (text = '') => {
  const value = String(text ?? '');
  return value
    ? { type: 'paragraph', content: [{ type: 'text', text: value }] }
    : { type: 'paragraph' };
};

const createEmptyCell = (rowIndex: number) => ({
  type: rowIndex === 0 ? HEADER_CELL_TYPE : BODY_CELL_TYPE,
  content: [{ type: 'paragraph' }],
});

const getTableNode = (doc: any) => {
  const content = Array.isArray(doc?.content) ? doc.content : [];
  return content.find((node: any) => node?.type === TABLE_NODE_TYPE) || null;
};

const HTML_MERGED_CELL_RE = /<(?:th|td)\b[^>]*(?:colspan|rowspan)\s*=\s*["']?\s*(\d+)/i;

const parseHtmlDocument = (html: string) => {
  const markup = String(html || '').trim();
  if (!markup || !/<table[\s>]/i.test(markup) || typeof DOMParser === 'undefined') return null;

  try {
    return new DOMParser().parseFromString(markup, 'text/html');
  } catch {
    return null;
  }
};

export const htmlTableHasMergedCells = (html: string) => {
  const markup = String(html || '').trim();
  const mergedMatch = markup.match(HTML_MERGED_CELL_RE);
  if (mergedMatch && Number(mergedMatch[1]) > 1) return true;

  const doc = parseHtmlDocument(markup);
  if (!doc) return false;

  return Array.from(doc.querySelectorAll('table th, table td')).some((cell) => {
    const colspan = Number(cell.getAttribute('colspan')) || 1;
    const rowspan = Number(cell.getAttribute('rowspan')) || 1;
    return colspan > 1 || rowspan > 1;
  });
};

const parseHtmlTableToMatrix = (html: string) => {
  const doc = parseHtmlDocument(html);
  if (!doc || htmlTableHasMergedCells(html)) return null;

  try {
    const rows = Array.from(doc.querySelectorAll('table tr'));
    if (rows.length === 0) return null;

    const matrix = rows.map((row: Element) => Array.from(row.querySelectorAll('th,td')).map((cell: Element) => cell.textContent?.trim?.() ?? ''));
    const maxColumns = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    if (maxColumns === 0) return null;

    return matrix.map((row) => Array.from({ length: maxColumns }, (_, columnIndex) => row[columnIndex] ?? ''));
  } catch {
    return null;
  }
};

const isMarkdownDividerCell = (value: string) => /^:?-{3,}:?$/.test(String(value || '').trim());

const parsePipeTableText = (text: string) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;
  if (!lines.every((line) => line.includes('|'))) return null;
  if (!lines.every((line) => line.startsWith('|') || line.endsWith('|'))) return null;

  const rows = lines.map((line) => {
    const normalized = line.replace(/^\|/, '').replace(/\|$/, '');
    return normalized.split('|').map((cell) => cell.trim());
  });
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxColumns < 2) return null;

  const dividerIndex = rows.findIndex((row) => row.length > 0 && row.every(isMarkdownDividerCell));
  if (dividerIndex !== 1) return null;
  const contentRows = rows.filter((_, index) => index !== dividerIndex);
  if (contentRows.length === 0) return null;

  return contentRows.map((row) => Array.from({ length: maxColumns }, (_, columnIndex) => row[columnIndex] ?? ''));
};

export const parseClipboardTable = ({ text = '', html = '' }: { text?: string; html?: string } = {}) => {
  const normalizedText = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (htmlTableHasMergedCells(html)) return null;

  const hasHtmlTable = /<table[\s>]/i.test(String(html || ''));
  const htmlMatrix = parseHtmlTableToMatrix(html);
  if (htmlMatrix) return htmlMatrix;

  const pipeTableMatrix = parsePipeTableText(normalizedText);
  if (pipeTableMatrix) return pipeTableMatrix;

  const looksLikeGrid = normalizedText.includes('\t');
  if (!looksLikeGrid && !hasHtmlTable) return null;

  const rawRows = normalizedText.split('\n');
  while (rawRows.length > 0 && rawRows[rawRows.length - 1] === '') {
    rawRows.pop();
  }

  if (rawRows.length === 0) return null;

  const rows = rawRows.map((row) => (looksLikeGrid ? row.split('\t') : [row]));
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxColumns === 0) return null;
  if (rows.length === 1 && maxColumns === 1) return null;

  return rows.map((row) => Array.from({ length: maxColumns }, (_, columnIndex) => row[columnIndex] ?? ''));
};

export const tableDocHasMergedCells = (doc: any) => {
  const table = getTableNode(doc);
  if (!table) return false;

  const rows = Array.isArray(table.content) ? table.content : [];
  return rows.some((row: any) => {
    const cells = Array.isArray(row?.content) ? row.content : [];
    return cells.some((cell: any) => {
      const colspan = Number(cell?.attrs?.colspan) || 1;
      const rowspan = Number(cell?.attrs?.rowspan) || 1;
      return colspan > 1 || rowspan > 1;
    });
  });
};

export const applyClipboardTableToDoc = (doc: any, { startRow = 0, startCol = 0, matrix = [] }: { startRow?: number; startCol?: number; matrix?: string[][] } = {}) => {
  if (!Array.isArray(matrix) || matrix.length === 0) return null;

  const nextDoc = cloneDoc(doc);
  const table = getTableNode(nextDoc);
  if (!table) return null;

  const rows = Array.isArray(table.content) ? table.content : [];
  const maxPasteColumns = matrix.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  if (maxPasteColumns === 0) return null;

  const requiredRowCount = startRow + matrix.length;
  const requiredColCount = startCol + maxPasteColumns;

  while (rows.length < requiredRowCount) {
    const rowIndex = rows.length;
    rows.push({
      type: TABLE_ROW_TYPE,
      content: Array.from({ length: requiredColCount }, () => createEmptyCell(rowIndex)),
    });
  }

  rows.forEach((row: any, rowIndex: number) => {
    const cells = Array.isArray(row?.content) ? row.content : [];
    while (cells.length < requiredColCount) {
      cells.push(createEmptyCell(rowIndex));
    }
    row.content = cells;
  });

  matrix.forEach((rowValues, rowOffset) => {
    const targetRow = rows[startRow + rowOffset];
    const cells = Array.isArray(targetRow?.content) ? targetRow.content : [];

    rowValues.forEach((cellText, colOffset) => {
      const targetIndex = startCol + colOffset;
      const existingCell = cells[targetIndex] || createEmptyCell(startRow + rowOffset);
      cells[targetIndex] = {
        ...existingCell,
        content: [createParagraphNode(cellText)],
      };
    });
  });

  table.content = rows;
  return nextDoc;
};
