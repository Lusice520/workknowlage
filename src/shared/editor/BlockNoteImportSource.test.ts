import fs from 'node:fs';
import path from 'node:path';

const blockNoteReactRootImportPattern = /from\s+['"]@blocknote\/react['"]/;

const blockNoteSourceFiles = [
  '../../features/editor-host/EditorHost.tsx',
  '../../features/shell/QuickNoteCenterPane.tsx',
  './Alert.tsx',
  './RichTable.tsx',
  './editorSchema.tsx',
  './KnowledgeBaseEditorView.tsx',
  './KnowledgeBaseFormattingToolbar.tsx',
  './SelectionFormattingToolbarController.tsx',
  './SharedBlockNoteSurface.tsx',
];

test('knowledge base editor source does not import from the BlockNote React package root', () => {
  const offenders = blockNoteSourceFiles
    .map((relativePath) => {
      const absolutePath = path.resolve(__dirname, relativePath);
      const source = fs.readFileSync(absolutePath, 'utf8');

      return blockNoteReactRootImportPattern.test(source)
        ? path.relative(path.resolve(__dirname, '../..'), absolutePath)
        : null;
    })
    .filter((value): value is string => value !== null);

  expect(offenders).toEqual([]);
});
