import { describe, expect, test } from 'vitest';
import {
  renderMermaidPreviewsInEditorRoot,
} from './useSharedBlockNoteMermaidPreview';
import { MERMAID_PREVIEW_CLASS } from './KnowledgeBaseCodeBlock';

const createCodeBlock = ({ code, language }: { code: string; language: string }) => {
  const block = document.createElement('div');
  block.className = 'bn-block-content';
  block.setAttribute('data-content-type', 'codeBlock');
  block.setAttribute('data-language', language);

  const selectWrapper = document.createElement('div');
  const select = document.createElement('select');
  ['text', 'mermaid', 'typescript'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = language;
  selectWrapper.appendChild(select);
  block.appendChild(selectWrapper);

  const pre = document.createElement('pre');
  const codeElement = document.createElement('code');
  codeElement.textContent = code;
  pre.appendChild(codeElement);
  const preview = document.createElement('div');
  preview.className = MERMAID_PREVIEW_CLASS;
  preview.contentEditable = 'false';
  preview.hidden = true;
  preview.dataset.state = 'idle';
  block.append(pre, preview);
  return { block, codeElement, preview, select };
};

const USER_DIAGRAM = `flowchart LR
DocA["编辑文档 A"] --> AddRelation["添加标签 / 收藏 / 提及文档 B"]
AddRelation --> SaveRelation["保存关系数据"]
SaveRelation --> Outbound["文档 A 形成出链"]
SaveRelation --> Backlink["文档 B 形成反向链接"]
Outbound --> Sidebar["右侧栏展示相关文档"]
Backlink --> Sidebar
Sidebar --> OpenRelated["点击打开关联文档"]`;

test('renders user-provided flowchart', async () => {
  const root = document.createElement('div');
  const { block, preview } = createCodeBlock({
    language: 'mermaid',
    code: USER_DIAGRAM,
  });
  root.appendChild(block);

  let lastSvg = '';
  const renderer = {
    render: async (id: string, source: string) => {
      const mermaid = (await import('mermaid')).default;
      const result = await mermaid.render(id, source);
      lastSvg = result.svg;
      return result;
    },
  };

  const stats = await renderMermaidPreviewsInEditorRoot(root, renderer);
  expect(stats.rendered).toBe(1);
  expect(preview.hidden).toBe(false);
  expect(preview.dataset.state).toBe('rendered');
  expect(preview.querySelector('svg')).not.toBeNull();
  expect(lastSvg.length).toBeGreaterThan(200);
}, 10000);
