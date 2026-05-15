import type { MutableRefObject } from 'react';
import {
  collectMisplacedAlertHeaders,
  EMPTY_TEXT_CONTENT,
  getBlockPlainText,
  getCurrentLineTextBeforeCursor,
  hasInlineTextContent,
  isContainerType,
  isListType,
} from './sharedBlockNoteEditorBehavior';

export interface SharedBlockNoteContainerRefs {
  alertExitArmedRef: MutableRefObject<boolean>;
  alertExitPlaceholderRef: MutableRefObject<string | null>;
  alertExitTargetRef: MutableRefObject<string | null>;
  applyingAlertHeaderNormalizationRef: MutableRefObject<boolean>;
  alertHeaderNormalizationDoneRef: MutableRefObject<boolean>;
  redirectingListIntoAlertRef: MutableRefObject<boolean>;
}

const getContainerContextAtCursor = (editor: any) => {
  const cursor = editor.getTextCursorPosition();
  const currentBlock = cursor?.block;
  if (!currentBlock) return null;
  if (isContainerType(currentBlock.type)) {
    return { containerBlock: currentBlock, currentBlock, containerType: currentBlock.type };
  }
  const parent = editor.getParentBlock(currentBlock.id);
  if (isContainerType(parent?.type)) {
    return { containerBlock: parent, currentBlock, containerType: parent.type };
  }
  return null;
};

export function normalizeSharedBlockNoteAlertHeaders(editor: any, refs: SharedBlockNoteContainerRefs) {
  if (refs.alertHeaderNormalizationDoneRef.current || refs.applyingAlertHeaderNormalizationRef.current) return;
  if (editor?.prosemirrorView?.composing) return;

  const repairs = collectMisplacedAlertHeaders(editor.document);
  if (repairs.length === 0) return;

  refs.applyingAlertHeaderNormalizationRef.current = true;
  try {
    repairs.forEach((repair) => {
      const target = editor.getBlock(repair.id);
      if (!target || target.type !== 'alert') return;
      if (repair.content !== undefined) {
        editor.updateBlock(target, { content: repair.content });
      }
      if (repair.firstChildId) {
        const latestFirstChild = editor.getBlock(repair.firstChildId);
        const latestParent = latestFirstChild ? editor.getParentBlock(repair.firstChildId) : null;
        if (latestFirstChild && latestParent?.id === repair.id) {
          editor.removeBlocks([repair.firstChildId]);
        }
      }
    });
    refs.alertHeaderNormalizationDoneRef.current = true;
  } finally {
    refs.applyingAlertHeaderNormalizationRef.current = false;
  }
}

export function handleSharedBlockNoteContainerBeforeChange(editor: any, refs: SharedBlockNoteContainerRefs) {
  return ({ getChanges }: any) => {
    if (refs.redirectingListIntoAlertRef.current) return;
    const containerContext = getContainerContextAtCursor(editor);
    const activeContainer = containerContext?.containerBlock;
    if (!activeContainer || containerContext.currentBlock.type !== containerContext.containerType) return;

    const changes = getChanges();
    const convertedContainerToList = changes.find((change: any) => (
      change.type === 'update' &&
      change.block?.id === activeContainer.id &&
      isListType(change.block?.type)
    ));
    const replacedContainerWithList =
      changes.some((change: any) => change.type === 'delete' && change.block?.id === activeContainer.id) &&
      changes.find((change: any) => change.type === 'insert' && isListType(change.block?.type));
    const listChange = convertedContainerToList || replacedContainerWithList;
    if (!listChange) return;

    const containerId = activeContainer.id;
    const listType = listChange.block.type;
    const listContent = Array.isArray(listChange.block.content) && listChange.block.content.length > 0
      ? listChange.block.content
      : EMPTY_TEXT_CONTENT;

    setTimeout(() => {
      refs.redirectingListIntoAlertRef.current = true;
      try {
        const currentContainer = editor.getBlock(containerId);
        if (!currentContainer || !isContainerType(currentContainer.type)) return;

        const existingChildren = Array.isArray(currentContainer.children) ? currentContainer.children : [];
        const updatedContainer = editor.updateBlock(currentContainer, {
          children: [...existingChildren, { type: listType, content: listContent }],
        });

        const inserted = updatedContainer.children?.[updatedContainer.children.length - 1];
        if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'end');
      } finally {
        refs.redirectingListIntoAlertRef.current = false;
      }
    }, 0);

    return false;
  };
}

