import type { RefObject } from 'react';
import { useMemo } from 'react';
import {
  clampRichTableEdgeHandleViewportPosition,
  clampRichTableGripViewportPosition,
  getRichTableEdgeHandleViewportPosition,
  getRichTableGripViewportPosition,
  getRichTableToolbarViewportPosition,
  intersectRichTableClipRects,
} from './richTableToolbarPortal';
import { shouldShowRichTableToolbar } from './richTableUiState';

type RectLike = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type GripPosition = {
  left: number;
  top: number;
};

type RowEdgeHandlePosition = {
  left: number;
  top: number;
  width: number;
};

type ColEdgeHandlePosition = {
  height: number;
  left: number;
  top: number;
};

export interface RichTableOverlayModelInput {
  containerRef: RefObject<HTMLElement>;
  activeCellBackground: string | null;
  activeTextColor: string | null;
  colTopAddButtonPos: GripPosition | null;
  isEdgeHandleHovered: boolean;
  isRowActionLaneHovered: boolean;
  isTableActive: boolean;
  isTableHovered: boolean;
  isToolbarHovered: boolean;
  openColMenu: boolean;
  openColorMenu: boolean;
  openRowMenu: boolean;
  rowGripPos: GripPosition | null;
  colGripPos: GripPosition | null;
  tableFrame: RectLike | null;
  tableViewportFrame: RectLike | null;
  toolbarRef: RefObject<HTMLElement>;
  isEditable: boolean;
  isFocused: boolean;
  hasActiveSelection: boolean;
  hasCollapsedCellCursor: boolean;
  isColActionLaneHovered: boolean;
  isToolbarExpanded: boolean;
  showUi: boolean;
}

export interface RichTableOverlayModel {
  addColVisible: boolean;
  addRowVisible: boolean;
  activeCellBackground: string | null;
  activeTextColor: string | null;
  clampedColEdgeHandlePosition: ColEdgeHandlePosition | null;
  clampedRowEdge: RowEdgeHandlePosition | null;
  colGripPos: GripPosition | null;
  colTopAddButtonPos: GripPosition | null;
  editorClip: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  } | null;
  isToolbarExpanded: boolean;
  openColMenu: boolean;
  openColorMenu: boolean;
  openRowMenu: boolean;
  rowGripPos: GripPosition | null;
  shouldShowEdgeHandles: boolean;
  shouldShowTableGrips: boolean;
  showToolbar: boolean;
  showUi: boolean;
  tableFrame: RectLike | null;
  tableViewportFrame: RectLike | null;
  toolbarViewportPosition: { left: number; top: number } | null;
}

const getRect = (element: HTMLElement | null | undefined): RectLike | null => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const clampRowEdge = (edge: RowEdgeHandlePosition | null, editorClip: { left: number; right: number } | null) => {
  if (!edge || !editorClip) return edge;

  const halfW = edge.width / 2;
  const rawLeft = edge.left - halfW;
  const rawRight = edge.left + halfW;
  if (rawRight <= editorClip.right + 5 && rawLeft >= editorClip.left - 5) return edge;

  const visLeft = Math.max(rawLeft, editorClip.left);
  const visRight = Math.min(rawRight, editorClip.right);
  const nextWidth = Math.max(visRight - visLeft, 80);
  return { top: edge.top, left: visLeft + (nextWidth / 2), width: nextWidth };
};

