/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createReactBlockSpec } from './blocknoteReactNoComments';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import {
  CellSelection,
  nextCell,
  selectionCell,
  TableMap,
  addColumn as pmInsertColumn,
  addRow as pmInsertRow,
} from 'prosemirror-tables';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Palette, Plus, Check, Ellipsis, EllipsisVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { applyClipboardTableToDoc, htmlTableHasMergedCells, parseClipboardTable, tableDocHasMergedCells } from './richTablePasteUtils';
import { buildDefaultRichTableDoc, getRichTableColumnCount, getRichTableTrackMinWidth } from './richTableLayout';
import {
  getRichTableEdgeHandleViewportPosition,
  getRichTableGripViewportPosition,
  getRichTableToolbarViewportPosition,
} from './richTableToolbarPortal';
import { shouldShowRichTableToolbar } from './richTableUiState';
import './RichTable.css';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const sanitizeCssValue = (value: any) => String(value || '').replace(/[<>"`]/g, '').trim();

const parseDoc = (raw: string) => {
  if (!raw) return buildDefaultRichTableDoc();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : buildDefaultRichTableDoc();
  } catch {
    return buildDefaultRichTableDoc();
  }
};

const applyTextMarks = (rawText: string, marks: any[] = []) => {
  let html = escapeHtml(rawText || '');
  const list = Array.isArray(marks) ? marks : [];
  for (const mark of list) {
    const type = mark?.type;
    if (type === 'bold') {
      html = `<strong>${html}</strong>`;
      continue;
    }
    if (type === 'italic') {
      html = `<em>${html}</em>`;
      continue;
    }
    if (type === 'underline') {
      html = `<u>${html}</u>`;
      continue;
    }
    if (type === 'strike') {
      html = `<s>${html}</s>`;
      continue;
    }
    if (type === 'rtTextColor') {
      const color = sanitizeCssValue(mark?.attrs?.color);
      html = color ? `<span style="color:${color}">${html}</span>` : html;
      continue;
    }
    if (type === 'rtTextBackground') {
      const color = sanitizeCssValue(mark?.attrs?.color);
      html = color ? `<span style="background-color:${color}">${html}</span>` : html;
      continue;
    }
    if (type === 'link') {
      const hrefRaw = String(mark?.attrs?.href || '').trim();
      const safeHref = /^https?:\/\//i.test(hrefRaw) || hrefRaw.startsWith('/uploads/') ? hrefRaw : '#';
      html = `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${html}</a>`;
    }
  }
  return html;
};

const renderTableRichNode = (node: any) => {
  if (!node) return '';
  if (typeof node === 'string') return escapeHtml(node);
  if (node.type === 'text') return applyTextMarks(node.text || '', node.marks);
  if (node.type === 'hardBreak') return '<br />';

  const children = Array.isArray(node.content)
    ? node.content.map(renderTableRichNode).join('')
    : '';

  if (node.type === 'paragraph') return `<p>${children || '<br />'}</p>`;
  if (node.type === 'bulletList') return `<ul>${children}</ul>`;
  if (node.type === 'orderedList') return `<ol>${children}</ol>`;
  if (node.type === 'listItem') return `<li>${children || '<p><br /></p>'}</li>`;

  return children;
};

const renderTableCellContentHtml = (contentNodes: any[] = []) => {
  const html = (Array.isArray(contentNodes) ? contentNodes : []).map(renderTableRichNode).join('');
  return html || '<p><br /></p>';
};

export const applyRichTableSelectionWithoutScroll = (state: any, dispatch: ((tr: any) => void) | undefined, selection: any) => {
  if (selection.eq(state.selection)) return false;
  if (dispatch) {
    dispatch(state.tr.setSelection(selection));
  }
  return true;
};

const getTableCellEdgePosition = (view: any, axis: 'horiz' | 'vert', dir: -1 | 1) => {
  if (!(view?.state?.selection instanceof TextSelection)) return null;

  const { $head } = view.state.selection;
  for (let depth = $head.depth - 1; depth >= 0; depth -= 1) {
    const parent = $head.node(depth);
    const indexAtDepth = dir < 0 ? $head.index(depth) : $head.indexAfter(depth);
    const edgeIndex = dir < 0 ? 0 : parent.childCount;

    if (indexAtDepth !== edgeIndex) {
      return null;
    }

    const tableRole = parent.type.spec.tableRole;
    if (tableRole === 'cell' || tableRole === 'header_cell') {
      const cellPos = $head.before(depth);
      const direction = axis === 'vert'
        ? (dir > 0 ? 'down' : 'up')
        : (dir > 0 ? 'right' : 'left');
      return view.endOfTextblock(direction) ? cellPos : null;
    }
  }

  return null;
};

const moveRichTableArrowSelection = (
  state: any,
  dispatch: ((tr: any) => void) | undefined,
  view: any,
  axis: 'horiz' | 'vert',
  dir: -1 | 1,
  extendSelection = false,
) => {
  if (!view) return false;

  const selection = state.selection;

  if (extendSelection) {
    let cellSelection: CellSelection;
    if (selection instanceof CellSelection) {
      cellSelection = selection;
    } else {
      const end = getTableCellEdgePosition(view, axis, dir);
      if (end == null) return false;
      cellSelection = new CellSelection(state.doc.resolve(end));
    }

    const nextHead = nextCell(cellSelection.$headCell, axis, dir);
    if (!nextHead) return false;
    return applyRichTableSelectionWithoutScroll(state, dispatch, new CellSelection(cellSelection.$anchorCell, nextHead));
  }

  if (selection instanceof CellSelection) {
    return applyRichTableSelectionWithoutScroll(state, dispatch, Selection.near(selection.$headCell, dir));
  }

  if (axis !== 'horiz' && !selection.empty) {
    return false;
  }

  const end = getTableCellEdgePosition(view, axis, dir);
  if (end == null) return false;

  if (axis === 'horiz') {
    return applyRichTableSelectionWithoutScroll(state, dispatch, Selection.near(state.doc.resolve(selection.head + dir), dir));
  }

  const $cell = state.doc.resolve(end);
  const $next = nextCell($cell, axis, dir);

  let nextSelection;
  if ($next) {
    nextSelection = Selection.near($next, 1);
  } else if (dir < 0) {
    nextSelection = Selection.near(state.doc.resolve($cell.before(-1)), -1);
  } else {
    nextSelection = Selection.near(state.doc.resolve($cell.after(-1)), 1);
  }

  return applyRichTableSelectionWithoutScroll(state, dispatch, nextSelection);
};

const handleRichTableArrowKeyDown = (view: any, event: KeyboardEvent | { key: string; shiftKey?: boolean; preventDefault?: () => void }) => {
  const key = event.key;
  const isHorizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const isVertical = key === 'ArrowUp' || key === 'ArrowDown';

  if (!isHorizontal && !isVertical) {
    return false;
  }

  const axis = isHorizontal ? 'horiz' : 'vert';
  const dir = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  const handled = moveRichTableArrowSelection(view.state, view.dispatch, view, axis, dir, Boolean(event.shiftKey));

  if (handled) {
    event.preventDefault?.();
    return true;
  }

  return false;
};

const buildRichTableStaticHtml = (rawData: string) => {
  if (!rawData) return '';
  try {
    const doc = JSON.parse(rawData);
    const tableNode = doc?.content?.find?.((node: any) => node?.type === 'table');
    const rows = Array.isArray(tableNode?.content) ? tableNode.content : [];
    if (rows.length === 0) return '';

    const rowHtml = rows.map((row: any) => {
      const cells = Array.isArray(row?.content) ? row.content : [];
      const cellHtml = cells.map((cell: any) => {
        const tag = cell?.type === 'tableHeader' ? 'th' : 'td';
        const attrs = cell?.attrs || {};
        const attrParts: string[] = [];

        const colspan = Number(attrs.colspan) || 1;
        const rowspan = Number(attrs.rowspan) || 1;
        if (colspan > 1) attrParts.push(`colspan="${colspan}"`);
        if (rowspan > 1) attrParts.push(`rowspan="${rowspan}"`);

        const styleParts: string[] = [];
        const bg = sanitizeCssValue(attrs.backgroundColor);
        const color = sanitizeCssValue(attrs.textColor);
        const align = sanitizeCssValue(attrs.textAlign);
        if (bg) styleParts.push(`background-color:${bg}`);
        if (color) styleParts.push(`color:${color}`);
        if (align) styleParts.push(`text-align:${align}`);
        if (styleParts.length > 0) attrParts.push(`style="${escapeHtml(styleParts.join(';'))}"`);

        const contentNodes = Array.isArray(cell?.content) ? cell.content : [];
        const innerHtml = renderTableCellContentHtml(contentNodes);
        const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
        return `<${tag}${attrText}>${innerHtml}</${tag}>`;
      }).join('');
      return `<tr>${cellHtml}</tr>`;
    }).join('');

    return `<div class="rt-export-table-wrap"><table class="rt-export-table"><tbody>${rowHtml}</tbody></table></div>`;
  } catch {
    return '';
  }
};

const normalizeColorValue = (value: any) => (value ? String(value).trim().toLowerCase() : null);

const TextColorMark = Mark.create({
  name: 'rtTextColor',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-rt-text-color') || element.style.color || null,
        renderHTML: (attrs: any) => {
          if (!attrs.color) return {};
          return {
            'data-rt-text-color': attrs.color,
            style: `color:${attrs.color}`,
          };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-rt-text-color]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setRtTextColor:
        (color: string) =>
          ({ commands }: any) =>
            commands.setMark(this.name, { color }),
      unsetRtTextColor:
        () =>
          ({ commands }: any) =>
            commands.unsetMark(this.name),
    } as any;
  },
});

