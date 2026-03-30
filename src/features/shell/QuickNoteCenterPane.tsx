import { useCallback, useEffect, useMemo, useState } from 'react';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '../../shared/editor/blocknoteReactNoComments';
import { AlertTriangle, CheckCheck, FilePlus2, LoaderCircle, NotebookPen } from 'lucide-react';
import {
  SharedBlockNoteSurface,
  fromDocumentToInitialBlocks,
  kbSchema,
} from '../../shared/editor';
import { getQuickNoteTitle } from '../../shared/lib/quickNotes';
import type { QuickNoteRecord } from '../../shared/types/workspace';
import { useEditorPersistence, type EditorSaveStatus } from '../editor-host/useEditorPersistence';
import { cacheQuickNoteRecord, prefetchQuickNoteRecord } from './quickNoteCache';

interface QuickNoteCenterPaneProps {
  noteDate: string;
  onSaveQuickNoteContent: (noteDate: string, contentJson: string) => Promise<QuickNoteRecord>;
  onCaptureQuickNote: (noteDate: string) => Promise<unknown>;
  onUploadFiles: (quickNoteId: string, files: File[]) => Promise<string[]>;
}

const saveStatusMeta = {
  saved: {
    className: 'text-emerald-600 hover:text-emerald-700',
    icon: CheckCheck,
    label: '保存状态：已自动保存',
    spin: false,
  },
  saving: {
    className: 'text-amber-600 hover:text-amber-700',
    icon: LoaderCircle,
    label: '保存状态：正在保存',
    spin: true,
  },
  error: {
    className: 'text-rose-600 hover:text-rose-700',
    icon: AlertTriangle,
    label: '保存状态：保存失败',
    spin: false,
  },
} as const;

export function QuickNoteCenterPane({
  noteDate,
  onSaveQuickNoteContent,
  onCaptureQuickNote,
  onUploadFiles,
}: QuickNoteCenterPaneProps) {
  const [note, setNote] = useState<QuickNoteRecord | null>(null);
  const [persistedNoteId, setPersistedNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    prefetchQuickNoteRecord(noteDate)
      .then((nextNote) => {
        if (!cancelled) {
          setNote(nextNote);
          setPersistedNoteId(nextNote?.id ?? null);
        }
      })
      .catch((error) => {
        console.error('[QuickNoteCenterPane] Failed to load daily quick note:', error);
        if (!cancelled) {
          setNote(null);
          setPersistedNoteId(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [noteDate]);

  const initialContentJson = note?.contentJson ?? '[]';
  const initialBlocks = useMemo(
    () => fromDocumentToInitialBlocks({ contentJson: initialContentJson, sections: [] }),
    [initialContentJson, note?.id, noteDate]
  );

  const editor = useCreateBlockNote({
    schema: kbSchema,
    dictionary: zh,
    disableExtensions: ['tableHandles'],
    initialContent: initialBlocks,
  }, [note?.id ?? noteDate]);

  const handleSaveContent = useCallback(async (_resourceId: string, contentJson: string) => {
    const nextNote = await onSaveQuickNoteContent(noteDate, contentJson);
    cacheQuickNoteRecord(noteDate, nextNote);
    setNote(nextNote);
    setPersistedNoteId(nextNote.id);
    return nextNote;
  }, [noteDate, onSaveQuickNoteContent]);

  const saveStatus = useEditorPersistence({
    documentId: persistedNoteId ?? noteDate,
    editor,
    initialContentJson,
    onSaveDocumentContent: handleSaveContent,
  });

  const saveAction = saveStatusMeta[saveStatus];
  const SaveIcon = saveAction.icon;
  const title = getQuickNoteTitle(noteDate);
  const captureLabel = capturing ? '正在沉淀为文档' : '沉淀为文档';

  const handleCapture = useCallback(async () => {
    if (capturing) {
      return;
    }

    setCapturing(true);
    try {
      await onCaptureQuickNote(noteDate);
    } finally {
      setCapturing(false);
    }
  }, [capturing, noteDate, onCaptureQuickNote]);

  const handleUploadFiles = useCallback(async (files: File[]) => {
    let nextNoteId = persistedNoteId;

    if (!nextNoteId) {
      const createdNote = await onSaveQuickNoteContent(
        noteDate,
        JSON.stringify(Array.isArray(editor?.document) ? editor.document : [])
      );
      cacheQuickNoteRecord(noteDate, createdNote);
      nextNoteId = createdNote.id;
      setPersistedNoteId(createdNote.id);
    }

    return onUploadFiles(nextNoteId, files);
  }, [editor?.document, noteDate, onSaveQuickNoteContent, onUploadFiles, persistedNoteId]);

  return (
    <section
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="flex items-center justify-between border-b border-[rgba(148,163,184,0.16)] pb-4">
        <nav className="flex items-center gap-2 text-[11px] font-medium text-[var(--wk-muted)]">
          <span>每日快记</span>
          <span>›</span>
          <span className="text-[var(--wk-ink)]">{noteDate}</span>
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={captureLabel}
            title={captureLabel}
            disabled={loading || capturing}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 px-3 py-1.5 text-[12px] font-medium text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleCapture();
            }}
          >
            {capturing ? <LoaderCircle size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
            <span>{captureLabel}</span>
          </button>
          <button
            type="button"
            aria-label={saveAction.label}
            title={saveAction.label}
            disabled
            className={`rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 p-1.5 transition ${saveAction.className} disabled:cursor-default disabled:opacity-100`}
          >
            <SaveIcon size={15} className={saveAction.spin ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        <div className="px-1">
          <h1 className="text-[22px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--wk-ink)]">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)]">
            <span>{noteDate}</span>
            <span className="h-1 w-1 rounded-full bg-[rgba(148,163,184,0.9)]" />
            <span className="rounded-full bg-[rgba(59,130,246,0.08)] px-3 py-1 text-[11px] font-medium text-[var(--wk-accent)]">
              #每日快记
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              不参与分享
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70">
            <div className="flex items-center gap-2 text-[13px] text-slate-400">
              <NotebookPen size={15} />
              <span>正在加载当日快记...</span>
            </div>
          </div>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
              <SharedBlockNoteSurface
                className="h-full"
                editor={editor}
                uploadFiles={handleUploadFiles}
              />
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
