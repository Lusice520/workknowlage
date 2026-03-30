import { useEffect, useRef, useState } from 'react';
import { serializeEditorDocument } from '../../shared/editor/blockAdapter';

export type EditorSaveStatus = 'saved' | 'saving' | 'error';

interface UseEditorPersistenceOptions {
  debounceMs?: number;
  documentId: string;
  editor: any;
  initialContentJson: string;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
}

export const useEditorPersistence = ({
  debounceMs = 500,
  documentId,
  editor,
  initialContentJson,
  onSaveDocumentContent,
}: UseEditorPersistenceOptions): EditorSaveStatus => {
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('saved');
  const lastSavedContentRef = useRef(initialContentJson);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastSavedContentRef.current = initialContentJson;
    setSaveStatus('saved');
  }, [documentId, initialContentJson]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }

    const cancelPendingSave = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };

    const unsubscribe = editor.onChange(() => {
      cancelPendingSave();
      if (!editor?.prosemirrorView?.composing) {
        setSaveStatus((currentStatus) => (currentStatus === 'saving' ? currentStatus : 'saving'));
      }

      saveTimerRef.current = window.setTimeout(async () => {
        const nextContentJson = serializeEditorDocument(editor.document);
        if (nextContentJson === lastSavedContentRef.current) {
          setSaveStatus('saved');
          return;
        }

        try {
          await onSaveDocumentContent(documentId, nextContentJson);
          lastSavedContentRef.current = nextContentJson;
          setSaveStatus('saved');
        } catch (error) {
          console.error('[EditorHost] Failed to persist editor content:', error);
          setSaveStatus('error');
        }
      }, debounceMs);
    });

    return () => {
      unsubscribe?.();
      cancelPendingSave();
    };
  }, [debounceMs, documentId, editor, onSaveDocumentContent]);

  return saveStatus;
};
