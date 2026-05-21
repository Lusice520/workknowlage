import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const matchesEditorDependency = (id: string, patterns: readonly string[]) =>
  patterns.some((pattern) => id.includes(pattern));

const spreadsheetVendorChunks = [
  {
    name: 'spreadsheet-univer-pro',
    patterns: ['/node_modules/@univerjs-pro/'],
  },
  {
    name: 'spreadsheet-univer-presets',
    patterns: [
      '/node_modules/@univerjs/preset-',
      '/node_modules/@univerjs/presets/',
    ],
  },
  {
    name: 'spreadsheet-univer-ui',
    patterns: [
      '/node_modules/@univerjs/design/',
      '/node_modules/@univerjs/docs',
      '/node_modules/@univerjs/drawing',
      '/node_modules/@univerjs/engine-render/',
      '/node_modules/@univerjs/icons/',
      '/node_modules/@univerjs/ui/',
    ],
  },
  {
    name: 'spreadsheet-univer-sheets',
    patterns: [
      '/node_modules/@univerjs/engine-formula/',
      '/node_modules/@univerjs/sheets',
    ],
  },
  {
    name: 'spreadsheet-univer-core',
    patterns: [
      '/node_modules/@univerjs/core/',
      '/node_modules/@univerjs/network/',
      '/node_modules/@univerjs/protocol/',
      '/node_modules/@univerjs/rpc',
      '/node_modules/@univerjs/telemetry/',
      '/node_modules/@univerjs/themes/',
      '/node_modules/@wendellhu/redi/',
      '/node_modules/rxjs/',
    ],
  },
] as const;

const noCollabAliases = [
  {
    find: '@blocknote/react/style.css',
    replacement: fileURLToPath(new URL('./node_modules/@blocknote/react/dist/style.css', import.meta.url)),
  },
  {
    find: '@blocknote/react',
    replacement: fileURLToPath(new URL('./src/shared/editor/blocknoteReactNoComments.ts', import.meta.url)),
  },
  {
    find: 'yjs',
    replacement: fileURLToPath(new URL('./src/shared/editor/noCollab/yjs.ts', import.meta.url)),
  },
  {
    find: 'y-prosemirror',
    replacement: fileURLToPath(new URL('./src/shared/editor/noCollab/yProsemirror.ts', import.meta.url)),
  },
  {
    find: 'y-protocols/awareness',
    replacement: fileURLToPath(new URL('./src/shared/editor/noCollab/yProtocolsAwareness.ts', import.meta.url)),
  },
] as const;

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [...noCollabAliases],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          for (const chunk of spreadsheetVendorChunks) {
            if (matchesEditorDependency(id, chunk.patterns)) {
              return chunk.name;
            }
          }

          if (matchesEditorDependency(id, [
            '/node_modules/react/',
            '/node_modules/react-dom/',
            '/node_modules/scheduler/',
            '/node_modules/use-sync-external-store/',
          ])) {
            return 'editor-react';
          }

          if (matchesEditorDependency(id, [
            '/@blocknote/mantine/',
            '/@mantine/',
            '/@emotion/',
          ])) {
            return 'editor-mantine';
          }

          if (matchesEditorDependency(id, [
            '/@blocknote/react/',
            '/@tanstack/react-store/',
            '/lodash.merge/',
            '/react-icons/',
          ])) {
            return 'editor-blocknote-react';
          }

          if (matchesEditorDependency(id, [
            '/@emoji-mart/',
            '/emoji-mart/',
          ])) {
            return 'editor-blocknote-emoji';
          }

          if (matchesEditorDependency(id, [
            '/@blocknote/core/',
            '/@handlewithcare/prosemirror-inputrules/',
            '/@tanstack/store/',
            '/fast-deep-equal/',
            '/hast-util-from-dom/',
            '/prosemirror-highlight/',
            '/rehype-',
            '/remark-',
            '/unified/',
            '/unist-util-visit/',
            '/uuid/',
          ])) {
            return 'editor-blocknote-core';
          }

          if (matchesEditorDependency(id, [
            '/@floating-ui/',
            '/@tiptap/',
            '/prosemirror-',
            '/linkifyjs',
          ])) {
            return 'editor-tiptap';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
