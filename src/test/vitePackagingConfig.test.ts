/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import viteConfig from '../../vite.config';

const manualChunkMeta = {
  getModuleIds: () => [],
  getModuleInfo: () => null,
} as any;

test('uses a relative asset base for packaged file:// builds', () => {
  expect(viteConfig.base).toBe('./');
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

  expect(manualChunks('/virtual/node_modules/yjs/index.js', manualChunkMeta)).toBeUndefined();
  expect(manualChunks('/virtual/node_modules/y-prosemirror/index.js', manualChunkMeta)).toBeUndefined();
  expect(manualChunks('/virtual/node_modules/y-protocols/awareness.js', manualChunkMeta)).toBeUndefined();
});
