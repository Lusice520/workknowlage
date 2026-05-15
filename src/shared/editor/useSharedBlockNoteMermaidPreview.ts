import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useEditorChange } from './blocknoteReactNoComments';
import { MERMAID_PREVIEW_CLASS } from './KnowledgeBaseCodeBlock';

const CODE_BLOCK_SELECTOR = '.bn-block-content[data-content-type="codeBlock"]';
const PREVIEW_SELECTOR = `:scope > .${MERMAID_PREVIEW_CLASS}`;
const MERMAID_LANGUAGE = 'mermaid';

export interface EditorMermaidRenderer {
  render: (id: string, source: string) => Promise<{ svg: string }> | { svg: string };
}

export interface MermaidPreviewRenderOptions {
  loadRenderer?: () => Promise<EditorMermaidRenderer>;
  renderer?: EditorMermaidRenderer;
}

export interface MermaidPreviewRenderStats {
  failed: number;
  removed: number;
  rendered: number;
  skipped: number;
}

let mermaidRendererPromise: Promise<EditorMermaidRenderer> | null = null;
let mermaidRenderId = 0;

const hashText = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `${value.length}-${hash >>> 0}`;
};

const getCodeBlockLanguage = (block: HTMLElement) => {
  const select = block.querySelector<HTMLSelectElement>(':scope > div > select');
  return String(
    select?.value
      || select?.getAttribute('value')
      || block.dataset.language
      || block.getAttribute('data-language')
      || block.getAttribute('language')
      || '',
  ).trim().toLowerCase();
};

const getCodeBlockSource = (block: HTMLElement) => {
  const code = block.querySelector<HTMLElement>(':scope > pre > code');
  return code?.textContent || '';
};

const getPreviewElement = (block: HTMLElement) =>
  block.querySelector<HTMLElement>(PREVIEW_SELECTOR);

const removePreviewElement = (block: HTMLElement) => {
  const preview = getPreviewElement(block);
  if (preview) {
    const wasActive = !preview.hidden || preview.dataset.state !== 'idle';
    preview.hidden = true;
    preview.innerHTML = '';
    preview.dataset.state = 'idle';
    preview.removeAttribute('data-error');
    preview.removeAttribute('data-edit');
    preview.removeAttribute('data-source-hash');
    return wasActive;
  }
  return false;
};

const loadEditorMermaidRenderer = async (): Promise<EditorMermaidRenderer> => {
  if (!mermaidRendererPromise) {
    mermaidRendererPromise = (async () => {
      try {
        const mod = await import('mermaid');
        const mermaid = (mod as any).default || mod;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'default',
        });
        return {
          render: (id: string, source: string) => mermaid.render(id, source),
        };
      } catch (error) {
        mermaidRendererPromise = null;
        throw error;
      }
    })();
  }
  return mermaidRendererPromise;
};

const isRenderer = (
  input: EditorMermaidRenderer | MermaidPreviewRenderOptions | undefined,
): input is EditorMermaidRenderer => (
  typeof input === 'object'
  && input !== null
  && 'render' in input
  && typeof input.render === 'function'
);

const resolveRenderer = (
  input: EditorMermaidRenderer | MermaidPreviewRenderOptions | undefined,
) => {
  if (isRenderer(input)) return input;
  return input?.renderer;
};

const resolveLoader = (
  input: EditorMermaidRenderer | MermaidPreviewRenderOptions | undefined,
) => (isRenderer(input) ? loadEditorMermaidRenderer : input?.loadRenderer || loadEditorMermaidRenderer);

const isInsideMermaidPreview = (element: Element) => (
  element.classList.contains(MERMAID_PREVIEW_CLASS)
  || element.closest(`.${MERMAID_PREVIEW_CLASS}`) !== null
);

const hasCodeBlockInside = (element: Element) => (
  element.matches(CODE_BLOCK_SELECTOR)
  || element.querySelector(CODE_BLOCK_SELECTOR) !== null
  || element.closest(CODE_BLOCK_SELECTOR) !== null
);

const mutationTouchesCodeBlock = (mutation: MutationRecord) => {
  if (mutation.target instanceof Element && isInsideMermaidPreview(mutation.target)) {
    return false;
  }
  if (mutation.target instanceof Element && hasCodeBlockInside(mutation.target)) {
    return true;
  }
  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => (
    node instanceof Element && hasCodeBlockInside(node)
  ));
};

export const observeMermaidPreviewDomChanges = (
  root: HTMLElement,
  scheduleRefresh: () => void,
) => {
  if (typeof MutationObserver !== 'function') {
    return () => {};
  }
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutationTouchesCodeBlock)) {
      scheduleRefresh();
    }
  });
  observer.observe(root, {
    attributeFilter: ['data-content-type', 'data-language', 'language'],
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
};

const TEMP_DIV_PREFIX = 'dwk-editor-mermaid-';

const cleanupMermaidTempDivs = () => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`[id^="${TEMP_DIV_PREFIX}"]`).forEach((el) => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
};

