import { describe, expect, test, vi } from 'vitest';
import { createKnowledgeBaseCodeBlock, MERMAID_PREVIEW_CLASS } from './KnowledgeBaseCodeBlock';

describe('createKnowledgeBaseCodeBlock', () => {
  test('renders a code block with language selector and Mermaid preview placeholder', () => {
    const codeBlock = createKnowledgeBaseCodeBlock();
    const rendered = codeBlock.implementation.render.call({
      blockContentDOMAttributes: {},
      props: {},
      renderType: 'nodeView',
    } as any, {
      id: 'code-1',
      props: { language: 'mermaid' },
      type: 'codeBlock',
    } as any, {
      isEditable: true,
      updateBlock: vi.fn(),
    } as any);
    const host = document.createElement('div');
    host.appendChild(rendered.dom);

    const select = host.querySelector<HTMLSelectElement>('select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('mermaid');
    expect(select?.querySelectorAll('option')).toHaveLength(9);

    const code = host.querySelector('pre > code');
    expect(code).not.toBeNull();

    const preview = host.querySelector<HTMLElement>(`.${MERMAID_PREVIEW_CLASS}`);
    expect(preview).not.toBeNull();
    expect(preview?.contentEditable).toBe('false');
    expect(preview?.hidden).toBe(true);
    expect(preview?.dataset.state).toBe('idle');
    expect(rendered.dom.lastElementChild).toBe(preview);

    expect(rendered.ignoreMutation?.({ target: preview, type: 'childList' } as any)).toBe(true);
    expect(rendered.ignoreMutation?.({ target: code, type: 'childList' } as any)).toBe(false);

    preview!.click();
    expect(preview?.dataset.edit).toBeUndefined();

    preview!.dataset.state = 'rendered';
    preview!.click();
    expect(preview?.dataset.edit).toBe('true');
    preview!.click();
    expect(preview?.dataset.edit).toBe('false');
  });
});