export function handleSharedBlockNoteContainerKeydown({
  editor,
  event,
  refs,
}: {
  editor: any;
  event: KeyboardEvent;
  refs: SharedBlockNoteContainerRefs;
}) {
  if (event.key !== 'Enter') {
    refs.alertExitArmedRef.current = false;
    refs.alertExitTargetRef.current = null;
    refs.alertExitPlaceholderRef.current = null;
  }

  const containerContext = getContainerContextAtCursor(editor);
  const isAlertContainer = containerContext?.containerType === 'alert';
  if (!containerContext) {
    return false;
  }

  if (
    event.key === ' ' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    containerContext.currentBlock.type === containerContext.containerType
  ) {
    const currentLine = getCurrentLineTextBeforeCursor(editor);
    const orderedMatch = currentLine.match(/^(\d+)\.$/);
    const bulletMatch = currentLine.match(/^[-*+]$/);
    if (orderedMatch || bulletMatch) {
      event.preventDefault();
      event.stopPropagation();

      const latestContainer = editor.getBlock(containerContext.containerBlock.id);
      if (!latestContainer || !isContainerType(latestContainer.type)) return true;

      const listType = orderedMatch ? 'numberedListItem' : 'bulletListItem';
      const fullText = getBlockPlainText(latestContainer);
      const markerPattern = orderedMatch ? /(?:^|\n)\d+\.$/ : /(?:^|\n)[-*+]$/;
      const cleanedText = fullText.replace(markerPattern, '').replace(/\n$/, '');
      const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];

      refs.redirectingListIntoAlertRef.current = true;
      try {
        const updatedContainer = editor.updateBlock(latestContainer, {
          content: cleanedText,
          children: [...existingChildren, { type: listType, content: EMPTY_TEXT_CONTENT }],
        });
        const inserted = updatedContainer.children?.[updatedContainer.children.length - 1];
        if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
      } finally {
        refs.redirectingListIntoAlertRef.current = false;
      }
      return true;
    }
  }

  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    isAlertContainer &&
    containerContext.currentBlock.type === 'alert'
  ) {
    event.preventDefault();
    event.stopPropagation();
    const latestContainer = editor.getBlock(containerContext.containerBlock.id);
    if (!latestContainer || !isContainerType(latestContainer.type)) return true;
    const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];
    const firstChild = existingChildren[0];

    if (firstChild?.type === 'paragraph' && !hasInlineTextContent(firstChild.content)) {
      editor.setTextCursorPosition(firstChild.id, 'start');
    } else {
      refs.redirectingListIntoAlertRef.current = true;
      try {
        const updatedContainer = editor.updateBlock(latestContainer, {
          children: [{ type: 'paragraph', content: EMPTY_TEXT_CONTENT }, ...existingChildren],
        });
        const inserted = updatedContainer.children?.[0];
        if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
      } finally {
        refs.redirectingListIntoAlertRef.current = false;
      }
    }

    refs.alertExitArmedRef.current = false;
    refs.alertExitTargetRef.current = null;
    refs.alertExitPlaceholderRef.current = null;
    return true;
  }

  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    isListType(containerContext.currentBlock.type)
  ) {
    event.preventDefault();
    event.stopPropagation();
    const current = editor.getBlock(containerContext.currentBlock.id);
    if (!current) return true;
    const currentText = getBlockPlainText(current).trim();

    refs.redirectingListIntoAlertRef.current = true;
    try {
      if (currentText === '') {
        editor.removeBlocks([current.id]);
        const latestContainer = editor.getBlock(containerContext.containerBlock.id);
        if (latestContainer && isContainerType(latestContainer.type)) {
          const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];
          const updatedContainer = editor.updateBlock(latestContainer, {
            children: [...existingChildren, { type: 'paragraph', content: EMPTY_TEXT_CONTENT }],
          });
          const placeholder = updatedContainer.children?.[updatedContainer.children.length - 1];
          if (placeholder?.id) {
            editor.setTextCursorPosition(placeholder.id, 'start');
            refs.alertExitPlaceholderRef.current = placeholder.id;
          }
          refs.alertExitArmedRef.current = isAlertContainer;
          refs.alertExitTargetRef.current = latestContainer.id;
        }
        return true;
      }

      const inserted = editor.insertBlocks([{ type: current.type, content: EMPTY_TEXT_CONTENT }], current.id, 'after')?.[0];
      if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
      refs.alertExitArmedRef.current = false;
      refs.alertExitTargetRef.current = null;
      refs.alertExitPlaceholderRef.current = null;
    } finally {
      refs.redirectingListIntoAlertRef.current = false;
    }
    return true;
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && refs.alertExitArmedRef.current) {
    event.preventDefault();
    event.stopPropagation();
    const targetContainerId = containerContext?.containerBlock?.id || refs.alertExitTargetRef.current;
    if (!targetContainerId) {
      refs.alertExitArmedRef.current = false;
      return true;
    }

    const latestContainer = editor.getBlock(targetContainerId);
    if (!latestContainer || !isContainerType(latestContainer.type)) return true;
    const placeholderId = refs.alertExitPlaceholderRef.current;
    if (placeholderId) {
      const placeholderBlock = editor.getBlock(placeholderId);
      const parent = placeholderBlock ? editor.getParentBlock(placeholderBlock.id) : null;
      if (placeholderBlock && parent?.id === latestContainer.id) {
        editor.removeBlocks([placeholderBlock.id]);
      }
    }

    const inserted = editor.insertBlocks([{ type: 'paragraph', content: EMPTY_TEXT_CONTENT }], latestContainer.id, 'after')?.[0];
    if (inserted?.id) {
      setTimeout(() => {
        editor.setTextCursorPosition(inserted.id, 'start');
      }, 0);
    }
    refs.alertExitArmedRef.current = false;
    refs.alertExitTargetRef.current = null;
    refs.alertExitPlaceholderRef.current = null;
    return true;
  }

  return false;
}