const TextBackgroundMark = Mark.create({
  name: 'rtTextBackground',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-rt-bg-color') || element.style.backgroundColor || null,
        renderHTML: (attrs: any) => {
          if (!attrs.color) return {};
          return {
            'data-rt-bg-color': attrs.color,
            style: `background-color:${attrs.color}`,
          };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-rt-bg-color]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setRtTextBackground:
        (color: string) =>
          ({ commands }: any) =>
            commands.setMark(this.name, { color }),
      unsetRtTextBackground:
        () =>
          ({ commands }: any) =>
            commands.unsetMark(this.name),
    } as any;
  },
});

const withCellColors = (BaseExtension: any) =>
  BaseExtension.extend({
    addAttributes() {
      const parent = this.parent?.() || {};
      return {
        ...parent,
        backgroundColor: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-background-color') || element.style.backgroundColor || null,
          renderHTML: (attrs: any) => {
            const styles: string[] = [];
            if (attrs.backgroundColor) styles.push(`background-color:${attrs.backgroundColor}`);
            if (attrs.textColor) styles.push(`color:${attrs.textColor}`);
            if (attrs.textAlign) styles.push(`text-align:${attrs.textAlign}`);
            return {
              ...(attrs.backgroundColor ? { 'data-background-color': attrs.backgroundColor } : {}),
              ...(attrs.textColor ? { 'data-text-color': attrs.textColor } : {}),
              ...(attrs.textAlign ? { 'data-text-align': attrs.textAlign } : {}),
              ...(styles.length ? { style: styles.join(';') } : {}),
            };
          },
        },
        textColor: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-text-color') || element.style.color || null,
          renderHTML: () => ({}),
        },
        textAlign: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-text-align') || element.style.textAlign || null,
          renderHTML: () => ({}),
        },
      };
    },
  });

