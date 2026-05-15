import fs from 'node:fs';
import path from 'node:path';

test('KnowledgeBaseEditorView keeps the 0.48 portal and theme contract wiring', () => {
  const viewPath = path.resolve(__dirname, 'KnowledgeBaseEditorView.tsx');
  const source = fs.readFileSync(viewPath, 'utf8');

  expect(source).toContain('BlockNoteContext.Provider');
  expect(source).toContain('ElementRenderer');
  expect(source).toContain('<Portals contentComponent={portalManager} />');
  expect(source).toContain("const finalTheme = 'light'");
  expect(source).toContain("mergeCSSClasses('bn-root', 'bn-container', 'bn-mantine', finalTheme, className || '')");
  expect(source).toContain("editor.portalElement.setAttribute('data-mantine-color-scheme', finalTheme)");
  expect(source).toContain("editor.portalElement.setAttribute('data-color-scheme', finalTheme)");
});
