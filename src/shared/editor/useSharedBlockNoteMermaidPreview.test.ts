import { describe, expect, test, vi } from 'vitest';
import {
  observeMermaidPreviewDomChanges,
  renderMermaidPreviewsInEditorRoot,
} from './useSharedBlockNoteMermaidPreview';
import { MERMAID_PREVIEW_CLASS } from './KnowledgeBaseCodeBlock';

const getPreview = (block: HTMLElement) =>
  block.querySelector<HTMLElement>(`:scope > .${MERMAID_PREVIEW_CLASS}`);

const createCodeBlock = ({
  code,
  dataLanguage,
  language,
  withSelector = true,
}: {
  code: string;
  dataLanguage?: string;
  language: string;
  withSelector?: boolean;
}) => {
  const block = document.createElement('div');
  block.className = 'bn-block-content';
  block.setAttribute('data-content-type', 'codeBlock');
  if (dataLanguage) block.setAttribute('data-language', dataLanguage);

  const select = document.createElement('select');
  if (withSelector) {
    const selectWrapper = document.createElement('div');
    ['text', 'mermaid', 'typescript'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = language;
    selectWrapper.appendChild(select);
    block.appendChild(selectWrapper);
  }

  const pre = document.createElement('pre');
  const codeElement = document.createElement('code');
  codeElement.textContent = code;
  pre.appendChild(codeElement);

  // Preview div is created by KnowledgeBaseCodeBlock.render
  const preview = document.createElement('div');
  preview.className = MERMAID_PREVIEW_CLASS;
  preview.contentEditable = 'false';
  preview.hidden = true;
  preview.dataset.state = 'idle';

  block.append(pre, preview);
  return { block, codeElement, preview, select };
};

describe('renderMermaidPreviewsInEditorRoot', () => {
  test('schedules a refresh when a Mermaid code block is mounted', async () => {
    const root = document.createElement('div');
    const scheduleRefresh = vi.fn();
    const disconnect = observeMermaidPreviewDomChanges(root, scheduleRefresh);
    root.appendChild(createCodeBlock({
      dataLanguage: 'mermaid', language: 'mermaid', code: 'flowchart TD\nA --> B',
    }).block);
    await Promise.resolve();
    expect(scheduleRefresh).toHaveBeenCalledTimes(1);
    disconnect();
  });

  test('renders Mermaid previews without replacing editable code', async () => {
    const root = document.createElement('div');
    const { block, codeElement, preview } = createCodeBlock({
      language: 'mermaid', code: 'graph TD\nA[PRD] --> B[SPEC]',
    });
    root.appendChild(block);
    const renderer = {
      render: vi.fn(async (id: string, source: string) => ({
        svg: `<svg data-render-id="${id}"><text>${source}</text></svg>`,
      })),
    };

    const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);
    expect(stats.rendered).toBe(1);
    expect(codeElement.textContent).toBe('graph TD\nA[PRD] --> B[SPEC]');
    expect(preview.hidden).toBe(false);
    expect(preview.dataset.state).toBe('rendered');
    expect(preview.querySelector('svg')).not.toBeNull();
  });

  test('adds a zoom control for rendered Mermaid previews', async () => {
    const root = document.createElement('div');
    const { block, preview } = createCodeBlock({
      language: 'mermaid', code: 'graph TD\nA[PRD] --> B[SPEC]',
    });
    root.appendChild(block);
    const renderer = {
      render: vi.fn(async () => ({ svg: '<svg data-kind="mermaid"><text>Zoom me</text></svg>' })),
    };

    await renderMermaidPreviewsInEditorRoot(root, renderer);
    const zoomButton = preview.querySelector<HTMLButtonElement>('.wk-mermaid-zoom-button');
    expect(zoomButton).not.toBeNull();
    expect(zoomButton?.getAttribute('aria-label')).toBe('放大 Mermaid 图');

    zoomButton?.click();
    const overlay = document.querySelector<HTMLElement>('.wk-mermaid-zoom-overlay');
    expect(overlay).not.toBeNull();
    const zoomedSvg = overlay?.querySelector<SVGElement>('svg');
    expect(zoomedSvg).not.toBeNull();
    expect(zoomedSvg?.style.width).toBe('150%');

    overlay?.querySelector<HTMLButtonElement>('.wk-mermaid-zoom-in')?.click();
    expect(zoomedSvg?.style.width).toBe('175%');

    overlay?.querySelector<HTMLButtonElement>('.wk-mermaid-zoom-out')?.click();
    expect(zoomedSvg?.style.width).toBe('150%');

    overlay?.querySelector<HTMLButtonElement>('.wk-mermaid-zoom-reset')?.click();
    expect(zoomedSvg?.style.width).toBe('100%');

    overlay?.querySelector<HTMLButtonElement>('.wk-mermaid-zoom-close')?.click();
    expect(document.querySelector('.wk-mermaid-zoom-overlay')).toBeNull();
  });

  test('renders previews from data-language before selector is ready', async () => {
    const root = document.createElement('div');
    const { block, preview } = createCodeBlock({
      dataLanguage: 'mermaid', language: 'text', withSelector: false, code: 'graph TD\nA --> B',
    });
    root.appendChild(block);
    const renderer = { render: vi.fn(async () => ({ svg: '<svg data-kind="mermaid" />' })) };
    const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);
    expect(stats.rendered).toBe(1);
    expect(preview.hidden).toBe(false);
    expect(preview.querySelector('svg')).not.toBeNull();
  });

  test('marks previews as errors when renderer cannot load', async () => {
    const root = document.createElement('div');
    const { block, preview } = createCodeBlock({
      language: 'mermaid', code: 'graph TD\nC --> D',
    });
    root.appendChild(block);
    const stats = await renderMermaidPreviewsInEditorRoot(root, {
      loadRenderer: async () => { throw new Error('chunk failed'); },
    });
    expect(stats.failed).toBe(1);
    expect(preview.hidden).toBe(false);
    expect(preview.dataset.state).toBe('error');
    expect(preview.textContent).toMatch(/^Mermaid 加载失败/);
  });

  test('removes stale previews when language is no longer Mermaid', async () => {
    const root = document.createElement('div');
    const { block, preview, select } = createCodeBlock({
      language: 'mermaid', code: 'graph TD\nE --> F',
    });
    root.appendChild(block);
    const renderer = { render: vi.fn(async () => ({ svg: '<svg />' })) };
    await renderMermaidPreviewsInEditorRoot(root, renderer);
    expect(preview.hidden).toBe(false);

    select.value = 'typescript';
    const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);
    expect(stats.removed).toBe(1);
    expect(preview.hidden).toBe(true);
    expect(preview.innerHTML).toBe('');
    expect(preview.dataset.state).toBe('idle');
  });

  test('marks invalid Mermaid as errors while keeping source visible', async () => {
    const root = document.createElement('div');
    const { block, codeElement, preview } = createCodeBlock({
      language: 'mermaid', code: 'not valid mermaid',
    });
    root.appendChild(block);
    const renderer = { render: vi.fn(async () => { throw new Error('parse failed'); }) };
    const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);
    expect(stats.failed).toBe(1);
    expect(codeElement.textContent).toBe('not valid mermaid');
    expect(preview.hidden).toBe(false);
    expect(preview.dataset.state).toBe('error');
    expect(preview.textContent).toMatch(/^Mermaid 渲染失败/);
  });

  test('renders a remounted preview with the same source immediately', async () => {
    const root = document.createElement('div');
    const source = 'graph TD\nSame --> Source';
    const first = createCodeBlock({ language: 'mermaid', code: source });
    root.appendChild(first.block);
    const renderer = { render: vi.fn(async () => ({ svg: '<svg data-kind="mermaid" />' })) };

    expect(await renderMermaidPreviewsInEditorRoot(root, renderer)).toEqual({
      failed: 0,
      removed: 0,
      rendered: 1,
      skipped: 0,
    });

    first.block.remove();
    const second = createCodeBlock({ language: 'mermaid', code: source });
    root.appendChild(second.block);
    const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);

    expect(stats.rendered).toBe(1);
    expect(second.preview.hidden).toBe(false);
    expect(second.preview.dataset.state).toBe('rendered');
  });
});
