export const blockNeedsTrailingParagraph = (block: any) => {
  if (!block || typeof block !== 'object') return false;
  return typeof block.content !== 'string' && !Array.isArray(block.content);
};

const getClosestBlockElement = (source: any, rootElement: HTMLElement | null) => {
  const element = source && typeof source.closest === 'function'
    ? source
    : source?.parentElement;
  const blockElement = element && typeof element.closest === 'function'
    ? element.closest('[data-id]')
    : null;

  if (!blockElement || !rootElement || typeof rootElement.contains !== 'function') {
    return null;
  }

  return rootElement.contains(blockElement) ? blockElement : null;
};

export const getDomActiveBlockId = ({
  activeElement = null,
  anchorNode = null,
  focusNode = null,
  rootElement = null,
}: {
  activeElement?: any;
  anchorNode?: any;
  focusNode?: any;
  rootElement?: HTMLElement | null;
} = {}) => {
  const candidates = [anchorNode, focusNode, activeElement];
  for (const candidate of candidates) {
    const blockElement = getClosestBlockElement(candidate, rootElement);
    const blockId = blockElement?.getAttribute?.('data-id');
    if (blockId) return String(blockId);
  }
  return '';
};

const isNodeInsideRoot = (node: Node | null | undefined, rootElement: HTMLElement | null) => {
  if (!node || !rootElement || typeof rootElement.contains !== 'function') {
    return false;
  }

  return rootElement.contains(node instanceof Element ? node : node.parentNode);
};

const getRangeRect = (range: Range | null | undefined) => {
  if (!range) return null;

  const clientRects = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
  const visibleRect = clientRects.find((rect) => rect.width > 0 || rect.height > 0);
  if (visibleRect) return visibleRect;

  if (typeof range.getBoundingClientRect === 'function') {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }

  return null;
};

export const getDomActiveSelectionRect = ({
  selection = null,
  rootElement = null,
}: {
  selection?: Selection | null | {
    focusNode?: Node | null;
    focusOffset?: number;
    rangeCount?: number;
    getRangeAt?: (index: number) => Range;
  };
  rootElement?: HTMLElement | null;
} = {}) => {
  if (!selection || !rootElement || !selection.rangeCount || typeof selection.getRangeAt !== 'function') {
    return null;
  }

  const focusNode = selection.focusNode ?? null;
  if (!isNodeInsideRoot(focusNode, rootElement)) {
    return null;
  }

  const activeRange = selection.getRangeAt(selection.rangeCount - 1);
  if (!activeRange) {
    return null;
  }

  if (focusNode && typeof activeRange.cloneRange === 'function') {
    const collapsedFocusRange = activeRange.cloneRange();
    try {
      collapsedFocusRange.setStart(focusNode, selection.focusOffset ?? 0);
      collapsedFocusRange.collapse(true);
      const focusRect = getRangeRect(collapsedFocusRange);
      if (focusRect) return focusRect;
    } catch {
      // Some DOM nodes cannot host a collapsed range start; fall back to the active range rect.
    }
  }

  return getRangeRect(activeRange);
};
