/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import { createRequire } from 'node:module';
import viteConfig from '../../vite.config';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

const manualChunkMeta = {
  getModuleIds: () => [],
  getModuleInfo: () => null,
} as any;

const getManualChunks = () => {
  const output = viteConfig.build?.rollupOptions?.output;
  const manualChunks =
    output &&
    !Array.isArray(output) &&
    typeof output.manualChunks === 'function'
      ? output.manualChunks
      : undefined;

  expect(typeof manualChunks).toBe('function');
  if (typeof manualChunks !== 'function') {
    throw new Error('Expected manualChunks to be a function');
  }

  return manualChunks;
};

test('uses a relative asset base for packaged file:// builds', () => {
  expect(viteConfig.base).toBe('./');
});

test('emits module workers for spreadsheet worker chunks', () => {
  expect(viteConfig.worker?.format).toBe('es');
});

test('aliases BlockNote and collaboration package roots away from comment-enabled defaults', () => {
  const aliases = Array.isArray(viteConfig.resolve?.alias) ? viteConfig.resolve.alias : [];

  expect(aliases).toEqual(expect.arrayContaining([
    expect.objectContaining({ find: '@blocknote/react' }),
    expect.objectContaining({ find: '@blocknote/react/style.css' }),
    expect.objectContaining({ find: 'yjs' }),
    expect.objectContaining({ find: 'y-prosemirror' }),
    expect.objectContaining({ find: 'y-protocols/awareness' }),
  ]));
});

test('does not create a dedicated collaboration vendor chunk', () => {
  const manualChunks = getManualChunks();

  expect(manualChunks('/virtual/node_modules/yjs/index.js', manualChunkMeta)).toBeUndefined();
  expect(manualChunks('/virtual/node_modules/y-prosemirror/index.js', manualChunkMeta)).toBeUndefined();
  expect(manualChunks('/virtual/node_modules/y-protocols/awareness.js', manualChunkMeta)).toBeUndefined();
});

test('splits spreadsheet editor dependencies into dedicated vendor chunks', () => {
  const manualChunks = getManualChunks();

  expect(manualChunks('/virtual/node_modules/@univerjs/preset-sheets-core/index.js', manualChunkMeta)).toBe('spreadsheet-univer-presets');
  expect(manualChunks('/virtual/node_modules/@univerjs/engine-formula/index.js', manualChunkMeta)).toBe('spreadsheet-univer-sheets');
  expect(manualChunks('/virtual/node_modules/@univerjs/ui/index.js', manualChunkMeta)).toBe('spreadsheet-univer-ui');
  expect(manualChunks('/virtual/node_modules/@univerjs/sheets-ui/index.js', manualChunkMeta)).toBe('spreadsheet-univer-sheets');
  expect(manualChunks('/virtual/node_modules/@univerjs/core/index.js', manualChunkMeta)).toBe('spreadsheet-univer-core');
  expect(manualChunks('/virtual/node_modules/rxjs/dist/esm/index.js', manualChunkMeta)).toBe('spreadsheet-univer-core');
  expect(manualChunks('/virtual/node_modules/@univerjs-pro/license/index.js', manualChunkMeta)).toBe('spreadsheet-univer-pro');
});

test('registers Markdown file associations for packaged macOS builds', () => {
  expect(packageJson.build.fileAssociations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ext: expect.arrayContaining(['md', 'markdown']),
        role: 'Editor',
      }),
    ]),
  );
});

test('keeps renderer-only packages out of packaged production dependencies', () => {
  expect(Object.keys(packageJson.dependencies).sort()).toEqual(['better-sqlite3']);

  expect(packageJson.devDependencies).toEqual(expect.objectContaining({
    '@univerjs/preset-sheets-core': expect.any(String),
    '@univerjs/presets': expect.any(String),
    jszip: expect.any(String),
    'lucide-react': expect.any(String),
    mermaid: expect.any(String),
    react: expect.any(String),
    'react-dom': expect.any(String),
  }));
});

test('copies Mermaid runtime assets for Electron share pages in packaged builds', () => {
  expect(packageJson.build.extraResources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      from: 'node_modules/mermaid/dist',
      to: 'vendor/mermaid',
      filter: [
        'mermaid.esm.min.mjs',
        'chunks/mermaid.esm.min/**/*',
      ],
    }),
  ]));
});

test('excludes native build source files that are not needed at runtime', () => {
  expect(packageJson.build.files).toEqual(expect.arrayContaining([
    '!node_modules/better-sqlite3/deps/**/*',
    '!node_modules/better-sqlite3/src/**/*',
  ]));
});

test('keeps only WorkKnowlage-supported Electron locale packs', () => {
  expect(packageJson.build.electronLanguages).toEqual(['en', 'zh_CN', 'zh_TW']);
});
