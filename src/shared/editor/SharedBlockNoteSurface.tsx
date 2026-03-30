import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePanelController,
  GridSuggestionMenuController,
  LinkToolbarController,
  SideMenuController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from './blocknoteReactNoComments';
import { mergeCells, splitCell } from 'prosemirror-tables';
import {
  clampPreviewScale,
  KB_IMAGE_PREVIEW_EVENT,
  PREVIEW_SCALE_STEP,
} from './constants';
import { getDocumentMentionItems, getKnowledgeBaseSlashItems, isImageAttachment } from './editorSchema';
import { KnowledgeBaseEditorView } from './KnowledgeBaseEditorView';
import { KnowledgeBaseFormattingToolbar } from './KnowledgeBaseFormattingToolbar';
import { KnowledgeBaseImagePreview } from './KnowledgeBaseImagePreview';
import { SelectionFormattingToolbarController } from './SelectionFormattingToolbarController';
import { getCursorScrollDelta } from './scrollUtils';
import { blockNeedsTrailingParagraph, getDomActiveBlockId } from './editorBodyFocusUtils';
import type { MentionDocumentCandidate } from '../types/workspace';
import './SharedBlockNoteSurface.css';

const EMPTY_TEXT_CONTENT = [{ type: 'text', text: '' }];
const NOOP = () => {};

const joinClassNames = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

const isListType = (type: string) => type === 'bulletListItem' || type === 'numberedListItem';
const isContainerType = (type: string) => type === 'alert';
export const isEditorComposingInput = ({
  editor,
  event,
}: {
  editor: any;
  event?: Pick<KeyboardEvent, 'isComposing'> | null;
}) => Boolean(event?.isComposing || editor?.prosemirrorView?.composing);

