import fs from 'node:fs';
import path from 'node:path';

test('pins the BlockNote upgrade and makes the Node 20 floor explicit', () => {
  const packageJsonPath = path.resolve(__dirname, '../../..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  expect(packageJson.engines?.node).toBe('>=20');
  expect(packageJson.devDependencies?.['@blocknote/core']).toBe('0.48.0');
  expect(packageJson.devDependencies?.['@blocknote/react']).toBe('0.48.0');
  expect(packageJson.devDependencies?.['@blocknote/mantine']).toBe('0.48.0');
});

test('routes BlockNote private-core usage through the local adapter seam', () => {
  const richTableDeletePath = path.resolve(__dirname, 'richTableBoundaryDelete.ts');
  const source = fs.readFileSync(richTableDeletePath, 'utf8');

  expect(source).toContain("from './blocknoteCoreInternals'");
  expect(source).not.toContain('node_modules/@blocknote/core/src');
});

test('keeps the custom Mantine component contract aligned with BlockNote 0.48', () => {
  const componentsPath = path.resolve(__dirname, 'knowledgeBaseEditorComponents.tsx');
  const source = fs.readFileSync(componentsPath, 'utf8');

  expect(source).toContain('Generic: {');
  expect(source).toContain('Badge: {');
  expect(source).toContain('Comments: {');
});

test('keeps Mermaid available as a BlockNote code block language', () => {
  const schemaPath = path.resolve(__dirname, 'editorSchema.tsx');
  const schemaSource = fs.readFileSync(schemaPath, 'utf8');
  const codeBlockPath = path.resolve(__dirname, 'KnowledgeBaseCodeBlock.ts');
  const codeBlockSource = fs.readFileSync(codeBlockPath, 'utf8');

  expect(schemaSource).toContain('createKnowledgeBaseCodeBlock');
  expect(codeBlockSource).toContain("mermaid: { name: 'Mermaid'");
  expect(codeBlockSource).toContain("aliases: ['mmd']");
});
