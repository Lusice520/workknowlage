import type { Editor } from '@tiptap/core';
import { TableMap } from 'prosemirror-tables';
import { buildEqualizedRichTableColumnTransaction, getRichTableEqualColumnWidth } from './richTableColumnWidths';
import { tableDocHasMergedCells } from './richTablePasteUtils';

type TableContext = {
  state: any;
  tableNode: any;
  tableStart: number;
  view: any;
};

type TableAction = () => any;
type DeferredCleanup = () => void;

export interface RichTableCommandDeps {
  applyCellAlign: (value: string | null) => void;
  applyCellBackground: (value: string | null) => void;
  applyTextColor: (value: string | null) => void;
  chainTableFocus: () => any;
  closeInlineMenus: () => void;
  collapseCellSelectionToCursor: (preferredCell?: any) => boolean;
  editor: Editor | null;
  focusTableEditor: () => boolean;
  getTableWidth: () => number;
  runAddTableAction: (action: TableAction, failHint: string) => any;
  runEdgeAppendAction: (axis: 'row' | 'col') => boolean;
  runTableAction: (action: TableAction, failHint: string) => any;
  selectAxisFromHandle: (axis: 'row' | 'col') => boolean;
  setHint: (value: string) => void;
  toggleInlineCode: () => void;
  updateTableGripPositions: (preferredCell?: any) => void;
  registerDeferredCleanup?: (cleanup: DeferredCleanup) => void;
}

const getCurrentTableContext = (editor: Editor | null): TableContext | null => {
  if (!editor?.view?.state) return null;

  const { view } = editor;
  const { state } = view;
  let tableNode: any = null;
  let tableStart = -1;
  const { $from } = state.selection;

  for (let i = $from.depth; i >= 0; i -= 1) {
    const node = $from.node(i);
    if (node.type.name === 'table') {
      tableNode = node;
      tableStart = $from.before(i);
      break;
    }
  }

  if (!tableNode) {
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'table') {
        tableNode = node;
        tableStart = pos;
        return false;
      }

      return undefined;
    });
  }

  if (!tableNode || tableStart < 0) {
    return null;
  }

  return { state, tableNode, tableStart, view };
};

export const useRichTableCommands = (deps: RichTableCommandDeps) => {
  const scheduleTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(callback, delay);
    deps.registerDeferredCleanup?.(() => window.clearTimeout(timeoutId));
  };

  const scheduleFrame = (callback: () => void) => {
    const frameId = window.requestAnimationFrame(callback);
    deps.registerDeferredCleanup?.(() => window.cancelAnimationFrame(frameId));
  };

  const clearHintLater = () => {
    scheduleTimeout(() => deps.setHint(''), 1800);
  };

  const equalizeTableColumnWidths = () => {
    if (!deps.editor?.view?.state) return false;

    if (tableDocHasMergedCells(deps.editor.getJSON())) {
      deps.setHint('包含合并单元格时暂不支持调整相同宽度');
      clearHintLater();
      return false;
    }

    const tableContext = getCurrentTableContext(deps.editor);
    if (!tableContext) {
      deps.setHint('请先将光标放在表格单元格内');
      clearHintLater();
      return false;
    }

    const { state, tableNode, tableStart, view } = tableContext;
    const map = TableMap.get(tableNode);
    const measuredWidth = deps.getTableWidth();
    const targetWidth = getRichTableEqualColumnWidth({
      tableWidth: measuredWidth,
      columnCount: map.width,
    });
    const tr = buildEqualizedRichTableColumnTransaction({
      state,
      table: tableNode,
      tableStart,
      targetWidth,
    });

    if (!tr.docChanged) {
      deps.setHint('当前列宽已经一致');
      clearHintLater();
      return true;
    }

    deps.closeInlineMenus();
    view.dispatch(tr.scrollIntoView());
    deps.focusTableEditor();
    deps.setHint('已调整为等宽列');
    clearHintLater();
    deps.updateTableGripPositions();
    scheduleFrame(() => {
      deps.updateTableGripPositions();
    });
    return true;
  };

  return {
    applyCellAlign: deps.applyCellAlign,
    applyCellBackground: deps.applyCellBackground,
    applyTextColor: deps.applyTextColor,
    chainTableFocus: deps.chainTableFocus,
    closeInlineMenus: deps.closeInlineMenus,
    collapseCellSelectionToCursor: deps.collapseCellSelectionToCursor,
    equalizeTableColumnWidths,
    focusTableEditor: deps.focusTableEditor,
    runAddTableAction: deps.runAddTableAction,
    runEdgeAppendAction: deps.runEdgeAppendAction,
    runTableAction: deps.runTableAction,
    selectAxisFromHandle: deps.selectAxisFromHandle,
    toggleInlineCode: deps.toggleInlineCode,
  };
};
