interface ToolbarAnchorRect {
  left: number;
  top: number;
  width: number;
}

interface ToolbarViewportRect {
  height: number;
  width: number;
}

interface GripAnchorRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface RichTableToolbarViewportPositionInput {
  horizontalOffset?: number;
  toolbarRect: ToolbarViewportRect;
  tableRect: ToolbarAnchorRect;
  viewportPadding?: number;
  viewportRect: ToolbarViewportRect;
  verticalGap?: number;
}

export const getRichTableToolbarViewportPosition = ({
  toolbarRect,
  tableRect,
  viewportPadding = 12,
  viewportRect,
  verticalGap = 8,
}: RichTableToolbarViewportPositionInput) => {
  const maxLeft = Math.max(viewportPadding, viewportRect.width - toolbarRect.width - viewportPadding);
  const maxTop = Math.max(viewportPadding, viewportRect.height - toolbarRect.height - viewportPadding);
  const centeredLeft = tableRect.left + ((tableRect.width - toolbarRect.width) / 2);

  return {
    top: Math.min(
      maxTop,
      Math.max(viewportPadding, tableRect.top - toolbarRect.height - verticalGap)
    ),
    left: Math.min(
      maxLeft,
      Math.max(viewportPadding, centeredLeft)
    ),
  };
};

interface RichTableGripViewportPositionInput {
  anchorRect: GripAnchorRect;
  axis: 'col' | 'row';
  gripOutset?: number;
  viewportPadding?: number;
  viewportRect: ToolbarViewportRect;
}

interface RichTableEdgeHandleViewportPositionInput {
  axis: 'col' | 'row';
  handleOutset?: number;
  minLength?: number;
  tableRect: GripAnchorRect;
  visualGap?: number;
}

interface RichTableEdgeHandleClipRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface ClampRichTableEdgeHandleViewportPositionInput {
  axis: 'col' | 'row';
  clipRect: RichTableEdgeHandleClipRect;
  edgePadding?: number;
  handleRect: {
    height?: number;
    left: number;
    top: number;
    width?: number;
  };
  handleThickness?: number;
}

export const getRichTableGripViewportPosition = ({
  anchorRect,
  axis,
  gripOutset = 9,
  viewportPadding = 12,
  viewportRect,
}: RichTableGripViewportPositionInput) => {
  if (axis === 'row') {
    return {
      left: Math.min(
        Math.max(viewportPadding, viewportRect.width - viewportPadding),
        Math.max(viewportPadding, anchorRect.left - gripOutset)
      ),
      top: Math.min(
        Math.max(viewportPadding, viewportRect.height - viewportPadding),
        Math.max(viewportPadding, anchorRect.top + (anchorRect.height / 2))
      ),
    };
  }

  return {
    left: Math.min(
      Math.max(viewportPadding, viewportRect.width - viewportPadding),
      Math.max(viewportPadding, anchorRect.left + (anchorRect.width / 2))
    ),
    top: Math.min(
      Math.max(viewportPadding, viewportRect.height - viewportPadding),
      Math.max(viewportPadding, anchorRect.top - gripOutset)
    ),
  };
};

export const getRichTableEdgeHandleViewportPosition = ({
  axis,
  handleOutset = 9,
  minLength,
  tableRect,
  visualGap = 4,
}: RichTableEdgeHandleViewportPositionInput) => {
  if (axis === 'row') {
    return {
      top: Math.round(tableRect.top + tableRect.height + handleOutset + visualGap),
      left: Math.round(tableRect.left + (tableRect.width / 2)),
      width: Math.round(Math.max(minLength ?? 112, tableRect.width)),
    };
  }

  return {
    top: Math.round(tableRect.top + (tableRect.height / 2)),
    left: Math.round(tableRect.left + tableRect.width + handleOutset + visualGap),
    height: Math.round(Math.max(minLength ?? 56, tableRect.height)),
  };
};

export const intersectRichTableClipRects = (
  rects: Array<RichTableEdgeHandleClipRect | null | undefined>
): RichTableEdgeHandleClipRect | null => {
  const validRects = rects.filter(Boolean) as RichTableEdgeHandleClipRect[];
  if (validRects.length === 0) {
    return null;
  }

  const intersection = validRects.reduce((current, rect) => ({
    top: Math.max(current.top, rect.top),
    left: Math.max(current.left, rect.left),
    right: Math.min(current.right, rect.right),
    bottom: Math.min(current.bottom, rect.bottom),
  }));

  if (intersection.right <= intersection.left || intersection.bottom <= intersection.top) {
    return null;
  }

  return {
    top: Math.round(intersection.top),
    left: Math.round(intersection.left),
    right: Math.round(intersection.right),
    bottom: Math.round(intersection.bottom),
  };
};

export const clampRichTableEdgeHandleViewportPosition = ({
  axis,
  clipRect,
  edgePadding = 12,
  handleRect,
  handleThickness = 18,
}: ClampRichTableEdgeHandleViewportPositionInput) => {
  if (axis === 'row') {
    return handleRect;
  }

  const handleHalfThickness = handleThickness / 2;
  const minLeft = clipRect.left + handleHalfThickness + edgePadding;
  const maxLeft = clipRect.right - handleHalfThickness - edgePadding;
  const handleHalfHeight = (handleRect.height ?? 0) / 2;
  const rawTop = handleRect.top - handleHalfHeight;
  const rawBottom = handleRect.top + handleHalfHeight;
  const minTop = clipRect.top + edgePadding;
  const maxBottom = clipRect.bottom - edgePadding;
  const clippedTop = Math.max(rawTop, minTop);
  const clippedBottom = Math.max(clippedTop, Math.min(rawBottom, maxBottom));
  const clippedHeight = Math.max(0, Math.round(clippedBottom - clippedTop));

  return {
    ...handleRect,
    top: Math.round(clippedTop + (clippedHeight / 2)),
    left: Math.round(Math.min(Math.max(handleRect.left, minLeft), maxLeft)),
    ...(handleRect.height == null ? {} : { height: clippedHeight }),
  };
};
