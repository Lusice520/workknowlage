export const EMPTY_TEXT_CONTENT = [{ type: 'text', text: '' }];

export const isListType = (type: string) => type === 'bulletListItem' || type === 'numberedListItem';
export const isContainerType = (type: string) => type === 'alert';

export const hasInlineTextContent = (content: any) => {
  if (typeof content === 'string') return content.trim().length > 0;
  if (!Array.isArray(content)) return false;

  return content.some((node: any) => {
    if (typeof node === 'string') return node.trim().length > 0;
    if (node?.type === 'text') return String(node.text || '').trim().length > 0;
    if (node?.type === 'docMention') return String(node?.props?.title || '').trim().length > 0;
    if (node?.type === 'link') {
      if (typeof node.content === 'string') return node.content.trim().length > 0;
      if (Array.isArray(node.content)) {
        return node.content.some((part: any) => (
          typeof part === 'string'
            ? part.trim().length > 0
            : String(part?.text || '').trim().length > 0
        ));
      }
    }
    return false;
  });
};

export const isEditorComposingInput = ({
  editor,
  event,
}: {
  editor: any;
  event?: Pick<KeyboardEvent, 'isComposing'> | null;
}) => Boolean(event?.isComposing || editor?.prosemirrorView?.composing);

export const shouldTrapArrowLeftAfterRichTable = ({
  event,
  currentBlock,
  prevBlock,
  selection,
}: {
  event?: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'> | null;
  currentBlock?: any;
  prevBlock?: any;
  selection?: {
    empty?: boolean;
    $from?: {
      parentOffset?: number;
    } | null;
  } | null;
}) => {
  if (!event || event.key !== 'ArrowLeft') return false;
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (prevBlock?.type !== 'richTable') return false;
  if (currentBlock?.type !== 'paragraph') return false;
  if (hasInlineTextContent(currentBlock.content)) return false;
  if (!selection?.empty) return false;
  return Number(selection?.$from?.parentOffset ?? -1) === 0;
};

export const getBlockPlainText = (block: any) => {
  if (!block?.content) return '';
  if (typeof block.content === 'string') return block.content;
  if (!Array.isArray(block.content)) return '';

  return block.content.map((node: any) => {
    if (typeof node === 'string') return node;
    if (node?.type === 'text') return node.text || '';
    if (node?.type === 'docMention') return node?.props?.title ? `@${node.props.title}` : '';
    if (node?.type === 'link') {
      if (typeof node.content === 'string') return node.content;
      if (Array.isArray(node.content)) {
        return node.content
          .map((part: any) => (typeof part === 'string' ? part : (part?.text || '')))
          .join('');
      }
    }
    return '';
  }).join('');
};

export const getCurrentLineTextBeforeCursor = (editor: any) => {
  const selection = editor.prosemirrorView?.state?.selection;
  const textBefore = selection?.$from?.parent?.textBetween?.(0, selection.$from.parentOffset, '\n', '\n') || '';
  return textBefore.split('\n').pop() || '';
};

export const collectMisplacedAlertHeaders = (blocks: any[], repairs: any[] = []) => {
  if (!Array.isArray(blocks) || blocks.length === 0) return repairs;

  blocks.forEach((block) => {
    const children = Array.isArray(block?.children) ? block.children : [];
    if (
      block?.type === 'alert' &&
      hasInlineTextContent(block.content) &&
      children[0]?.type === 'paragraph' &&
      hasInlineTextContent(children[0]?.content) &&
      JSON.stringify(block.content) === JSON.stringify(children[0].content)
    ) {
      repairs.push({
        id: block.id,
        firstChildId: children[0].id,
      });
    }

    if (children.length > 0) {
      collectMisplacedAlertHeaders(children, repairs);
    }
  });

  return repairs;
};
