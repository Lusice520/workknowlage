import { useEffect, useMemo, useRef } from 'react';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '../../shared/editor/blocknoteReactNoComments';
import { SharedBlockNoteSurface, fromDocumentToInitialBlocks, kbSchema, serializeEditorDocument } from '../../shared/editor';
import type { DocumentFocusTarget, DocumentRecord, MentionDocumentCandidate } from '../../shared/types/workspace';
import { useEditorPersistence, type EditorSaveStatus } from './useEditorPersistence';

export interface EditorHostShareInfo {
  token: string;
  url?: string;
}

interface EditorHostProps {
  document: DocumentRecord;
  mentionDocuments?: MentionDocumentCandidate[];
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
  onUploadFiles: (documentId: string, files: File[]) => Promise<string[]>;
  onSaveStatusChange?: (status: EditorSaveStatus) => void;
  onContentSnapshotReady?: (getContentJson: () => string) => void;
  focusTarget?: DocumentFocusTarget | null;
}

export function EditorHost({
  document,
  mentionDocuments = [],
  onSaveDocumentContent,
  onUploadFiles,
  onSaveStatusChange,
  onContentSnapshotReady,
  focusTarget = null,
}: EditorHostProps) {
  const editorHostRef = useRef<HTMLElement | null>(null);
  const initialBlocks = useMemo(
    () => fromDocumentToInitialBlocks(document),
    [document.contentJson, document.id, document.sections]
  );

  const editor = useCreateBlockNote({
    schema: kbSchema,
    dictionary: zh,
    disableExtensions: ['tableHandles'],
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
    if (!editor || !focusTarget || focusTarget.documentId !== document.id) {
      return;
    }

    const blockId = focusTarget.blockId;
    if (!blockId) {
      return;
    }

    let focusedBlockElement: HTMLElement | null = null;
    let focusedBlockContentElement: HTMLElement | null = null;
    let clearHighlightTimeoutId: number | null = null;
    const focusTimeoutId = window.setTimeout(() => {
      const blockElement = editorHostRef.current?.querySelector(`[data-id="${blockId}"]`) as HTMLElement | null;
      if (!blockElement) {
        return;
      }

      const editorSurface = editorHostRef.current?.querySelector('.shared-blocknote-surface') as HTMLElement | null;
      const blockContentElement = blockElement.querySelector('.bn-block-content') as HTMLElement | null;
      focusedBlockElement = blockElement;
      focusedBlockContentElement = blockContentElement;

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

      blockElement.classList.add('wk-block-focus-target');
      blockContentElement?.classList.add('wk-block-focus-target-content');
      clearHighlightTimeoutId = window.setTimeout(() => {
        blockElement.classList.remove('wk-block-focus-target');
        blockContentElement?.classList.remove('wk-block-focus-target-content');
      }, 1800);
    }, 0);

    return () => {
      window.clearTimeout(focusTimeoutId);
      if (clearHighlightTimeoutId !== null) {
        window.clearTimeout(clearHighlightTimeoutId);
      }
      focusedBlockElement?.classList.remove('wk-block-focus-target');
      focusedBlockContentElement?.classList.remove('wk-block-focus-target-content');
    };
  }, [document.id, editor, focusTarget?.blockId, focusTarget?.documentId, focusTarget?.requestKey]);

  return (
    <section ref={editorHostRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <SharedBlockNoteSurface
          className="h-full"
          editor={editor}
          uploadFiles={(files) => onUploadFiles(document.id, files)}
          mentionDocuments={mentionDocuments}
          currentDocumentId={document.id}
        />
      </div>
    </section>
  );
}
