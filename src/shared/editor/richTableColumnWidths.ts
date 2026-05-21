import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { TableMap } from 'prosemirror-tables';

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

const createZeroWidths = (length: number) => Array.from({ length }, () => 0);

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
