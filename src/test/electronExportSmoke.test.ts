/// <reference types="node" />
// @vitest-environment node

import { afterEach, expect, test, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeTextFile, writeBinaryFile } = require('../../electron/export/files.cjs');
const { savePdfFromHtml } = require('../../electron/export/pdf.cjs');
const { registerExportIpcHandlers } = require('../../electron/main.cjs');

let tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-export-'));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })));
  tempDirs = [];
});

test('writes exported text and binary artifacts to disk', async () => {
  const tempDir = await createTempDir();
  const textPath = path.join(tempDir, 'export.txt');
  const binaryPath = path.join(tempDir, 'export.bin');

  const textResult = writeTextFile({
    outputPath: textPath,
    content: 'WorkKnowlage export text',
  });
  const binaryResult = writeBinaryFile({
    outputPath: binaryPath,
    bytes: Uint8Array.from([1, 2, 3, 4]),
  });

  expect(textResult).toEqual({
    path: textPath,
    bytesWritten: 24,
  });
  expect(binaryResult).toEqual({
    path: binaryPath,
    bytesWritten: 4,
  });
  expect(await fs.readFile(textPath, 'utf8')).toBe('WorkKnowlage export text');
  expect((await fs.readFile(binaryPath)).length).toBe(4);
});

test('writes a pdf artifact through an injected export window', async () => {
  const tempDir = await createTempDir();
  const pdfPath = path.join(tempDir, 'export.pdf');
  const printToPDF = vi.fn().mockResolvedValue(Buffer.from('pdf-bytes'));
  const fakeWindow = {
    webContents: {
      printToPDF,
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
    },
    loadURL: vi.fn().mockResolvedValue(undefined),
    setMenuBarVisibility: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };

  const pdfResult = await savePdfFromHtml({
    outputPath: pdfPath,
    html: '<!doctype html><html><body><h1>WorkKnowlage Export</h1></body></html>',
    title: 'WorkKnowlage Export',
    windowFactory: async () => fakeWindow,
  });

  expect(pdfResult).toEqual({
    path: pdfPath,
    bytesWritten: 9,
  });
  expect(printToPDF).toHaveBeenCalledOnce();
  expect(await fs.readFile(pdfPath)).toEqual(Buffer.from('pdf-bytes'));
  expect(fakeWindow.destroy).toHaveBeenCalledOnce();
});

test('registers export ipc handlers for text, binary, and pdf', async () => {
  const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const fakeIpc = {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = handler;
    },
  };
  const tempDir = await createTempDir();
  const textPath = path.join(tempDir, 'ipc-export.txt');
  const binaryPath = path.join(tempDir, 'ipc-export.bin');
  const pdfPath = path.join(tempDir, 'ipc-export.pdf');
  const fakeWindow = {
    webContents: {
      printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf-ipc')),
      executeJavaScript: vi.fn().mockResolvedValue(undefined),
    },
    loadURL: vi.fn().mockResolvedValue(undefined),
    setMenuBarVisibility: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };

  registerExportIpcHandlers({
    ipc: fakeIpc,
    dialogApi: {
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: path.join(tempDir, 'unused.txt') }),
    },
  });

  expect(Object.keys(handlers)).toEqual([
    'exports:saveText',
    'exports:saveBinary',
    'exports:savePdfFromHtml',
  ]);

  await expect(handlers['exports:saveText']({
    sender: null,
  }, {
    outputPath: textPath,
    content: 'ipc text',
  })).resolves.toEqual({
    success: true,
    message: 'Markdown 已导出',
    path: textPath,
  });

  await expect(handlers['exports:saveBinary']({
    sender: null,
  }, {
    outputPath: binaryPath,
    bytes: Uint8Array.from([9, 8, 7]),
  })).resolves.toEqual({
    success: true,
    message: '文件已导出',
    path: binaryPath,
  });

  await expect(handlers['exports:savePdfFromHtml']({
    sender: null,
  }, {
    outputPath: pdfPath,
    html: '<!doctype html><html><body><p>ipc pdf</p></body></html>',
    windowFactory: async () => fakeWindow,
  })).resolves.toEqual({
    success: true,
    message: 'PDF 已导出',
    path: pdfPath,
  });

  expect(await fs.readFile(textPath, 'utf8')).toBe('ipc text');
  expect((await fs.readFile(binaryPath)).length).toBe(3);
  expect(await fs.readFile(pdfPath)).toEqual(Buffer.from('pdf-ipc'));
});
