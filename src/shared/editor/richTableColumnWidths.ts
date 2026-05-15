import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { TableMap } from 'prosemirror-tables';
import { RICH_TABLE_MIN_COLUMN_WIDTH } from './richTableLayout';

interface GetRichTableEqualColumnWidthInput {
  columnCount: number;
  minimumWidth?: number;
  tableWidth: number;
}

interface BuildEqualizedRichTableColumnTransactionInput {
  state: EditorState;
  table: ProseMirrorNode;
  tableStart: number;
  targetWidth: number;
}

interface BuildNormalizedRichTableColumnWidthTransactionInput {
  fallbackWidth?: number;
  state: EditorState;
  table: ProseMirrorNode;
  tableStart: number;
}

const createZeroWidths = (length: number) => Array.from({ length }, () => 0);

const arraysEqual = (left: number[] | null | undefined, right: number[] | null | undefined) => {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return left === right;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

const resolveMissingTableColumnWidths = (table: ProseMirrorNode, fallbackWidth: number) => {
  const map = TableMap.get(table);
  const widths: Array<number | null> = Array.from({ length: map.width }, () => null);

  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      const mapIndex = row * map.width + col;
      if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) {
        continue;
      }
      if (col > 0 && map.map[mapIndex] === map.map[mapIndex - 1]) {
        continue;
      }

      const pos = map.map[mapIndex];
      const cell = table.nodeAt(pos);
      if (!cell) continue;

      const attrs = cell.attrs as {
        colspan?: number;
        colwidth?: number[] | null;
      };
      const colspan = Math.max(1, Number(attrs.colspan) || 1);

      for (let offset = 0; offset < colspan; offset += 1) {
        const width = Array.isArray(attrs.colwidth) ? attrs.colwidth[offset] : null;
        if (typeof width === 'number' && Number.isFinite(width) && width > 0 && widths[col + offset] == null) {
          widths[col + offset] = width;
        }
      }
    }
  }

  return widths.map((width, index) => {
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      return width;
    }

    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestWidth: number | null = null;

    for (let probe = 0; probe < widths.length; probe += 1) {
      const candidate = widths[probe];
      if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate <= 0) {
        continue;
      }

      const distance = Math.abs(probe - index);
      if (distance < nearestDistance || (distance === nearestDistance && probe < index)) {
        nearestDistance = distance;
        nearestWidth = candidate;
      }
    }

    return nearestWidth ?? fallbackWidth;
  });
};

export const getRichTableEqualColumnWidth = ({
  tableWidth,
  columnCount,
  minimumWidth = 25,
}: GetRichTableEqualColumnWidthInput) => {
  const normalizedColumnCount = Math.max(1, Math.floor(columnCount || 1));
  const normalizedTableWidth = Math.max(0, Math.floor(tableWidth || 0));
  return Math.max(minimumWidth, Math.floor(normalizedTableWidth / normalizedColumnCount));
};

export const buildEqualizedRichTableColumnTransaction = ({
  state,
  table,
  tableStart,
  targetWidth,
}: BuildEqualizedRichTableColumnTransactionInput): Transaction => {
  const map = TableMap.get(table);
  const tr = state.tr;
  const tableContentStart = tableStart + 1;

  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      const mapIndex = row * map.width + col;
      if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) {
        continue;
      }

      const pos = map.map[mapIndex];
      const cell = table.nodeAt(pos);
      if (!cell) continue;

      const attrs = cell.attrs as {
        colspan?: number;
        colwidth?: number[] | null;
      };
      const colspan = Math.max(1, Number(attrs.colspan) || 1);
      const columnOffset = colspan === 1 ? 0 : col - map.colCount(pos);
      const currentWidth = Array.isArray(attrs.colwidth) ? attrs.colwidth[columnOffset] : null;
      if (currentWidth === targetWidth) {
        continue;
      }

      const colwidth = Array.isArray(attrs.colwidth)
        ? attrs.colwidth.slice()
        : createZeroWidths(colspan);
      colwidth[columnOffset] = targetWidth;

      tr.setNodeMarkup(tableContentStart + pos, null, {
        ...attrs,
        colwidth,
      });
    }
  }

  return tr;
};

export const buildNormalizedRichTableColumnWidthTransaction = ({
  fallbackWidth = RICH_TABLE_MIN_COLUMN_WIDTH,
  state,
  table,
  tableStart,
}: BuildNormalizedRichTableColumnWidthTransactionInput): Transaction => {
  const map = TableMap.get(table);
  const tr = state.tr;
  const tableContentStart = tableStart + 1;
  const resolvedWidths = resolveMissingTableColumnWidths(table, fallbackWidth);

  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      const mapIndex = row * map.width + col;
      if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) {
        continue;
      }
      if (col > 0 && map.map[mapIndex] === map.map[mapIndex - 1]) {
        continue;
      }

      const pos = map.map[mapIndex];
      const cell = table.nodeAt(pos);
      if (!cell) continue;

      const attrs = cell.attrs as {
        colspan?: number;
        colwidth?: number[] | null;
      };
      const colspan = Math.max(1, Number(attrs.colspan) || 1);
      const nextColwidth = resolvedWidths.slice(col, col + colspan);

      if (arraysEqual(attrs.colwidth ?? null, nextColwidth)) {
        continue;
      }

      tr.setNodeMarkup(tableContentStart + pos, null, {
        ...attrs,
        colwidth: nextColwidth,
      });
    }
  }

  return tr;
};
