import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, FileText, FolderOpen, Import, Loader2, LoaderCircle } from 'lucide-react';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '../../shared/editor/blocknoteReactNoComments';
import { NumberedListHydrationExtension } from '../../shared/editor/numberedListHydrationExtension';
import {
  SharedBlockNoteSurface,
  kbSchema,
  serializeEditorDocument,
} from '../../shared/editor';
import {
  deriveOutlineFromContentJson,
  deriveWordCount,
} from '../../shared/lib/documentContent';
import type { ExternalMarkdownFileRecord, WorkKnowlageDesktopApi } from '../../shared/types/preload';
import type { OutlineItem } from '../../shared/types/workspace';

type SaveStatus = 'loading' | 'saved' | 'saving' | 'error';
type ExternalFilesApi = NonNullable<WorkKnowlageDesktopApi['externalFiles']>;

interface ExternalFileAppProps {
  externalFilesApi?: ExternalFilesApi;
}

const EMPTY_BLOCKS = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: '', styles: {} }],
    children: [],
  },
] as any[];

const YAML_FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

function extractYamlFrontmatter(markdown: string): string {
  return markdown.match(YAML_FRONTMATTER_PATTERN)?.[0] ?? '';
}

function restoreYamlFrontmatter(markdown: string, originalMarkdown: string): string {
  const originalFrontmatter = extractYamlFrontmatter(originalMarkdown);
  if (!originalFrontmatter || extractYamlFrontmatter(markdown)) {
    return markdown;
  }

  const body = markdown.replace(/^\s+/, '');
  return body ? `${originalFrontmatter.trimEnd()}\n\n${body}` : originalFrontmatter;
}

const getSaveStatusLabel = (status: SaveStatus) => {
  if (status === 'saving') {
    return '正在自动保存...';
  }
  if (status === 'error') {
    return '自动保存失败';
  }
  if (status === 'loading') {
    return '正在打开...';
  }
  return '已自动保存';
};

const getSaveStatusMeta = (status: SaveStatus) => {
  if (status === 'saving') {
    return {
      className: 'text-amber-600',
      icon: LoaderCircle,
      spin: true,
    };
  }

  if (status === 'error') {
    return {
      className: 'text-rose-600',
      icon: AlertTriangle,
      spin: false,
    };
  }

  if (status === 'loading') {
    return {
      className: 'text-slate-400',
      icon: LoaderCircle,
      spin: true,
    };
  }

  return {
    className: 'text-emerald-600',
    icon: CheckCheck,
    spin: false,
  };
};

