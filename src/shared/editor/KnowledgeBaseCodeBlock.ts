import { createCodeBlockSpec, type CodeBlockOptions } from '@blocknote/core';

export const MERMAID_PREVIEW_CLASS = 'wk-mermaid-preview';

export const codeBlockLanguages: CodeBlockOptions['supportedLanguages'] = {
  text: { name: 'Plain Text', aliases: ['txt', 'plaintext'] },
  markdown: { name: 'Markdown', aliases: ['md'] },
  mermaid: { name: 'Mermaid', aliases: ['mmd'] },
  javascript: { name: 'JavaScript', aliases: ['js'] },
  typescript: { name: 'TypeScript', aliases: ['ts'] },
  json: { name: 'JSON' },
  css: { name: 'CSS' },
  html: { name: 'HTML' },
  shell: { name: 'Shell', aliases: ['sh', 'bash', 'zsh'] },
};

const isInsidePreview = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return (
    target.classList.contains(MERMAID_PREVIEW_CLASS)
    || target.closest(`.${MERMAID_PREVIEW_CLASS}`) !== null
  );
};

export const createKnowledgeBaseCodeBlock = (
  options: CodeBlockOptions = {
    defaultLanguage: 'text',
    supportedLanguages: codeBlockLanguages,
  },
) => {
  const baseSpec = createCodeBlockSpec(options);
  const baseRender = baseSpec.implementation.render;

  return {
    ...baseSpec,
    implementation: {
      ...baseSpec.implementation,
      render(this: any, block: any, editor: any) {
        const rendered = baseRender.call(this, block, editor);

        const preview = document.createElement('div');
        preview.className = MERMAID_PREVIEW_CLASS;
        preview.contentEditable = 'false';
        preview.hidden = true;
        preview.dataset.state = 'idle';
        preview.setAttribute('aria-label', 'Mermaid preview');
        preview.addEventListener('click', () => {
          if (preview.dataset.state !== 'rendered') return;
          preview.dataset.edit = preview.dataset.edit === 'true' ? 'false' : 'true';
        });

        // Keep the preview as a stable NodeView child after the source editor.
        // Default CSS hides the source for rendered Mermaid blocks; edit mode
        // reveals the code above the diagram.
        rendered.dom.appendChild(preview);

        return {
          ...rendered,
          ignoreMutation(mutation: any) {
            if (isInsidePreview(mutation.target)) {
              return true;
            }
            return rendered.ignoreMutation?.(mutation) || false;
          },
        };
      },
    },
  };
};
