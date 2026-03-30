import fs from 'node:fs';
import path from 'node:path';

test('knowledge base formatting toolbar includes inline code action', () => {
  const toolbarPath = path.resolve(__dirname, 'KnowledgeBaseFormattingToolbar.tsx');
  const source = fs.readFileSync(toolbarPath, 'utf8');

  expect(source).toContain('basicTextStyle="code"');
});

test('knowledge base formatting toolbar does not rely on the default comment-aware toolbar helper', () => {
  const toolbarPath = path.resolve(__dirname, 'KnowledgeBaseFormattingToolbar.tsx');
  const source = fs.readFileSync(toolbarPath, 'utf8');

  expect(source).not.toContain('getFormattingToolbarItems');
});