export const renderMermaidPreviewsInEditorRoot = async (
  root: HTMLElement | null,
  options?: EditorMermaidRenderer | MermaidPreviewRenderOptions,
): Promise<MermaidPreviewRenderStats> => {
  const stats = { failed: 0, removed: 0, rendered: 0, skipped: 0 };
  if (!root) return stats;

  const jobs: Array<{
    block: HTMLElement;
    preview: HTMLElement;
    source: string;
    sourceHash: string;
  }> = [];

  root.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTOR).forEach((block) => {
    const language = getCodeBlockLanguage(block);
    const source = getCodeBlockSource(block);

    if (language !== MERMAID_LANGUAGE || source.trim().length === 0) {
      if (removePreviewElement(block)) {
        stats.removed += 1;
      }
      return;
    }

    const sourceHash = hashText(source);
    const preview = getPreviewElement(block);
    if (!preview) {
      stats.skipped += 1;
      return;
    }

    if (preview.dataset.sourceHash === sourceHash) {
      if (preview.dataset.state === 'rendered' || preview.dataset.state === 'loading') {
        stats.skipped += 1;
        return;
      }
    }

    preview.dataset.sourceHash = sourceHash;
    preview.dataset.state = 'loading';
    preview.hidden = false;
    preview.removeAttribute('data-error');
    preview.textContent = '';
    jobs.push({ block, preview, source, sourceHash });
  });

  if (jobs.length === 0) {
    cleanupMermaidTempDivs();
    return stats;
  }

  let activeRenderer = resolveRenderer(options);
  if (!activeRenderer) {
    jobs.forEach(({ preview }) => {
      preview.textContent = '加载 Mermaid 渲染器...';
      preview.hidden = false;
      preview.dataset.state = 'loading';
    });
    try {
      activeRenderer = await resolveLoader(options)();
      jobs.forEach(({ preview }) => { preview.textContent = ''; });
    } catch (err) {
      const loadMessage = err instanceof Error ? err.message : String(err || '');
      jobs.forEach(({ block, preview, sourceHash }) => {
        if (getCodeBlockLanguage(block) !== MERMAID_LANGUAGE || hashText(getCodeBlockSource(block)) !== sourceHash) {
          return;
        }
        preview.textContent = `Mermaid 加载失败${loadMessage ? `: ${loadMessage}` : ''}`;
        preview.hidden = false;
        preview.dataset.state = 'error';
        preview.dataset.error = 'true';
        stats.failed += 1;
      });
      cleanupMermaidTempDivs();
      return stats;
    }
  }
  const renderer = activeRenderer;

  await Promise.all(jobs.map(async ({ block, preview, source, sourceHash }) => {
    const renderId = `wk-editor-mermaid-${mermaidRenderId += 1}`;
    try {
      const { svg } = await renderer.render(renderId, source);
      if (getCodeBlockLanguage(block) !== MERMAID_LANGUAGE || hashText(getCodeBlockSource(block)) !== sourceHash) {
        return;
      }
      preview.innerHTML = svg;
      preview.hidden = false;
      preview.dataset.state = 'rendered';

      stats.rendered += 1;
    } catch (err) {
      if (hashText(getCodeBlockSource(block)) !== sourceHash) {
        return;
      }
      const renderMessage = err instanceof Error ? err.message : String(err || '');
      preview.textContent = `Mermaid 渲染失败${renderMessage ? `: ${renderMessage}` : ''}`;
      preview.hidden = false;
      preview.dataset.state = 'error';
      preview.dataset.error = 'true';
      stats.failed += 1;
    }
  }));

  cleanupMermaidTempDivs();

  return stats;
};

const scheduleFrame = (callback: () => void) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    const frame = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame(frame);
  }
  const timeout = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timeout);
};

export const useSharedBlockNoteMermaidPreview = ({
  editor,
  editorBodyRef,
}: {
  editor: any;
  editorBodyRef: RefObject<HTMLElement | null>;
}) => {
  const cancelScheduledRefreshRef = useRef<(() => void) | null>(null);

  const schedulePreviewRefresh = useCallback(() => {
    cancelScheduledRefreshRef.current?.();
    cancelScheduledRefreshRef.current = scheduleFrame(() => {
      cancelScheduledRefreshRef.current = null;
      void renderMermaidPreviewsInEditorRoot(editorBodyRef.current);
    });
  }, [editorBodyRef]);

  useEffect(() => {
    schedulePreviewRefresh();
    return () => {
      cancelScheduledRefreshRef.current?.();
      cancelScheduledRefreshRef.current = null;
    };
  }, [schedulePreviewRefresh]);

  useEffect(() => {
    const root = editorBodyRef.current;
    if (!root) return undefined;
    root.addEventListener('change', schedulePreviewRefresh, true);
    root.addEventListener('input', schedulePreviewRefresh, true);
    const disconnectDomObserver = observeMermaidPreviewDomChanges(root, schedulePreviewRefresh);
    return () => {
      root.removeEventListener('change', schedulePreviewRefresh, true);
      root.removeEventListener('input', schedulePreviewRefresh, true);
      disconnectDomObserver();
    };
  }, [editorBodyRef, schedulePreviewRefresh]);

  useEditorChange(schedulePreviewRefresh, editor);
};
