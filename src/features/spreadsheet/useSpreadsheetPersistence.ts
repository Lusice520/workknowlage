import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpreadsheetWorkbookRecord } from '../../shared/types/preload';

export type SpreadsheetSaveStatus = 'saved' | 'saving' | 'error';

interface SpreadsheetWorkbookHandle {
  save: () => unknown;
}

interface UseSpreadsheetPersistenceOptions {
  debounceMs?: number;
  documentId: string;
  onSaveStatusChange?: (status: SpreadsheetSaveStatus) => void;
  onSaveSpreadsheetWorkbook: (documentId: string, workbookJson: string) => Promise<SpreadsheetWorkbookRecord>;
}

export function useSpreadsheetPersistence({
  debounceMs = 900,
  documentId,
  onSaveStatusChange,
  onSaveSpreadsheetWorkbook,
}: UseSpreadsheetPersistenceOptions) {
  const [saveStatus, setSaveStatus] = useState<SpreadsheetSaveStatus>('saved');
  const workbookRef = useRef<SpreadsheetWorkbookHandle | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const updateSaveStatus = useCallback((status: SpreadsheetSaveStatus) => {
    if (!mountedRef.current) {
      return;
    }

    setSaveStatus(status);
  }, []);

  const clearPendingSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const persistWorkbook = useCallback(async (options: { silent?: boolean } = {}) => {
    const workbook = workbookRef.current;

    if (!workbook) {
      if (!options.silent) {
        updateSaveStatus('error');
      }
      return;
    }

    clearPendingSave();

    if (!options.silent) {
      updateSaveStatus('saving');
    }

    try {
      await onSaveSpreadsheetWorkbook(documentId, JSON.stringify(workbook.save()));
      if (!options.silent) {
        updateSaveStatus('saved');
      }
    } catch (error) {
      console.error('[SpreadsheetEditorHost] Failed to persist workbook:', error);
      if (!options.silent) {
        updateSaveStatus('error');
      }
    }
  }, [clearPendingSave, documentId, onSaveSpreadsheetWorkbook, updateSaveStatus]);

  const scheduleSave = useCallback(() => {
    clearPendingSave();
    updateSaveStatus('saving');
    saveTimeoutRef.current = window.setTimeout(() => {
      void persistWorkbook();
    }, debounceMs);
  }, [clearPendingSave, debounceMs, persistWorkbook, updateSaveStatus]);

  const attachWorkbook = useCallback((workbook: SpreadsheetWorkbookHandle | null) => {
    clearPendingSave();
    workbookRef.current = workbook;
    updateSaveStatus('saved');
  }, [clearPendingSave, updateSaveStatus]);

  const getWorkbookJson = useCallback((fallback: unknown) => {
    return JSON.stringify(workbookRef.current?.save() ?? fallback);
  }, []);

  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [onSaveStatusChange, saveStatus]);

  useEffect(() => {
    clearPendingSave();
    updateSaveStatus('saved');
  }, [clearPendingSave, documentId, updateSaveStatus]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (saveTimeoutRef.current !== null && workbookRef.current) {
        void persistWorkbook({ silent: true });
      }
      clearPendingSave();
      workbookRef.current = null;
    };
  }, [clearPendingSave, persistWorkbook]);

  return {
    attachWorkbook,
    flushSave: persistWorkbook,
    getWorkbookJson,
    saveStatus,
    scheduleSave,
  };
}
