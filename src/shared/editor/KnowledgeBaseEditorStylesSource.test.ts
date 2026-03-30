import fs from 'node:fs';
import path from 'node:path';

test('app entry uses the local knowledge base editor stylesheet instead of the broad BlockNote Mantine stylesheet', () => {
  const mainPath = path.resolve(__dirname, '../../main.tsx');
  const source = fs.readFileSync(mainPath, 'utf8');

  expect(source).toContain(`import './shared/editor/knowledgeBaseEditorStyles.css';`);
  expect(source).not.toContain(`import '@blocknote/mantine/style.css';`);
});

test('local knowledge base editor stylesheet does not import the broad BlockNote Mantine stylesheet', () => {
  const stylesheetPath = path.resolve(__dirname, 'knowledgeBaseEditorStyles.css');
  const source = fs.readFileSync(stylesheetPath, 'utf8');

  expect(source).not.toContain(`@blocknote/mantine/style.css`);
});

test('local knowledge base editor stylesheet overrides BlockNote text blue and green tokens', () => {
  const stylesheetPath = path.resolve(__dirname, 'knowledgeBaseEditorStyles.css');
  const source = fs.readFileSync(stylesheetPath, 'utf8');

  expect(source).toContain(`[data-style-type="textColor"][data-value="green"]`);
  expect(source).toContain(`color: #2f7a5f;`);
  expect(source).toContain(`[data-style-type="textColor"][data-value="blue"]`);
  expect(source).toContain(`color: #2f6fdd;`);
});