const ColoredTableCell = withCellColors(TableCell);
const ColoredTableHeader = withCellColors(TableHeader);

const COLOR_OPTIONS = [
  { label: '默认', value: null },
  { label: '灰色', value: '#6b7280' },
  { label: '棕色', value: '#7c5a46' },
  { label: '红色', value: '#dc2626' },
  { label: '橙色', value: '#ea580c' },
  { label: '黄色', value: '#ca8a04' },
  { label: '绿色', value: '#16a34a' },
  { label: '蓝色', value: '#2563eb' },
  { label: '紫色', value: '#7c3aed' },
  { label: '粉色', value: '#db2777' },
];

const BG_OPTIONS = [
  { label: '默认', value: null },
  { label: '灰色', value: '#f3f4f6' },
  { label: '棕色', value: '#f5ece6' },
  { label: '红色', value: '#fee2e2' },
  { label: '橙色', value: '#ffedd5' },
  { label: '黄色', value: '#fef9c3' },
  { label: '绿色', value: '#dcfce7' },
  { label: '蓝色', value: '#dbeafe' },
  { label: '紫色', value: '#ede9fe' },
  { label: '粉色', value: '#fce7f3' },
];

const GRIP_ANCHOR_OFFSET = 9;
const GRIP_MENU_OFFSET = 26;
const EDGE_PLUS_ICON_SIZE = 14;
const GRIP_ICON_SIZE = 13;
const FLOATING_GAP = 8;

const ToolbarButton = ({ onClick, disabled, active, icon, title }: any) => (
  <button
    type="button"
    className={`rt-icon-btn ${active ? 'active' : ''}`}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    contentEditable={false}
  >
    {icon}
  </button>
);

