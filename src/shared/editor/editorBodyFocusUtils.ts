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