const getBlockPlainText = (block: any) => {
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

const getCurrentLineTextBeforeCursor = (editor: any) => {
  const selection = editor.prosemirrorView?.state?.selection;
  const textBefore = selection?.$from?.parent?.textBetween?.(0, selection.$from.parentOffset, '\n', '\n') || '';
  return textBefore.split('\n').pop() || '';
};

const hasInlineTextContent = (content: any) => {
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

const collectMisplacedAlertHeaders = (blocks: any[], repairs: any[] = []) => {
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

const getSlashItems = async (editor: any, query: string) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const mergedItems = [
    ...getKnowledgeBaseSlashItems(editor),
    ...getDefaultReactSlashMenuItems(editor),
  ];

  return mergedItems.filter((item) => {
    const title = String(item.title || '').toLowerCase();
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    return title.startsWith(normalizedQuery) || aliases.some((alias: string) => alias.toLowerCase().startsWith(normalizedQuery));
  });
};

export interface SharedBlockNoteSurfaceProps {
  className?: string;
  editor: any;
  showToast?: (message: string, type?: string) => void;
  uploadFiles?: (files: File[]) => Promise<string[]>;
  mentionDocuments?: MentionDocumentCandidate[];
  currentDocumentId?: string | null;
}

export const SharedBlockNoteSurface = ({
  className = '',
  editor,
  showToast = NOOP,
  uploadFiles,
  mentionDocuments = [],
  currentDocumentId = null,
}: SharedBlockNoteSurfaceProps) => {
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; name?: string } | null>(null);
  const [imagePreviewScale, setImagePreviewScale] = useState(1);
  const redirectingListIntoAlertRef = useRef(false);
  const alertExitArmedRef = useRef(false);
  const alertExitTargetRef = useRef<string | null>(null);
  const alertExitPlaceholderRef = useRef<string | null>(null);
  const editorBodyRef = useRef<HTMLDivElement | null>(null);
  const dynamicBottomActiveRef = useRef(false);
  const alertHeaderNormalizationDoneRef = useRef(false);
  const applyingAlertHeaderNormalizationRef = useRef(false);

  const uploadClipboardFiles = useCallback(async (files: File[]) => {
    if (!uploadFiles || !files || files.length === 0) return [];

    try {
      return await uploadFiles(files);
    } catch (error) {
      console.error(error);
      showToast('文件上传失败', 'error');
      return [];
    }
  }, [showToast, uploadFiles]);

  const insertUploadedBlocks = useCallback((urls: string[], files: File[]) => {
    if (!editor || !urls?.length) return;
    const cursorBlockId =
      editor.getTextCursorPosition()?.block?.id ||
      editor.document?.[editor.document.length - 1]?.id;
    if (!cursorBlockId) return;

    const blocks = urls.map((url, index) => {
      const file = files[index];
      const name = file?.name || url.split('/').pop() || '附件';
      return {
        type: 'kbAttachment',
        props: {
          url,
          name,
          isImage: isImageAttachment(file, url, name),
        },
      };
    });

    editor.insertBlocks(blocks, cursorBlockId, 'after');
  }, [editor]);

  const extractFiles = useCallback((dataTransfer: DataTransfer | null | undefined) => {
    if (!dataTransfer) return [];
    const transferFiles = Array.from(dataTransfer.files || []).filter((file) => file && file.size >= 0);
    if (transferFiles.length > 0) return transferFiles;
    if (!dataTransfer.items?.length) return [];

    const files: File[] = [];
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return files;
  }, []);

  const insertTrailingParagraphAfterBlock = useCallback((blockId: string) => {
    if (!editor || !blockId) return null;
    const inserted = editor.insertBlocks(
      [{ type: 'paragraph', content: EMPTY_TEXT_CONTENT }],
      blockId,
      'after'
    )?.[0];

    if (inserted?.id) {
      editor.setTextCursorPosition(inserted.id, 'start');
      return inserted;
    }

    return null;
  }, [editor]);

  const focusEditorAtEnd = useCallback(() => {
    if (!editor) return;
    const blocks = Array.isArray(editor.document) ? editor.document : [];
    const fallbackBlock = blocks[blocks.length - 1];
    if (fallbackBlock?.id && blockNeedsTrailingParagraph(fallbackBlock)) {
      const inserted = insertTrailingParagraphAfterBlock(fallbackBlock.id);
      if (inserted?.id) {
        editor.prosemirrorView?.focus?.();
        return;
      }
    }
    if (fallbackBlock?.id) {
      editor.setTextCursorPosition(fallbackBlock.id, 'end');
    }
    editor.prosemirrorView?.focus?.();
  }, [editor, insertTrailingParagraphAfterBlock]);

  const closeImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const zoomInPreviewImage = useCallback(() => {
    setImagePreviewScale((prev) => clampPreviewScale(prev + PREVIEW_SCALE_STEP));
  }, []);

  const zoomOutPreviewImage = useCallback(() => {
    setImagePreviewScale((prev) => clampPreviewScale(prev - PREVIEW_SCALE_STEP));
  }, []);

  const resetPreviewImageZoom = useCallback(() => {
    setImagePreviewScale(1);
  }, []);

  useEffect(() => {
    alertHeaderNormalizationDoneRef.current = false;
    applyingAlertHeaderNormalizationRef.current = false;
  }, [editor]);

  const handleEditorBodyMouseDownCapture = useCallback((event: React.MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      target.closest('.bn-inline-content') ||
      target.closest('.bn-block-content') ||
      target.closest('.bn-suggestion-menu') ||
      target.closest('.bn-suggestion-menu-item') ||
      target.closest('.bn-grid-suggestion-menu') ||
      target.closest('.bn-grid-suggestion-menu-item') ||
      target.closest('.bn-side-menu') ||
      target.closest('.bn-drag-handle-menu') ||
      target.closest('.rt-top-toolbar') ||
      target.closest('.rt-handle-menu') ||
      target.closest('.kb-attachment-open') ||
      target.closest('.kb-attachment-image-link') ||
      target.closest('button, a, input, select, textarea, [role="button"], [role="menu"], [role="menuitem"], [role="listbox"], [role="option"]')
    ) {
      return;
    }

    requestAnimationFrame(() => {
      focusEditorAtEnd();
    });
  }, [focusEditorAtEnd]);

  useEffect(() => {
    if (!editor) return undefined;

    const normalizeMisplacedAlertHeaders = () => {
      if (alertHeaderNormalizationDoneRef.current || applyingAlertHeaderNormalizationRef.current) return;
      if (editor?.prosemirrorView?.composing) return;

      const repairs = collectMisplacedAlertHeaders(editor.document);
      if (repairs.length === 0) return;

      applyingAlertHeaderNormalizationRef.current = true;
      try {
        repairs.forEach((repair) => {
          const target = editor.getBlock(repair.id);
          if (!target || target.type !== 'alert') return;
          if (repair.content !== undefined) {
            editor.updateBlock(target, {
              content: repair.content,
            });
          }
          if (repair.firstChildId) {
            const latestFirstChild = editor.getBlock(repair.firstChildId);
            const latestParent = latestFirstChild ? editor.getParentBlock(repair.firstChildId) : null;
            if (latestFirstChild && latestParent?.id === repair.id) {
              editor.removeBlocks([repair.firstChildId]);
            }
          }
        });
        alertHeaderNormalizationDoneRef.current = true;
      } finally {
        applyingAlertHeaderNormalizationRef.current = false;
      }
    };

    const normalizationTimer = setTimeout(() => {
      normalizeMisplacedAlertHeaders();
    }, 0);
    const unsubscribeNormalization = editor.onChange(() => {
      normalizeMisplacedAlertHeaders();
    });

    const getContainerContextAtCursor = () => {
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

    const getTableContextAtCursor = () => {
      const cursor = editor.getTextCursorPosition();
      const currentBlock = cursor?.block;
      if (!currentBlock) return null;
      if (currentBlock.type === 'table') return { tableBlock: currentBlock, currentBlock };
      const parent = editor.getParentBlock(currentBlock.id);
      if (parent?.type === 'table') return { tableBlock: parent, currentBlock };
      return null;
    };

    const unsubscribe = editor.onBeforeChange(({ getChanges }: any) => {
      if (redirectingListIntoAlertRef.current) return;

      const changes = getChanges();
      const containerContext = getContainerContextAtCursor();
      const activeContainer = containerContext?.containerBlock;
      if (!activeContainer || containerContext.currentBlock.type !== containerContext.containerType) return;

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
        redirectingListIntoAlertRef.current = true;
        try {
          const currentContainer = editor.getBlock(containerId);
          if (!currentContainer || !isContainerType(currentContainer.type)) return;

          const existingChildren = Array.isArray(currentContainer.children) ? currentContainer.children : [];
          const updatedContainer = editor.updateBlock(currentContainer, {
            children: [
              ...existingChildren,
              { type: listType, content: listContent },
            ],
          });

          const inserted = updatedContainer.children?.[updatedContainer.children.length - 1];
          if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'end');
        } finally {
          redirectingListIntoAlertRef.current = false;
        }
      }, 0);

      return false;
    });

    const keydownHandler = (event: KeyboardEvent) => {
      if (isEditorComposingInput({ editor, event })) {
        return;
      }

      if (event.key !== 'Enter') {
        alertExitArmedRef.current = false;
        alertExitTargetRef.current = null;
        alertExitPlaceholderRef.current = null;
      }

      const target = event.target instanceof Element ? event.target : null;
      const selectedBlocks = editor.getSelection()?.blocks;
      const selectedBlock = Array.isArray(selectedBlocks) && selectedBlocks.length === 1 ? selectedBlocks[0] : null;
      const blocks = Array.isArray(editor.document) ? editor.document : [];
      const fallbackBlock = blocks[blocks.length - 1];

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !target?.closest('.rt-editor') &&
        selectedBlock?.id &&
        selectedBlock.id === fallbackBlock?.id &&
        blockNeedsTrailingParagraph(selectedBlock)
      ) {
        event.preventDefault();
        event.stopPropagation();
        insertTrailingParagraphAfterBlock(selectedBlock.id);
        return;
      }

      const containerContext = getContainerContextAtCursor();
      const isAlertContainer = containerContext?.containerType === 'alert';

      if (
        containerContext &&
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
          if (!latestContainer || !isContainerType(latestContainer.type)) return;

          const listType = orderedMatch ? 'numberedListItem' : 'bulletListItem';
          const fullText = getBlockPlainText(latestContainer);
          const markerPattern = orderedMatch ? /(?:^|\n)\d+\.$/ : /(?:^|\n)[-*+]$/;
          const cleanedText = fullText.replace(markerPattern, '').replace(/\n$/, '');
          const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];

          redirectingListIntoAlertRef.current = true;
          try {
            const updatedContainer = editor.updateBlock(latestContainer, {
              content: cleanedText,
              children: [
                ...existingChildren,
                { type: listType, content: EMPTY_TEXT_CONTENT },
              ],
            });
            const inserted = updatedContainer.children?.[updatedContainer.children.length - 1];
            if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
          } finally {
            redirectingListIntoAlertRef.current = false;
          }
          return;
        }
      }

      if (
        containerContext &&
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
        if (!latestContainer || !isContainerType(latestContainer.type)) return;

        const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];
        const firstChild = existingChildren[0];

        if (firstChild?.type === 'paragraph' && !hasInlineTextContent(firstChild.content)) {
          editor.setTextCursorPosition(firstChild.id, 'start');
        } else {
          redirectingListIntoAlertRef.current = true;
          try {
            const updatedContainer = editor.updateBlock(latestContainer, {
              children: [
                { type: 'paragraph', content: EMPTY_TEXT_CONTENT },
                ...existingChildren,
              ],
            });
            const inserted = updatedContainer.children?.[0];
            if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
          } finally {
            redirectingListIntoAlertRef.current = false;
          }
        }

        alertExitArmedRef.current = false;
        alertExitTargetRef.current = null;
        alertExitPlaceholderRef.current = null;
        return;
      }

      if (
        containerContext &&
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
        if (!current) return;
        const currentText = getBlockPlainText(current).trim();

        redirectingListIntoAlertRef.current = true;
        try {
          if (currentText === '') {
            editor.removeBlocks([current.id]);
            const latestContainer = editor.getBlock(containerContext.containerBlock.id);
            if (latestContainer && isContainerType(latestContainer.type)) {
              const existingChildren = Array.isArray(latestContainer.children) ? latestContainer.children : [];
              const updatedContainer = editor.updateBlock(latestContainer, {
                children: [
                  ...existingChildren,
                  { type: 'paragraph', content: EMPTY_TEXT_CONTENT },
                ],
              });
              const placeholder = updatedContainer.children?.[updatedContainer.children.length - 1];
              if (placeholder?.id) {
                editor.setTextCursorPosition(placeholder.id, 'start');
                alertExitPlaceholderRef.current = placeholder.id;
              }
              alertExitArmedRef.current = isAlertContainer;
              alertExitTargetRef.current = latestContainer.id;
            }
            return;
          }

          const inserted = editor.insertBlocks(
            [{ type: current.type, content: EMPTY_TEXT_CONTENT }],
            current.id,
            'after'
          )?.[0];
          if (inserted?.id) editor.setTextCursorPosition(inserted.id, 'start');
          alertExitArmedRef.current = false;
          alertExitTargetRef.current = null;
          alertExitPlaceholderRef.current = null;
        } finally {
          redirectingListIntoAlertRef.current = false;
        }
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        alertExitArmedRef.current
      ) {
        event.preventDefault();
        event.stopPropagation();

        const targetContainerId = containerContext?.containerBlock?.id || alertExitTargetRef.current;
        if (!targetContainerId) {
          alertExitArmedRef.current = false;
          return;
        }

        const latestContainer = editor.getBlock(targetContainerId);
        if (!latestContainer || !isContainerType(latestContainer.type)) return;
        const placeholderId = alertExitPlaceholderRef.current;
        if (placeholderId) {
          const placeholderBlock = editor.getBlock(placeholderId);
          const parent = placeholderBlock ? editor.getParentBlock(placeholderBlock.id) : null;
          if (placeholderBlock && parent?.id === latestContainer.id) {
            editor.removeBlocks([placeholderBlock.id]);
          }
        }

        const inserted = editor.insertBlocks(
          [{ type: 'paragraph', content: EMPTY_TEXT_CONTENT }],
          latestContainer.id,
          'after'
        )?.[0];
        if (inserted?.id) {
          setTimeout(() => {
            editor.setTextCursorPosition(inserted.id, 'start');
          }, 0);
        }
        alertExitArmedRef.current = false;
        alertExitTargetRef.current = null;
        alertExitPlaceholderRef.current = null;
        return;
      }

      const tableContext = getTableContextAtCursor();
      if (!tableContext) return;

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'm') {
        const view = editor.prosemirrorView;
        const state = view?.state;
        if (!view || !state) return;
        event.preventDefault();
        event.stopPropagation();
        mergeCells(state, view.dispatch);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'j') {
        const view = editor.prosemirrorView;
        const state = view?.state;
        if (!view || !state) return;
        event.preventDefault();
        event.stopPropagation();
        splitCell(state, view.dispatch);
        return;
      }

      if (event.key === ' ' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const currentLine = getCurrentLineTextBeforeCursor(editor);
        if (/^[-*+]$/.test(currentLine)) {
          event.preventDefault();
          event.stopPropagation();

          const view = editor.prosemirrorView;
          const state = view?.state;
          if (!view || !state) return;
          const from = state.selection.from - currentLine.length;
          const to = state.selection.from;
          view.dispatch(state.tr.insertText('• ', from, to));
          return;
        }
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const currentLine = getCurrentLineTextBeforeCursor(editor);
        const orderedMatch = currentLine.match(/^(\d+)\.\s+.+$/);
        const bulletMatch = currentLine.match(/^(?:[-*+]|•)\s+.+$/);
        if (!orderedMatch && !bulletMatch) return;

        const nextPrefix = orderedMatch ? `${Number(orderedMatch[1]) + 1}. ` : '• ';
        setTimeout(() => {
          const stillInTable = getTableContextAtCursor();
          if (!stillInTable) return;
          const lineAfterEnter = getCurrentLineTextBeforeCursor(editor);
          if (lineAfterEnter.trim() !== '') return;
          editor.insertInlineContent(nextPrefix);
        }, 0);
      }
    };

    const dom = editor.prosemirrorView?.dom;
    dom?.addEventListener('keydown', keydownHandler, true);

    return () => {
      clearTimeout(normalizationTimer);
      unsubscribeNormalization?.();
      unsubscribe();
      dom?.removeEventListener('keydown', keydownHandler, true);
    };
  }, [editor, insertTrailingParagraphAfterBlock]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOpenImagePreview = (event: CustomEvent) => {
      const url = String(event?.detail?.url || '').trim();
      if (!url) return;
      setImagePreview({
        url,
        name: String(event?.detail?.name || '图片预览'),
      });
      setImagePreviewScale(1);
    };

    window.addEventListener(KB_IMAGE_PREVIEW_EVENT, handleOpenImagePreview as EventListener);
    return () => {
      window.removeEventListener(KB_IMAGE_PREVIEW_EVENT, handleOpenImagePreview as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!imagePreview || typeof window === 'undefined') return undefined;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImagePreview(null);
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomInPreviewImage();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomOutPreviewImage();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        resetPreviewImageZoom();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [imagePreview, resetPreviewImageZoom, zoomInPreviewImage, zoomOutPreviewImage]);

  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return undefined;

    const handlePaste = async (event: ClipboardEvent) => {
      const files = extractFiles(event.clipboardData);
      if (files.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const urls = await uploadClipboardFiles(files);
      if (urls.length === 0) return;

      insertUploadedBlocks(urls, files);
      showToast(`已粘贴上传 ${urls.length} 个文件`, 'success');
    };

    dom.addEventListener('paste', handlePaste, true);
    return () => {
      dom.removeEventListener('paste', handlePaste, true);
    };
  }, [editor, extractFiles, insertUploadedBlocks, showToast, uploadClipboardFiles]);

  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return undefined;

    const handleDragOverUpload = (event: DragEvent) => {
      const files = extractFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setIsDragOverUpload(true);
    };

    const handleDragLeaveUpload = (event: DragEvent) => {
      if (!dom.contains(event.relatedTarget as Node)) {
        setIsDragOverUpload(false);
      }
    };

    const handleDropUpload = async (event: DragEvent) => {
      const files = extractFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverUpload(false);

      const urls = await uploadClipboardFiles(files);
      if (urls.length === 0) return;
      insertUploadedBlocks(urls, files);
      showToast(`已拖拽上传 ${urls.length} 个文件`, 'success');
    };

    dom.addEventListener('dragover', handleDragOverUpload, true);
    dom.addEventListener('dragleave', handleDragLeaveUpload, true);
    dom.addEventListener('drop', handleDropUpload, true);

    return () => {
      dom.removeEventListener('dragover', handleDragOverUpload, true);
      dom.removeEventListener('dragleave', handleDragLeaveUpload, true);
      dom.removeEventListener('drop', handleDropUpload, true);
    };
  }, [editor, extractFiles, insertUploadedBlocks, showToast, uploadClipboardFiles]);

  useEffect(() => {
    if (!editor) return undefined;
    let rafId: number | null = null;
    const bodyElement = editorBodyRef.current;
    const baseBottomPadding = '6px';
    const topThreshold = 8;
    const minDelta = 4;
    const visibleZoneRatio = 0.15;
    const minActivationGapPx = 12;
    const deactivateGapRatio = 0.45;

    const setDynamicBottomSpace = (scroller: HTMLDivElement, value: string) => {
      if (scroller.style.getPropertyValue('--shared-editor-dynamic-bottom-space') !== value) {
        scroller.style.setProperty('--shared-editor-dynamic-bottom-space', value);
      }
    };

    const keepCursorVisible = () => {
      if (editor?.prosemirrorView?.composing) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scroller = editorBodyRef.current;
        if (!scroller) return;
        const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
        const domBlockId = getDomActiveBlockId({
          rootElement: scroller,
          activeElement: typeof document !== 'undefined' ? document.activeElement : null,
          anchorNode: selection?.anchorNode || null,
          focusNode: selection?.focusNode || null,
        });
        const block = (domBlockId && editor.getBlock?.(domBlockId)) || editor.getTextCursorPosition?.()?.block;
        if (!block?.id) return;
        if (blockNeedsTrailingParagraph(block)) return;
        const blockEl = scroller.querySelector(`[data-id="${block.id}"]`);
        if (!blockEl) return;

        const scrollerRect = scroller.getBoundingClientRect();
        const blockRect = (blockEl as HTMLElement).getBoundingClientRect();
        const scrollerHeight = Math.max(0, scrollerRect.bottom - scrollerRect.top);
        if (scrollerHeight <= 0) return;
        const safeBottom = scrollerRect.bottom - scrollerHeight * visibleZoneRatio;
        const bottomOverflow = blockRect.bottom - safeBottom;

        const bottomDelta = getCursorScrollDelta({
          scrollerTop: scrollerRect.top,
          scrollerBottom: scrollerRect.bottom,
          blockBottom: blockRect.bottom,
          visibleZoneRatio,
          minDelta: 1,
        });

        const activationGap = Math.max(minActivationGapPx, Math.round(scrollerHeight * 0.03));
        const shouldActivate = bottomOverflow > -activationGap;

        if (!dynamicBottomActiveRef.current && shouldActivate) {
          dynamicBottomActiveRef.current = true;
          setDynamicBottomSpace(scroller, `${Math.round(scroller.clientHeight * visibleZoneRatio)}px`);
          return;
        }

        if (dynamicBottomActiveRef.current) {
          if (bottomOverflow < -Math.round(scrollerHeight * deactivateGapRatio)) {
            dynamicBottomActiveRef.current = false;
            setDynamicBottomSpace(scroller, baseBottomPadding);
            return;
          }

          if (bottomDelta > minDelta) {
            const maxStep = Math.max(12, Math.round(scrollerHeight * 0.04));
            const step = Math.min(bottomDelta, maxStep);
            scroller.scrollBy({ top: step, behavior: 'auto' });
          }
          return;
        }

        const topOverflow = blockRect.top - (scrollerRect.top + topThreshold);
        if (topOverflow < -minDelta) {
          scroller.scrollBy({ top: topOverflow, behavior: 'auto' });
        }
      });
    };

    const unsubscribe = editor.onChange(keepCursorVisible);
    return () => {
      unsubscribe?.();
      if (rafId) cancelAnimationFrame(rafId);
      if (bodyElement) {
        bodyElement.style.setProperty('--shared-editor-dynamic-bottom-space', baseBottomPadding);
      }
      dynamicBottomActiveRef.current = false;
    };
  }, [editor]);

  return (
    <>
      <div
        ref={editorBodyRef}
        className={joinClassNames('shared-blocknote-surface', 'custom-scrollbar', isDragOverUpload ? 'upload-drag-over' : '', className)}
        onMouseDownCapture={handleEditorBodyMouseDownCapture}
      >
        <KnowledgeBaseEditorView
          editor={editor}
          className="blocknote-unified-editor"
        >
          <SelectionFormattingToolbarController
            editor={editor}
            formattingToolbar={KnowledgeBaseFormattingToolbar}
          />
          <LinkToolbarController />
          <SideMenuController />
          <FilePanelController />
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={(query) => getSlashItems(editor, query)}
          />
          {mentionDocuments.length > 0 ? (
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={(query) => Promise.resolve(
                getDocumentMentionItems(editor, query, mentionDocuments, currentDocumentId)
              )}
            />
          ) : null}
          <GridSuggestionMenuController
            triggerCharacter=":"
            columns={10}
            minQueryLength={2}
          />
        </KnowledgeBaseEditorView>
      </div>
      <KnowledgeBaseImagePreview
        imagePreview={imagePreview}
        imagePreviewScale={imagePreviewScale}
        onClose={closeImagePreview}
        onZoomIn={zoomInPreviewImage}
        onZoomOut={zoomOutPreviewImage}
        onResetZoom={resetPreviewImageZoom}
      />
    </>
  );
};

export default SharedBlockNoteSurface;