const RichTableEditor = ({ block, editor: bnEditor }: any) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoveredCellRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarPortalRef = useRef<HTMLDivElement | null>(null);
  const floatingControlsPortalRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const lastSerializedRef = useRef(block.props.data || '');
  const initialContent = parseDoc(block.props.data);
  const [hint, setHint] = useState('');
  const [showUi, setShowUi] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [openColorMenu, setOpenColorMenu] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState(false);
  const [openColMenu, setOpenColMenu] = useState(false);
  const [rowGripPos, setRowGripPos] = useState<any>(null);
  const [colGripPos, setColGripPos] = useState<any>(null);
  const [tableFrame, setTableFrame] = useState<any>(null);
  const [tableViewportFrame, setTableViewportFrame] = useState<any>(null);
  const [toolbarViewportPosition, setToolbarViewportPosition] = useState<{ top: number; left: number } | null>(null);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const [isEdgeHandleHovered, setIsEdgeHandleHovered] = useState(false);
  const [tableColumnCount, setTableColumnCount] = useState(() => getRichTableColumnCount(initialContent));

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        TextColorMark,
        TextBackgroundMark,
        Table.configure({ resizable: true }),
        TableRow,
        ColoredTableHeader,
        ColoredTableCell,
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: 'rt-editor',
        },
        handleKeyDown: (view, event) => handleRichTableArrowKeyDown(view, event),
      },
      onUpdate: ({ editor: tiptapEditor }: any) => {
        const nextDoc = tiptapEditor.getJSON();
        const nextColumnCount = getRichTableColumnCount(nextDoc);
        setTableColumnCount((current: number) => (current === nextColumnCount ? current : nextColumnCount));

        const nextSerialized = JSON.stringify(nextDoc);
        if (nextSerialized === lastSerializedRef.current) return;

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          bnEditor.updateBlock(block.id, {
            type: 'richTable',
            props: { data: nextSerialized },
          });
          lastSerializedRef.current = nextSerialized;
        }, 200);
      },
    },
    [block.id]
  );

  const run = (fn: () => any, failHint = '') => {
    const ok = fn();
    if (!ok && failHint) {
      setHint(failHint);
      setTimeout(() => setHint(''), 1800);
    }
    return ok;
  };

  const focusTableEditor = useCallback((position = undefined) => {
    if (!editor) return false;
    return editor.commands.focus(position, { scrollIntoView: false });
  }, [editor]);

  const chainTableFocus = useCallback(() => {
    if (!editor) return null;
    return editor.chain().focus(undefined, { scrollIntoView: false });
  }, [editor]);

  const applyTextColor = (value: string | null) => {
    if (!editor) return;
    const selection = editor.state.selection;
    if (selection instanceof CellSelection) {
      const ok = run(
        () => chainTableFocus()?.setCellAttribute('textColor', value).run() ?? false,
        '请先选中文本或将光标放在文本内'
      );
      if (ok) setOpenColorMenu(false);
      return;
    }
    const ok = run(
      () => {
        const chain = chainTableFocus() as any;
        return (value
          ? chain?.setRtTextColor(value).run()
          : chain?.unsetRtTextColor().run()) ?? false;
      },
      '请先选中文本或将光标放在文本内'
    );
    if (ok) setOpenColorMenu(false);
  };

  const applyCellBackground = (value: string | null) => {
    if (!editor) return;
    const ok = run(
      () => chainTableFocus()?.setCellAttribute('backgroundColor', value).run() ?? false,
      '请先将光标放在表格单元格内'
    );
    if (ok) setOpenColorMenu(false);
  };

  const applyCellAlign = (value: string | null) => {
    if (!editor) return;
    run(
      () => chainTableFocus()?.setCellAttribute('textAlign', value).run() ?? false,
      '请先将光标放在表格单元格内'
    );
  };

  const closeInlineMenus = useCallback(() => {
    setOpenColorMenu(false);
    setOpenRowMenu(false);
    setOpenColMenu(false);
  }, []);

  const runTableAction = (action: () => any, failHint: string) => {
    if (!editor) return;
    const ok = run(action, failHint);
    if (ok) {
      setOpenRowMenu(false);
      setOpenColMenu(false);
    }
    return ok;
  };

  const getActiveTextColor = () => {
    if (!editor) return null;
    const markColor = editor.getAttributes('rtTextColor')?.color;
    const cellColor = editor.getAttributes('tableCell')?.textColor;
    const headerColor = editor.getAttributes('tableHeader')?.textColor;
    return normalizeColorValue(markColor || cellColor || headerColor || null);
  };

  const getActiveCellBackground = () => {
    if (!editor) return null;
    const cellBg = editor.getAttributes('tableCell')?.backgroundColor;
    const headerBg = editor.getAttributes('tableHeader')?.backgroundColor;
    return normalizeColorValue(cellBg || headerBg || null);
  };

  const collapseCellSelectionToCursor = useCallback((preferredCell?: any) => {
    if (!editor?.view?.state) return false;
    const { view } = editor;
    const state = view.state;
    if (!(state.selection instanceof CellSelection)) return false;

    let cellPos: any = null;
    const targetCell = preferredCell && view.dom.contains(preferredCell)
      ? preferredCell
      : hoveredCellRef.current;

    if (targetCell && view.dom.contains(targetCell)) {
      try {
        const posAtCell = view.posAtDOM(targetCell, 0);
        cellPos = { pos: posAtCell } as any;
      } catch {
        cellPos = null;
      }
    }

    if (!cellPos) {
      try {
        cellPos = selectionCell(state);
      } catch {
        cellPos = null;
      }
    }

    if (!cellPos) return false;

    const cursorPos = Math.min(Math.max(cellPos.pos + 1, 1), Math.max(1, state.doc.content.size - 1));
    return (chainTableFocus() as any)?.setTextSelection(cursorPos).run() ?? false;
  }, [chainTableFocus, editor]);

  const selectAxisFromHandle = useCallback((axis: 'row' | 'col') => {
    if (!editor?.view?.state) return false;
    const { view } = editor;
    const state = view.state;

    let cellPos: any = null;
    try {
      cellPos = selectionCell(state);
    } catch {
      cellPos = null;
    }

    if (!cellPos && hoveredCellRef.current && view.dom.contains(hoveredCellRef.current)) {
      try {
        const posAtHovered = view.posAtDOM(hoveredCellRef.current, 0);
        const cursorPos = Math.min(Math.max(posAtHovered, 1), Math.max(1, state.doc.content.size - 1));
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, cursorPos)));
        try {
          cellPos = selectionCell(view.state);
        } catch {
          cellPos = null;
        }
      } catch {
        cellPos = null;
      }
    }

    if (!cellPos) return false;

    const currentState = view.state;
    const nextSelection = axis === 'row'
      ? CellSelection.rowSelection(cellPos)
      : CellSelection.colSelection(cellPos);

    view.dispatch(currentState.tr.setSelection(nextSelection));
    focusTableEditor();
    return true;
  }, [editor, focusTableEditor]);

  const runEdgeAppendAction = useCallback((axis: 'row' | 'col') => {
    if (!editor?.view?.state) return false;
    const { view } = editor;
    const { state, dispatch } = view;

    try {
      let tableNode: any = null;
      let tableStart = -1;
      const { $from } = state.selection;

      for (let i = $from.depth; i >= 0; i--) {
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
        });
      }

      if (!tableNode) return false;

      const map = TableMap.get(tableNode);
      const rect = {
        left: 0,
        top: 0,
        right: map.width,
        bottom: map.height,
        map,
        table: tableNode,
        tableStart,
      };

      let tr = state.tr;
      if (axis === 'col') {
        // ALWAYS append to the far right
        tr = pmInsertColumn(tr, rect, map.width);
      } else {
        // ALWAYS append to the very bottom
        tr = pmInsertRow(tr, rect, map.height);
      }

      dispatch(tr.scrollIntoView());
      focusTableEditor();
      return true;
    } catch (e) {
      console.error('Failed to append at edge:', e);
      return false;
    }
  }, [editor, focusTableEditor]);

  const runAddTableAction = (action: () => any, failHint: string) => {
    if (!editor) return;
    const ok = runTableAction(action, failHint);
    if (!ok) return;
    window.requestAnimationFrame(() => {
      updateTableGripPositions(hoveredCellRef.current || undefined);
      collapseCellSelectionToCursor();
      window.requestAnimationFrame(() => {
        updateTableGripPositions(hoveredCellRef.current || undefined);
      });
    });
  };

  const updateTableGripPositions = useCallback((preferredCell?: any) => {
    if (!containerRef.current) {
      setRowGripPos(null);
      setColGripPos(null);
      setTableFrame(null);
      setTableViewportFrame(null);
      setToolbarViewportPosition(null);
      return;
    }
    const shell = containerRef.current.querySelector('.rt-editor-shell');
    if (!shell) {
      setRowGripPos(null);
      setColGripPos(null);
      setTableFrame(null);
      setTableViewportFrame(null);
      setToolbarViewportPosition(null);
      return;
    }
    const findSelectionCell = () => {
      if (!editor?.view?.state) return null;
      const { $from } = editor.view.state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          const dom = editor.view.nodeDOM($from.before(depth));
          if (dom instanceof HTMLElement) return dom;
        }
      }
      return null;
    };

    const hoveredCell = preferredCell || hoveredCellRef.current;
    const selectedCell = findSelectionCell() || shell.querySelector('.rt-editor .selectedCell');
    const activeCell = selectedCell || (hoveredCell && shell.contains(hoveredCell) ? hoveredCell : null);

    if (!activeCell) {
      setRowGripPos(null);
      setColGripPos(null);
      setTableFrame(null);
      setTableViewportFrame(null);
      setToolbarViewportPosition(null);
      return;
    }
    const row = activeCell.closest('tr');
    const table = activeCell.closest('table');
    if (!row || !table) {
      setRowGripPos(null);
      setColGripPos(null);
      setTableFrame(null);
      setTableViewportFrame(null);
      setToolbarViewportPosition(null);
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const cellRect = activeCell.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const viewportRect = typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 0, height: 0 };

    setRowGripPos(
      getRichTableGripViewportPosition({
        axis: 'row',
        anchorRect: {
          top: rowRect.top,
          left: tableRect.left,
          width: tableRect.width,
          height: rowRect.height,
        },
        gripOutset: GRIP_ANCHOR_OFFSET,
        viewportRect,
      })
    );
    setColGripPos(
      getRichTableGripViewportPosition({
        axis: 'col',
        anchorRect: {
          top: tableRect.top,
          left: cellRect.left,
          width: cellRect.width,
          height: tableRect.height,
        },
        gripOutset: GRIP_ANCHOR_OFFSET,
        viewportRect,
      })
    );
    setTableFrame({
      top: tableRect.top - shellRect.top,
      left: tableRect.left - shellRect.left,
      width: tableRect.width,
      height: tableRect.height,
    });
    setTableViewportFrame({
      top: tableRect.top,
      left: tableRect.left,
      width: tableRect.width,
      height: tableRect.height,
    });

    if (typeof window !== 'undefined' && toolbarRef.current) {
      setToolbarViewportPosition(
        getRichTableToolbarViewportPosition({
          tableRect: {
            top: tableRect.top,
            left: tableRect.left,
            width: tableRect.width,
          },
          toolbarRect: {
            width: toolbarRef.current.offsetWidth,
            height: toolbarRef.current.offsetHeight,
          },
          viewportRect: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        })
      );
    }
  }, [editor]);

  useEffect(() => {
    lastSerializedRef.current = block.props.data || '';
    setTableColumnCount(getRichTableColumnCount(parseDoc(block.props.data)));
  }, [block.id, block.props.data]);

  useEffect(() => {
    if (!editor) return;
    const refreshUi = () => {
      const inTable = editor.isEditable && editor.isActive('table');
      const isFocused = editor.isFocused;
      const selection = editor.state.selection;
      const hasActiveSelection = !!selection && !selection.empty;
      const hasCollapsedCellCursor = !!selection?.empty
        && (editor.isActive('tableCell') || editor.isActive('tableHeader'));
      setShowToolbar(shouldShowRichTableToolbar({
        hasActiveSelection,
        hasCollapsedCellCursor,
        isEditable: editor.isEditable,
        isFocused,
        isTableActive: inTable,
        isTableHovered,
        isToolbarHovered,
        openColorMenu,
        openRowMenu,
        openColMenu,
      }));
      setShowUi(inTable);
      if (!inTable) {
        closeInlineMenus();
        setRowGripPos(null);
        setColGripPos(null);
        setTableFrame(null);
        setTableViewportFrame(null);
        setToolbarViewportPosition(null);
        setIsTableHovered(false);
        setIsEdgeHandleHovered(false);
        setIsToolbarHovered(false);
        return;
      }
      updateTableGripPositions(hoveredCellRef.current || undefined);
    };

    refreshUi();
    editor.on('selectionUpdate', refreshUi);
    editor.on('focus', refreshUi);
    editor.on('blur', refreshUi);
    editor.on('transaction', refreshUi);

    return () => {
      editor.off('selectionUpdate', refreshUi);
      editor.off('focus', refreshUi);
      editor.off('blur', refreshUi);
      editor.off('transaction', refreshUi);
    };
  }, [closeInlineMenus, editor, isTableHovered, isToolbarHovered, openColorMenu, openRowMenu, openColMenu, updateTableGripPositions]);

  useEffect(() => {
    if (!showUi) {
      setToolbarViewportPosition(null);
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateTableGripPositions(hoveredCellRef.current || undefined);
    });
    const toolbarNode = toolbarRef.current;
    if (!toolbarNode || typeof ResizeObserver === 'undefined') {
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const observer = new ResizeObserver(() => {
      updateTableGripPositions(hoveredCellRef.current || undefined);
    });
    observer.observe(toolbarNode);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [isToolbarExpanded, showToolbar, showUi, updateTableGripPositions]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editor?.view?.dom) return undefined;

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;
      const clipboardHtml = clipboardData.getData('text/html');

      if (htmlTableHasMergedCells(clipboardHtml)) return;

      const matrix = parseClipboardTable({
        text: clipboardData.getData('text/plain'),
        html: clipboardHtml,
      });
      if (!matrix) return;

      const currentDoc = editor.getJSON();
      if (tableDocHasMergedCells(currentDoc)) return;

      let cellPos: any = null;
      try {
        cellPos = selectionCell(editor.state);
      } catch {
        cellPos = null;
      }
      if (!cellPos) return;

      const tableNode = cellPos.node(-1);
      const tableStart = cellPos.start(-1);
      const map = TableMap.get(tableNode);
      const selection = editor.state.selection;
      const rect = selection instanceof CellSelection
        ? map.rectBetween(selection.$anchorCell.pos - tableStart, selection.$headCell.pos - tableStart)
        : map.findCell(cellPos.pos - tableStart);

      const nextDoc = applyClipboardTableToDoc(currentDoc, {
        startRow: rect.top,
        startCol: rect.left,
        matrix,
      });
      if (!nextDoc) return;

      event.preventDefault();
      event.stopPropagation();
          editor.commands.setContent(nextDoc, { emitUpdate: false });
      focusTableEditor();

      setHint(`已粘贴 ${matrix.length} 行 × ${matrix[0]?.length || 0} 列`);
      window.setTimeout(() => setHint(''), 1800);
    };

    const dom = editor.view.dom;
    dom.addEventListener('paste', handlePaste, true);
    return () => {
      dom.removeEventListener('paste', handlePaste, true);
    };
  }, [editor, focusTableEditor]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        containerRef.current?.contains(target) ||
        toolbarPortalRef.current?.contains(target) ||
        floatingControlsPortalRef.current?.contains(target)
      ) {
        return;
      }
      closeInlineMenus();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [closeInlineMenus]);

  useEffect(() => {
    const onResize = () => updateTableGripPositions();
    const onScroll = () => updateTableGripPositions();
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [updateTableGripPositions]);

  useEffect(() => {
    const scroller = containerRef.current?.querySelector('.rt-scroll-shell');
    if (!scroller) return undefined;
    const onScroll = () => updateTableGripPositions();
    scroller.addEventListener('scroll', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [updateTableGripPositions]);

  useEffect(() => {
    if (!showUi || typeof ResizeObserver === 'undefined') return undefined;

    const shell = containerRef.current?.querySelector('.rt-editor-shell');
    const table = containerRef.current?.querySelector('.rt-editor table');
    const wrapper = containerRef.current?.querySelector('.rt-editor .tableWrapper');
    if (!shell || !table) return undefined;

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        updateTableGripPositions(hoveredCellRef.current || undefined);
      });
    });

    observer.observe(shell);
    observer.observe(table);
    if (wrapper && wrapper !== table) {
      observer.observe(wrapper);
    }

    return () => {
      observer.disconnect();
    };
  }, [showUi, tableColumnCount, updateTableGripPositions]);

  useEffect(() => {
    const shell = containerRef.current?.querySelector('.rt-editor-shell');
    if (!shell) return undefined;

    const onMouseMove = (event: MouseEvent) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      const target = event.target instanceof Element ? event.target : (event.target as any)?.parentElement;
      const cell = target?.closest('.rt-editor td, .rt-editor th');
      if (cell && shell.contains(cell)) {
        hoveredCellRef.current = cell;
        setShowUi(true);
        setIsTableHovered(true);
        updateTableGripPositions(cell);
      }
    };

    const onMouseLeave = () => {
      hoverTimerRef.current = setTimeout(() => {
        hoveredCellRef.current = null;
        setIsTableHovered(false);
        if (!editor?.isActive('table')) {
          setShowUi(false);
        }
        updateTableGripPositions();
      }, 150);
    };

    shell.addEventListener('mousemove', onMouseMove as EventListener);
    shell.addEventListener('mouseleave', onMouseLeave as EventListener);
    return () => {
      shell.removeEventListener('mousemove', onMouseMove as EventListener);
      shell.removeEventListener('mouseleave', onMouseLeave as EventListener);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [editor, updateTableGripPositions]);

  const handleShellMouseDownCapture = useCallback((event: React.MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.rt-table-grip, .rt-handle-menu, .rt-top-toolbar, .rt-add-col-handle, .rt-add-row-handle')) {
      return;
    }

    const cell = target.closest('.rt-editor td, .rt-editor th');
    if (!cell) return;

    const shouldCloseMenus = openRowMenu || openColMenu || openColorMenu;
    if (shouldCloseMenus) {
      closeInlineMenus();
    }

    if (!(openRowMenu || openColMenu)) return;
    if (!(editor?.view?.state?.selection instanceof CellSelection)) return;

    window.requestAnimationFrame(() => {
      collapseCellSelectionToCursor(cell);
    });
  }, [closeInlineMenus, collapseCellSelectionToCursor, editor, openColorMenu, openColMenu, openRowMenu]);

  if (!editor) {
    return <div className="rt-loading">表格加载中...</div>;
  }

  const activeTextColor = getActiveTextColor();
  const activeCellBackground = getActiveCellBackground();
  const shouldShowEdgeHandles = showUi && !!tableFrame && (isTableHovered || isEdgeHandleHovered || openRowMenu || openColMenu);
  const shouldShowTableGrips = showUi && (isTableHovered || isEdgeHandleHovered || openRowMenu || openColMenu);
  const trackMinWidth = getRichTableTrackMinWidth(tableColumnCount);
  const colEdgeHandlePosition = tableViewportFrame
    ? getRichTableEdgeHandleViewportPosition({
        axis: 'col',
        tableRect: tableViewportFrame,
      })
    : null;
  const rowEdgeHandlePosition = tableViewportFrame
    ? getRichTableEdgeHandleViewportPosition({
        axis: 'row',
        tableRect: tableViewportFrame,
      })
    : null;

  // Compute the editor's visible clip region from the scroll shell
  const scrollShellEl = containerRef.current?.querySelector('.rt-scroll-shell');
  const editorClip = scrollShellEl?.getBoundingClientRect() ?? null;

  // Clamp add-col handle: hide if its position exceeds the editor's right edge
  const colEdgeInBounds = colEdgeHandlePosition && editorClip
    ? colEdgeHandlePosition.left <= editorClip.right + 5
    : true;

  // Clamp add-row handle: restrict width and center to stay within editor bounds
  const clampedRowEdge = (() => {
    if (!rowEdgeHandlePosition || !editorClip) return rowEdgeHandlePosition;
    const halfW = rowEdgeHandlePosition.width! / 2;
    const rawLeft = rowEdgeHandlePosition.left - halfW;
    const rawRight = rowEdgeHandlePosition.left + halfW;
    if (rawRight <= editorClip.right + 5 && rawLeft >= editorClip.left - 5) return rowEdgeHandlePosition;
    const visLeft = Math.max(rawLeft, editorClip.left);
    const visRight = Math.min(rawRight, editorClip.right);
    const w = Math.max(visRight - visLeft, 80);
    return { ...rowEdgeHandlePosition, width: w, left: visLeft + w / 2 };
  })();

  // Clamp grip positions to editor bounds
  const clampedRowGripPos = (() => {
    if (!rowGripPos || !editorClip) return rowGripPos;
    if (rowGripPos.left < editorClip.left - 20 || rowGripPos.left > editorClip.right + 5) return null;
    return rowGripPos;
  })();
  const clampedColGripPos = (() => {
    if (!colGripPos || !editorClip) return colGripPos;
    if (colGripPos.left < editorClip.left - 5 || colGripPos.left > editorClip.right + 5) return null;
    return colGripPos;
  })();
  const toolbarPortal = typeof document !== 'undefined' && showUi
    ? createPortal(
        <div
          ref={toolbarPortalRef}
          className="rt-top-toolbar-portal"
          style={{
            top: `${toolbarViewportPosition?.top ?? 0}px`,
            left: `${toolbarViewportPosition?.left ?? 0}px`,
            visibility: toolbarViewportPosition ? 'visible' : 'hidden',
          }}
          contentEditable={false}
        >
          <div
            ref={toolbarRef}
            className={`rt-top-toolbar ${showToolbar ? 'is-visible' : 'is-hidden'}`}
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setIsToolbarHovered(true)}
            onMouseLeave={() => setIsToolbarHovered(false)}
          >
            <ToolbarButton
              title={isToolbarExpanded ? '收起工具栏' : '展开工具栏'}
              icon={isToolbarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              onClick={() => setIsToolbarExpanded((value) => !value)}
            />
            {isToolbarExpanded ? (
              <>
                <span className="rt-divider" />
                <ToolbarButton title="左对齐" icon={<AlignLeft size={14} />} onClick={() => applyCellAlign('left')} />
                <ToolbarButton title="居中" icon={<AlignCenter size={14} />} onClick={() => applyCellAlign('center')} />
                <ToolbarButton title="右对齐" icon={<AlignRight size={14} />} onClick={() => applyCellAlign('right')} />
                <span className="rt-divider" />
              </>
            ) : null}
            <div className="rt-color-wrap" contentEditable={false}>
              <ToolbarButton
                title="颜色"
                icon={<Palette size={14} />}
                active={openColorMenu}
                onClick={() => {
                  setOpenColorMenu((value) => !value);
                  setOpenRowMenu(false);
                  setOpenColMenu(false);
                }}
              />
              {openColorMenu ? (
                <div className="rt-color-menu" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
                  <div className="rt-color-section-title">文本</div>
                  {COLOR_OPTIONS.map((item) => (
                    <button
                      key={`txt-${item.label}`}
                      type="button"
                      className="rt-color-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTextColor(item.value)}
                    >
                      <span className="rt-color-swatch" style={{ color: item.value || '#111827' }}>A</span>
                      <span>{item.label}</span>
                      {normalizeColorValue(item.value) === activeTextColor ? <Check size={12} /> : null}
                    </button>
                  ))}
                  <div className="rt-color-section-title">背景色</div>
                  {BG_OPTIONS.map((item) => (
                    <button
                      key={`bg-${item.label}`}
                      type="button"
                      className="rt-color-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCellBackground(item.value)}
                    >
                      <span className="rt-color-swatch bg" style={{ backgroundColor: item.value || 'transparent' }}>A</span>
                      <span>{item.label}</span>
                      {normalizeColorValue(item.value) === activeCellBackground ? <Check size={12} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <ToolbarButton title="合并单元格" icon={<span className="rt-mini-text">合</span>} onClick={() => run(() => chainTableFocus()?.mergeCells().run() ?? false, '请先选择多个相邻单元格再合并')} />
            <ToolbarButton title="拆分单元格" icon={<span className="rt-mini-text">拆</span>} onClick={() => run(() => chainTableFocus()?.splitCell().run() ?? false, '当前单元格不可拆分')} />
            {isToolbarExpanded ? (
              <>
                <span className="rt-divider" />
                <ToolbarButton title="表头行" icon={<span className="rt-mini-text">行头</span>} onClick={() => run(() => chainTableFocus()?.toggleHeaderRow().run() ?? false, '请先定位到单元格')} />
                <ToolbarButton title="表头列" icon={<span className="rt-mini-text">列头</span>} onClick={() => run(() => chainTableFocus()?.toggleHeaderColumn().run() ?? false, '请先定位到单元格')} />
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )
    : null;
  const floatingControlsPortal = typeof document !== 'undefined' && showUi
    ? createPortal(
        <div ref={floatingControlsPortalRef} className="rt-floating-controls-portal" contentEditable={false}>
          {shouldShowEdgeHandles && colEdgeHandlePosition && colEdgeInBounds ? (
            <button
              type="button"
              className="rt-add-col-handle"
              style={{
                top: `${colEdgeHandlePosition.top}px`,
                left: `${colEdgeHandlePosition.left}px`,
                height: `${colEdgeHandlePosition.height}px`,
              }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIsEdgeHandleHovered(true)}
              onMouseLeave={() => setIsEdgeHandleHovered(false)}
              onClick={() => runAddTableAction(() => runEdgeAppendAction('col'), '添加列失败，请重试')}
              title="新增列"
            >
              <Plus size={EDGE_PLUS_ICON_SIZE} />
            </button>
          ) : null}
          {shouldShowEdgeHandles && clampedRowEdge ? (
            <button
              type="button"
              className="rt-add-row-handle"
              style={{
                top: `${clampedRowEdge.top}px`,
                left: `${clampedRowEdge.left}px`,
                width: `${clampedRowEdge.width}px`,
              }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIsEdgeHandleHovered(true)}
              onMouseLeave={() => setIsEdgeHandleHovered(false)}
              onClick={() => runAddTableAction(() => runEdgeAppendAction('row'), '添加行失败，请重试')}
              title="新增行"
            >
              <Plus size={EDGE_PLUS_ICON_SIZE} />
            </button>
          ) : null}
          {shouldShowTableGrips && clampedRowGripPos ? (
            <button
              type="button"
              className={`rt-table-grip row ${openRowMenu ? 'active' : ''}`}
              style={{ top: `${clampedRowGripPos.top}px`, left: `${clampedRowGripPos.left}px` }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIsEdgeHandleHovered(true)}
              onMouseLeave={() => setIsEdgeHandleHovered(false)}
              onClick={() => {
                const selected = run(
                  () => selectAxisFromHandle('row'),
                  '请先将光标放在目标行中的单元格内'
                );
                if (!selected) return;
                setOpenRowMenu((value) => !value);
                setOpenColMenu(false);
                setOpenColorMenu(false);
              }}
              title="行操作"
            >
              <EllipsisVertical size={GRIP_ICON_SIZE} />
            </button>
          ) : null}
          {shouldShowTableGrips && clampedColGripPos ? (
            <button
              type="button"
              className={`rt-table-grip col ${openColMenu ? 'active' : ''}`}
              style={{ top: `${clampedColGripPos.top}px`, left: `${clampedColGripPos.left}px` }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIsEdgeHandleHovered(true)}
              onMouseLeave={() => setIsEdgeHandleHovered(false)}
              onClick={() => {
                const selected = run(
                  () => selectAxisFromHandle('col'),
                  '请先将光标放在目标列中的单元格内'
                );
                if (!selected) return;
                setOpenColMenu((value) => !value);
                setOpenRowMenu(false);
                setOpenColorMenu(false);
              }}
              title="列操作"
            >
              <Ellipsis size={GRIP_ICON_SIZE} />
            </button>
          ) : null}
          {openRowMenu ? (
            <div
              className="rt-handle-menu"
              style={{
                top: clampedRowGripPos ? `${clampedRowGripPos.top}px` : undefined,
                left: clampedRowGripPos ? `${clampedRowGripPos.left + GRIP_MENU_OFFSET}px` : undefined,
                transform: 'translateY(-50%)',
              }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button type="button" onClick={() => runAddTableAction(() => chainTableFocus()?.addRowBefore().run() ?? false, '请先定位到单元格')}>上方添加行</button>
              <button type="button" onClick={() => runAddTableAction(() => chainTableFocus()?.addRowAfter().run() ?? false, '请先定位到单元格')}>下方添加行</button>
              <button type="button" className="danger" onClick={() => runTableAction(() => chainTableFocus()?.deleteRow().run() ?? false, '请先定位到单元格')}>删除行</button>
            </div>
          ) : null}
          {openColMenu ? (
            <div
              className="rt-handle-menu"
              style={{
                top: clampedColGripPos ? `${clampedColGripPos.top + GRIP_MENU_OFFSET}px` : undefined,
                left: clampedColGripPos ? `${clampedColGripPos.left}px` : undefined,
                transform: 'translateX(-50%)',
              }}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button type="button" onClick={() => runAddTableAction(() => chainTableFocus()?.addColumnBefore().run() ?? false, '请先定位到单元格')}>左侧添加列</button>
              <button type="button" onClick={() => runAddTableAction(() => chainTableFocus()?.addColumnAfter().run() ?? false, '请先定位到单元格')}>右侧添加列</button>
              <button type="button" className="danger" onClick={() => runTableAction(() => chainTableFocus()?.deleteColumn().run() ?? false, '请先定位到单元格')}>删除列</button>
            </div>
          ) : null}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="rt-container" ref={containerRef}>
      {toolbarPortal}
      {floatingControlsPortal}
      <div className="rt-scroll-shell">
        <div className="rt-scroll-track" style={{ ['--rt-track-min-width' as string]: trackMinWidth }}>
          <div className="rt-editor-shell" onMouseDownCapture={handleShellMouseDownCapture}>
            <div className="rt-editor-content">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
      {hint ? <div className="rt-hint" contentEditable={false}>{hint}</div> : null}
    </div>
  );
};

export const createRichTable = createReactBlockSpec(
  {
    type: 'richTable',
    propSchema: {
      data: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: (props: any) => <RichTableEditor block={props.block} editor={props.editor} />,
    toExternalHTML: (props: any) => {
      const html = buildRichTableStaticHtml(props.block.props.data);
      if (!html) {
        return <p>空表格</p>;
      }
      return <div className="rt-export-static" dangerouslySetInnerHTML={{ __html: html }} />;
    },
  }
);