export function ExternalFileApp({ externalFilesApi }: ExternalFileAppProps) {
  const [fileRecord, setFileRecord] = useState<ExternalMarkdownFileRecord | null>(null);
  const [contentJson, setContentJson] = useState('[]');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [feedback, setFeedback] = useState<string | null>(null);
  const hydrationInProgressRef = useRef(false);
  const originalMarkdownRef = useRef('');
  const lastSavedMarkdownRef = useRef('');
  const saveTimerRef = useRef<number | null>(null);

  const editor = useCreateBlockNote({
    schema: kbSchema,
    dictionary: zh,
    extensions: [NumberedListHydrationExtension],
    initialContent: EMPTY_BLOCKS,
  }, []);

  const outline = useMemo<OutlineItem[]>(
    () => deriveOutlineFromContentJson(contentJson),
    [contentJson],
  );
  const wordCountLabel = useMemo(
    () => `${deriveWordCount(contentJson)} 字`,
    [contentJson],
  );

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSaveTimer(), [clearSaveTimer]);

  useEffect(() => {
    let cancelled = false;
    if (!externalFilesApi) {
      setSaveStatus('error');
      setFeedback('当前运行环境不支持外部文件。');
      return;
    }

    void externalFilesApi.getInitial()
      .then((nextFileRecord) => {
        if (cancelled) {
          return;
        }

        hydrationInProgressRef.current = true;
        const parsedBlocks = editor.tryParseMarkdownToBlocks(nextFileRecord.markdown);
        const nextBlocks = Array.isArray(parsedBlocks) && parsedBlocks.length > 0 ? parsedBlocks : EMPTY_BLOCKS;
        editor.replaceBlocks(editor.document, nextBlocks as any);
        const nextContentJson = serializeEditorDocument(editor.document);
        const nextMarkdown = editor.blocksToMarkdownLossy(editor.document);
        const normalizedMarkdown = restoreYamlFrontmatter(nextMarkdown, nextFileRecord.markdown);

        originalMarkdownRef.current = nextFileRecord.markdown;
        lastSavedMarkdownRef.current = normalizedMarkdown;
        setFileRecord(nextFileRecord);
        setContentJson(nextContentJson);
        setSaveStatus('saved');
        hydrationInProgressRef.current = false;
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error('[ExternalFileApp] Failed to open external Markdown file:', error);
        setSaveStatus('error');
        setFeedback(error instanceof Error ? error.message : '打开外部文件失败');
      });

    return () => {
      cancelled = true;
    };
  }, [externalFilesApi, editor]);

  useEffect(() => {
    if (!externalFilesApi || !editor || !fileRecord) {
      return undefined;
    }

    const unsubscribe = editor.onChange(() => {
      if (hydrationInProgressRef.current) {
        return;
      }

      clearSaveTimer();
      const nextContentJson = serializeEditorDocument(editor.document);
      setContentJson(nextContentJson);
      if (!editor?.prosemirrorView?.composing) {
        setSaveStatus('saving');
      }

      saveTimerRef.current = window.setTimeout(async () => {
        const nextMarkdown = restoreYamlFrontmatter(
          editor.blocksToMarkdownLossy(editor.document),
          originalMarkdownRef.current,
        );
        if (nextMarkdown === lastSavedMarkdownRef.current) {
          setSaveStatus('saved');
          return;
        }

        try {
          const nextFileRecord = await externalFilesApi.saveMarkdown(nextMarkdown);
          lastSavedMarkdownRef.current = nextMarkdown;
          setFileRecord(nextFileRecord);
          setSaveStatus('saved');
        } catch (error) {
          console.error('[ExternalFileApp] Failed to save external Markdown file:', error);
          setSaveStatus('error');
        }
      }, 500);
    });

    return () => {
      unsubscribe?.();
      clearSaveTimer();
    };
  }, [externalFilesApi, clearSaveTimer, editor, fileRecord]);

  const handleRevealInFinder = useCallback(async () => {
    await externalFilesApi?.revealInFinder();
  }, [externalFilesApi]);

  const handleImportToWorkspace = useCallback(async () => {
    if (!fileRecord) {
      return;
    }

    try {
      const result = await externalFilesApi?.importToWorkspace({
        title: fileRecord.title,
        contentJson: serializeEditorDocument(editor.document),
      });
      setFeedback(result?.message ?? '已导入知识库');
    } catch (error) {
      console.error('[ExternalFileApp] Failed to import external file:', error);
      setFeedback(error instanceof Error ? error.message : '导入知识库失败');
    }
  }, [externalFilesApi, editor, fileRecord]);

  const handleOutlineClick = useCallback((item: OutlineItem) => {
    const blockElement = document.querySelector(`[data-id="${item.id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
    blockElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);
  const saveStatusMeta = getSaveStatusMeta(saveStatus);
  const SaveStatusIcon = saveStatusMeta.icon;

  if (!fileRecord && saveStatus === 'loading') {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-[var(--wk-ink-soft)]">
        <div className="flex items-center gap-3 rounded-[20px] border border-white/70 bg-white/70 px-5 py-4 text-[13px] font-medium shadow-[0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur-2xl">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在打开外部文件...
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="external-file-shell"
      data-scroll-mode="locked"
      data-shell-style="lightweight"
      data-typography="editorial-compact"
      className="relative h-screen overflow-hidden bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] p-2 text-[var(--wk-ink)]"
    >
      <div className="relative z-10 grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] gap-2">
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/40 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/5 backdrop-blur-2xl">
          <div className="rounded-[16px] border border-white/80 bg-white/70 p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold tracking-tight text-[var(--wk-ink)]">
                  {fileRecord?.title ?? '外部文件'}
                </p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  EXTERNAL MARKDOWN
                </p>
              </div>
            </div>
          </div>

          <nav aria-label="外部文件目录" className="mt-5 flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">目录</p>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                {outline.length}
              </span>
            </div>
            <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {outline.length > 0 ? outline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative mb-1 flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[12px] font-medium leading-none text-slate-600 transition-all duration-200 hover:bg-white/70 hover:text-slate-900"
                  style={{ paddingLeft: `${12 + Math.max(0, item.level - 1) * 14}px` }}
                  onClick={() => handleOutlineClick(item)}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-500" />
                  <span className="truncate">{item.title}</span>
                </button>
              )) : (
                <p className="rounded-[14px] bg-white/50 px-3 py-3 text-[12px] leading-5 text-slate-400">
                  暂无标题
                </p>
              )}
            </div>
          </nav>
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
          <header className="flex items-center justify-between gap-4 border-b border-[rgba(148,163,184,0.16)] pb-4">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[18px] font-semibold tracking-[-0.03em] text-[var(--wk-ink)]">
                  {fileRecord?.title ?? '外部文件'}
                </h1>
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600 ring-1 ring-blue-100">
                  外部文件
                </span>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[var(--wk-muted)]">
                <span className="max-w-[50vw] truncate">{fileRecord?.filePath ?? ''}</span>
                <span className={`inline-flex items-center gap-1 ${saveStatusMeta.className}`}>
                  <SaveStatusIcon size={13} className={saveStatusMeta.spin ? 'animate-spin' : ''} />
                  {getSaveStatusLabel(saveStatus)}
                </span>
                {fileRecord?.updatedAtLabel ? <span>{fileRecord.updatedAtLabel}</span> : null}
                <span>{wordCountLabel}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {feedback ? (
                <span className="max-w-48 truncate rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  {feedback}
                </span>
              ) : null}
              <button
                type="button"
                aria-label="在 Finder 中显示"
                title="在 Finder 中显示"
                className="inline-flex h-8 items-center gap-1.5 rounded-[12px] border border-[rgba(255,255,255,0.82)] bg-white/84 px-2.5 text-[12px] font-medium text-[var(--wk-ink-soft)] transition hover:text-[var(--wk-ink)]"
                onClick={handleRevealInFinder}
              >
                <FolderOpen size={15} />
                <span>Finder</span>
              </button>
              <button
                type="button"
                aria-label="导入知识库"
                title="导入知识库"
                className="inline-flex h-8 items-center gap-1.5 rounded-[12px] bg-slate-900 px-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                onClick={handleImportToWorkspace}
              >
                <Import size={15} />
                <span>导入知识库</span>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <SharedBlockNoteSurface
              className="h-full"
              editor={editor}
              uploadFiles={async () => []}
              mentionDocuments={[]}
              currentDocumentId="external-markdown-file"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default ExternalFileApp;