export const useRichTableOverlayModel = ({
  containerRef,
  activeCellBackground,
  activeTextColor,
  colTopAddButtonPos,
  isEdgeHandleHovered,
  isRowActionLaneHovered,
  isTableActive,
  isTableHovered,
  isToolbarHovered,
  openColMenu,
  openColorMenu,
  openRowMenu,
  rowGripPos,
  colGripPos,
  tableFrame,
  tableViewportFrame,
  toolbarRef,
  isEditable,
  isFocused,
  hasActiveSelection,
  hasCollapsedCellCursor,
  isColActionLaneHovered,
  isToolbarExpanded,
  showUi,
}: RichTableOverlayModelInput): RichTableOverlayModel => {
  return useMemo(() => {
    const scrollShell = containerRef.current?.querySelector('.rt-scroll-shell') as HTMLElement | null;
    const scrollShellRect = getRect(scrollShell);
    const editorSurfaceRect = getRect(containerRef.current?.closest('.shared-blocknote-surface') as HTMLElement | null);
    const hasHorizontalOverflow = !!scrollShell && (scrollShell.scrollWidth - scrollShell.clientWidth) > 1;
    const viewportRect = typeof window !== 'undefined'
      ? {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
          width: window.innerWidth,
          height: window.innerHeight,
        }
      : null;
    const editorClip = intersectRichTableClipRects([
      scrollShellRect,
      editorSurfaceRect,
      viewportRect,
    ]);
    const showToolbar = shouldShowRichTableToolbar({
      hasActiveSelection,
      hasCollapsedCellCursor,
      isEditable,
      isFocused,
      isTableActive,
      isTableHovered,
      isToolbarHovered,
      openColMenu,
      openColorMenu,
      openRowMenu,
    });

    const tableGripsVisible = showUi && (isTableHovered || isEdgeHandleHovered || openRowMenu || openColMenu);
    const edgeHandlesVisible = showUi && !!tableFrame && (isTableHovered || isEdgeHandleHovered || openRowMenu || openColMenu);
    const rowEdgeHandlePosition = tableViewportFrame
      ? getRichTableEdgeHandleViewportPosition({
          axis: 'row',
          tableRect: tableViewportFrame,
        }) as RowEdgeHandlePosition
      : null;
    const colEdgeHandlePosition = tableViewportFrame
      ? getRichTableEdgeHandleViewportPosition({
          axis: 'col',
          tableRect: tableViewportFrame,
        }) as ColEdgeHandlePosition
      : null;
    const toolbarViewportPosition = (tableViewportFrame && toolbarRef.current)
      ? getRichTableToolbarViewportPosition({
          clipRect: editorClip,
          tableRect: {
            top: tableViewportFrame.top,
            left: tableViewportFrame.left,
            width: tableViewportFrame.width,
          },
          toolbarRect: toolbarRef.current.getBoundingClientRect(),
          viewportRect: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        })
      : null;

    const clampedRowEdge = clampRowEdge(rowEdgeHandlePosition, editorClip);
    const clampedRowGripPos = (rowGripPos && editorClip)
      ? clampRichTableGripViewportPosition({
          axis: 'row',
          clipRect: editorClip,
          gripRect: rowGripPos,
        })
      : rowGripPos;
    const clampedColGripPos = (colGripPos && editorClip)
      ? clampRichTableGripViewportPosition({
          axis: 'col',
          clipRect: editorClip,
          gripRect: colGripPos,
        })
      : colGripPos;
    const clampedColTopAddButtonPos = (colTopAddButtonPos && editorClip)
      ? clampRichTableGripViewportPosition({
          axis: 'col',
          clipRect: editorClip,
          gripRect: colTopAddButtonPos,
          gripSize: {
            width: 22,
            height: 22,
          },
        })
      : colTopAddButtonPos;
    const clampedColEdgeHandlePosition = (colEdgeHandlePosition && editorClip)
      ? clampRichTableEdgeHandleViewportPosition({
        axis: 'col',
        edgePadding: 12,
        clipRect: editorClip,
        handleRect: colEdgeHandlePosition,
        stickToVisibleRightEdge: hasHorizontalOverflow,
      }) as ColEdgeHandlePosition
      : colEdgeHandlePosition;
    const addRowVisible = edgeHandlesVisible && Boolean(clampedRowEdge);
    const addColVisible = edgeHandlesVisible && Boolean(clampedColEdgeHandlePosition);

    return {
      addColVisible,
      addRowVisible,
      activeCellBackground,
      activeTextColor,
      clampedColEdgeHandlePosition,
      clampedRowEdge,
      colGripPos: clampedColGripPos,
      colTopAddButtonPos: clampedColTopAddButtonPos,
      editorClip,
      isToolbarExpanded,
      openColMenu,
      openColorMenu,
      openRowMenu,
      rowGripPos: clampedRowGripPos,
      shouldShowEdgeHandles: edgeHandlesVisible,
      shouldShowTableGrips: tableGripsVisible,
      showToolbar,
      showUi,
      tableFrame,
      tableViewportFrame,
      toolbarViewportPosition,
    };
  }, [
    containerRef,
    hasActiveSelection,
    hasCollapsedCellCursor,
    activeCellBackground,
    activeTextColor,
    colTopAddButtonPos,
    isColActionLaneHovered,
    isEdgeHandleHovered,
    isEditable,
    isFocused,
    isRowActionLaneHovered,
    isTableActive,
    isTableHovered,
    isToolbarHovered,
    openColMenu,
    openColorMenu,
    openRowMenu,
    rowGripPos,
    colGripPos,
    tableFrame,
    tableViewportFrame,
    toolbarRef,
    isToolbarExpanded,
    showUi,
  ]);
};
