import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '../../shared/editor/blocknoteReactNoComments';
import { SharedBlockNoteSurface, fromDocumentToInitialBlocks, kbSchema, serializeEditorDocument } from '../../shared/editor';
import { NumberedListHydrationExtension } from '../../shared/editor/numberedListHydrationExtension';
import type { DocumentFocusTarget, DocumentRecord, MentionDocumentCandidate } from '../../shared/types/workspace';
import { useEditorPersistence, type EditorSaveStatus } from './useEditorPersistence';

type EditorBlockLike = {
  id?: string;
  props?: unknown;
  content?: unknown;
  children?: unknown;
};

type TransientSearchHighlightRequest = {
  autoClearMs?: number;
  query: string;
  requestKey: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const flattenInlineText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenInlineText(item)).join('');
  }

  const record = asRecord(value);
  if (!record) {
    return '';
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    return typeof props?.title === 'string' && props.title.trim().length > 0 ? `@${props.title.trim()}` : '';
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return [flattenInlineText(record.content), flattenInlineText(record.children)].join('');
};

const getBlockPropsText = (value: unknown): string => {
  const record = asRecord(value);
  if (!record) {
    return '';
  }

  return [
    typeof record.name === 'string' ? record.name : '',
    typeof record.title === 'string' ? record.title : '',
    typeof record.caption === 'string' ? record.caption : '',
    typeof record.label === 'string' ? record.label : '',
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');
};

const getBlockPlainText = (block: EditorBlockLike): string =>
  [flattenInlineText(block.content), getBlockPropsText(block.props)].join(' ').replace(/\s+/g, ' ').trim();

const normalizeFocusText = (value: string) =>
  value
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toLowerCase();

const getLcsLength = (left: string, right: string): number => {
  if (!left || !right) {
    return 0;
  }

  const rows = left.length;
  const cols = right.length;
  const dp = new Int32Array(cols + 1);

  for (let row = 1; row <= rows; row += 1) {
    let prev = 0;
    for (let col = 1; col <= cols; col += 1) {
      const nextPrev = dp[col];
      if (left[row - 1] === right[col - 1]) {
        dp[col] = prev + 1;
      } else {
        dp[col] = Math.max(dp[col], dp[col - 1]);
      }
      prev = nextPrev;
    }
  }

  return dp[cols];
};

const findEditorDocumentBlockIdByText = (blocks: unknown[], fallbackText: string): string | null => {
  const normalizedFallbackText = normalizeFocusText(fallbackText);
  if (!normalizedFallbackText) {
    return null;
  }

  let bestMatchId: string | null = null;
  let bestMatchScore = 0;
  let bestMatchRatio = 0;

  const visitBlocks = (items: unknown[]) => {
    items.forEach((item) => {
      const block = asRecord(item) as EditorBlockLike | null;
      if (!block || typeof block.id !== 'string') {
        return;
      }

      const normalizedBlockText = normalizeFocusText(getBlockPlainText(block));
      if (normalizedBlockText.length > 0) {
        const lcs = getLcsLength(normalizedFallbackText, normalizedBlockText);
        const minLength = Math.min(normalizedFallbackText.length, normalizedBlockText.length);
        const ratio = lcs / minLength;

        if (ratio >= 0.4 && lcs >= 2) {
          if (lcs > bestMatchScore || (lcs === bestMatchScore && ratio > bestMatchRatio)) {
            bestMatchId = block.id;
            bestMatchScore = lcs;
            bestMatchRatio = ratio;
          }
        }
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        visitBlocks(block.children);
      }
    });
  };

  visitBlocks(blocks);
  return bestMatchId;
};

export interface EditorHostShareInfo {
  token: string;
  url?: string;
}

export interface EditorHostFocusDiagnostic {
  code: 'focus-timeout' | 'highlight-no-match';
  documentId: string;
  requestedBlockId: string;
  resolvedBlockId?: string | null;
  fallbackText?: string;
  matchCount?: number;
  message: string;
  requestKey: number;
}

interface EditorHostProps {
  document: DocumentRecord;
  mentionDocuments?: MentionDocumentCandidate[];
  onContentSnapshotReady?: (getContentJson: () => string) => void;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
  onSaveStatusChange?: (status: EditorSaveStatus) => void;
  onFocusDiagnostic?: (diagnostic: EditorHostFocusDiagnostic) => void;
  onFocusTargetConsumed?: (requestKey: number) => void;
  onUploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  focusTarget?: DocumentFocusTarget | null;
}

export function EditorHost({
  document,
  mentionDocuments = [],
  onSaveDocumentContent,
  onUploadFiles,
  onSaveStatusChange,
  onContentSnapshotReady,
  onFocusDiagnostic,
  onFocusTargetConsumed,
  focusTarget = null,
}: EditorHostProps) {
  const editorHostRef = useRef<HTMLElement | null>(null);
  const activeFocusTargetRef = useRef<DocumentFocusTarget | null>(null);
  const activeResolvedBlockIdRef = useRef<string | null>(null);
  const fallbackBlockHighlightTimeoutRef = useRef<number | null>(null);
  const [transientSearchHighlight, setTransientSearchHighlight] = useState<TransientSearchHighlightRequest | null>(null);
  const initialBlocks = useMemo(
    () => fromDocumentToInitialBlocks(document),
    [document.contentJson, document.id, document.sections],
  );

  const editor = useCreateBlockNote({
    schema: kbSchema,
    dictionary: zh,
    extensions: [NumberedListHydrationExtension],
    initialContent: initialBlocks,
  }, [document.id]);

  const saveStatus = useEditorPersistence({
    documentId: document.id,
    editor,
    initialContentJson: document.contentJson,
    onSaveDocumentContent,
  });

  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [onSaveStatusChange, saveStatus]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    onContentSnapshotReady?.(() => serializeEditorDocument(editor.document));
  }, [editor, onContentSnapshotReady]);

  useEffect(() => {
    if (!focusTarget || focusTarget.documentId !== document.id) {
      activeFocusTargetRef.current = null;
      activeResolvedBlockIdRef.current = null;
      setTransientSearchHighlight(null);
      return;
    }

    activeFocusTargetRef.current = focusTarget;
    activeResolvedBlockIdRef.current = null;
  }, [document.id, focusTarget]);

  const handleTransientSearchStatusChange = useCallback((event: {
    matchCount: number;
    query: string;
    requestKey: number;
    status: 'matched' | 'no-match';
  }) => {
    const activeFocusTarget = activeFocusTargetRef.current;
    if (
      !activeFocusTarget ||
      activeFocusTarget.documentId !== document.id ||
      activeFocusTarget.requestKey !== event.requestKey ||
      event.status !== 'no-match'
    ) {
      return;
    }

    const resolvedBlockId = activeResolvedBlockIdRef.current;
    if (resolvedBlockId) {
      const blockElement = editorHostRef.current?.querySelector(`[data-id="${resolvedBlockId}"]`) as HTMLElement | null;
      const blockContentElement = blockElement?.querySelector('.bn-block-content') as HTMLElement | null;
      blockElement?.classList.add('wk-block-focus-target');
      blockContentElement?.classList.add('wk-block-focus-target-content');

      if (fallbackBlockHighlightTimeoutRef.current !== null) {
        window.clearTimeout(fallbackBlockHighlightTimeoutRef.current);
      }

      fallbackBlockHighlightTimeoutRef.current = window.setTimeout(() => {
        blockElement?.classList.remove('wk-block-focus-target');
        blockContentElement?.classList.remove('wk-block-focus-target-content');
      }, 1800);
    }

    const diagnostic: EditorHostFocusDiagnostic = {
      code: 'highlight-no-match',
      documentId: document.id,
      requestedBlockId: activeFocusTarget.blockId,
      resolvedBlockId,
      fallbackText: event.query,
      matchCount: event.matchCount,
      message: '已跳转到目标区块，但没有找到可高亮的匹配文本。',
      requestKey: event.requestKey,
    };

    console.warn('[EditorHost] No transient search match found for focus target:', diagnostic);
    onFocusDiagnostic?.(diagnostic);
  }, [document.id, onFocusDiagnostic]);

  useEffect(() => () => {
    if (fallbackBlockHighlightTimeoutRef.current !== null) {
      window.clearTimeout(fallbackBlockHighlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!editor || !focusTarget || focusTarget.documentId !== document.id) {
      return;
    }

    const requestedBlockId = focusTarget.blockId;
    if (!requestedBlockId) {
      return;
    }

    let clearBlockHighlightTimeoutId: number | null = null;
    let focusTimeoutId: number | null = null;
    let focusRafId: number | null = null;
    let focusObserver: MutationObserver | null = null;
    let attempts = 0;
    let resolved = false;
    let resolvedBlockId: string | null = null;
    const maxAttempts = 50;
    const reportedDiagnosticCodes = new Set<EditorHostFocusDiagnostic['code']>();

    const getBlockSelector = (value: string) => `[data-id="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;

    const cleanupFocusObserver = () => {
      focusObserver?.disconnect();
      focusObserver = null;
    };

    const emitFocusDiagnostic = (diagnostic: EditorHostFocusDiagnostic) => {
      if (reportedDiagnosticCodes.has(diagnostic.code)) {
        return;
      }

      reportedDiagnosticCodes.add(diagnostic.code);
      console.warn('[EditorHost] Focus diagnostic:', diagnostic);
      onFocusDiagnostic?.(diagnostic);
    };

    const applyBlockHighlight = (blockElement: HTMLElement) => {
      const blockContentElement = blockElement.querySelector('.bn-block-content') as HTMLElement | null;
      blockElement.classList.add('wk-block-focus-target');
      blockContentElement?.classList.add('wk-block-focus-target-content');
      clearBlockHighlightTimeoutId = window.setTimeout(() => {
        blockElement.classList.remove('wk-block-focus-target');
        blockContentElement?.classList.remove('wk-block-focus-target-content');
      }, 1800);
    };

    const findBlockByFallbackText = (fallbackText: string): HTMLElement | null => {
      const normalizedFallbackText = normalizeFocusText(fallbackText);
      if (!normalizedFallbackText) {
        return null;
      }

      const candidateBlocks = Array.from(
        editorHostRef.current?.querySelectorAll('[data-id]') ?? [],
      ) as HTMLElement[];

      let bestCandidate: HTMLElement | null = null;
      let bestScore = 0;
      let bestRatio = 0;

      candidateBlocks.forEach((candidate) => {
        const candidateText = normalizeFocusText(candidate.textContent ?? '');
        if (candidateText.length > 0) {
          const lcs = getLcsLength(normalizedFallbackText, candidateText);
          const minLength = Math.min(normalizedFallbackText.length, candidateText.length);
          const ratio = lcs / minLength;

          if (ratio >= 0.4 && lcs >= 2) {
            if (lcs > bestScore || (lcs === bestScore && ratio > bestRatio)) {
              bestCandidate = candidate;
              bestScore = lcs;
              bestRatio = ratio;
            }
          }
        }
      });

      return bestCandidate;
    };

    const resolveTargetBlockId = () => {
      if (resolvedBlockId) {
        return resolvedBlockId;
      }

      const exactBlock = editorHostRef.current?.querySelector(getBlockSelector(requestedBlockId)) as HTMLElement | null;
      if (exactBlock) {
        resolvedBlockId = requestedBlockId;
        activeResolvedBlockIdRef.current = resolvedBlockId;
        return resolvedBlockId;
      }

      if (focusTarget.fallbackText) {
        const matchedEditorBlockId = findEditorDocumentBlockIdByText(editor.document ?? [], focusTarget.fallbackText);
        if (matchedEditorBlockId) {
          resolvedBlockId = matchedEditorBlockId;
          activeResolvedBlockIdRef.current = resolvedBlockId;
          return resolvedBlockId;
        }

        const matchedDomBlock = findBlockByFallbackText(focusTarget.fallbackText);
        const matchedDomBlockId = matchedDomBlock?.getAttribute('data-id');
        if (matchedDomBlockId) {
          resolvedBlockId = matchedDomBlockId;
          activeResolvedBlockIdRef.current = resolvedBlockId;
          return resolvedBlockId;
        }
      }

      return requestedBlockId;
    };

    const scrollToTargetBlock = (blockId: string) => {
      const blockElement = editorHostRef.current?.querySelector(getBlockSelector(blockId)) as HTMLElement | null;
      if (!blockElement) {
        return false;
      }

      const editorSurface = editorHostRef.current?.querySelector('.shared-blocknote-surface') as HTMLElement | null;
      if (editorSurface) {
        const blockRect = blockElement.getBoundingClientRect();
        const surfaceRect = editorSurface.getBoundingClientRect();
        const nextTop = Math.max(
          0,
          editorSurface.scrollTop +
            (blockRect.top - surfaceRect.top) -
            Math.max((surfaceRect.height - blockRect.height) / 2, 0),
        );

        if (typeof editorSurface.scrollTo === 'function') {
          editorSurface.scrollTo({ top: nextTop, behavior: 'smooth' });
        } else {
          editorSurface.scrollTop = nextTop;
        }
      } else {
        blockElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }

      if (!focusTarget.fallbackText) {
        applyBlockHighlight(blockElement);
      }

      return true;
    };

    const tryFocusBlock = () => {
      if (resolved) {
        return;
      }

      const nextBlockId = resolveTargetBlockId();
      if (!nextBlockId) {
        return;
      }

      const blockElement = editorHostRef.current?.querySelector(getBlockSelector(nextBlockId)) as HTMLElement | null;
      if (!blockElement) {
        if (attempts >= maxAttempts) {
          cleanupFocusObserver();
          emitFocusDiagnostic({
            code: 'focus-timeout',
            documentId: document.id,
            requestedBlockId,
            resolvedBlockId: activeResolvedBlockIdRef.current,
            fallbackText: focusTarget.fallbackText,
            message: '未能定位到目标区块，请检查文稿格式或目标文本是否仍然存在。',
            requestKey: focusTarget.requestKey,
          });
          return;
        }

        attempts += 1;
        focusTimeoutId = window.setTimeout(tryFocusBlock, 90);
        return;
      }

      resolved = true;
      cleanupFocusObserver();
      activeResolvedBlockIdRef.current = nextBlockId;

      const transientHighlightQuery = focusTarget.highlightQuery?.trim() || focusTarget.fallbackText?.trim();
      if (transientHighlightQuery) {
        setTransientSearchHighlight({
          query: transientHighlightQuery,
          requestKey: focusTarget.requestKey,
          autoClearMs: 2600,
        });
      } else {
        setTransientSearchHighlight(null);
      }

      focusRafId = window.setTimeout(() => {
        scrollToTargetBlock(nextBlockId);
        onFocusTargetConsumed?.(focusTarget.requestKey);
      }, 0);
    };

    if (editorHostRef.current && typeof MutationObserver !== 'undefined') {
      focusObserver = new MutationObserver(() => {
        if (resolved) {
          return;
        }
        tryFocusBlock();
      });
      focusObserver.observe(editorHostRef.current, {
        childList: true,
        subtree: true,
      });
    }

    focusTimeoutId = window.setTimeout(tryFocusBlock, 0);

    return () => {
      cleanupFocusObserver();
      if (focusTimeoutId !== null) {
        window.clearTimeout(focusTimeoutId);
      }
      if (focusRafId !== null) {
        window.clearTimeout(focusRafId);
      }
      if (clearBlockHighlightTimeoutId !== null) {
        window.clearTimeout(clearBlockHighlightTimeoutId);
      }
    };
  }, [document.id, editor, focusTarget, onFocusDiagnostic, onFocusTargetConsumed]);

  return (
    <section ref={editorHostRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <SharedBlockNoteSurface
          className="h-full"
          editor={editor}
          uploadFiles={(files) => onUploadFiles(document.id, files)}
          mentionDocuments={mentionDocuments}
          currentDocumentId={document.id}
          onTransientSearchStatusChange={handleTransientSearchStatusChange}
          transientSearchRequest={transientSearchHighlight}
        />
      </div>
    </section>
  );
}
