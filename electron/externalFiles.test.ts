/// <reference types="node" />
// @vitest-environment node

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  findExternalMarkdownFilePaths,
  importExternalMarkdownFile,
  isExternalMarkdownFilePath,
  readExternalMarkdownFile,
  saveExternalMarkdownFile,
} = require('./externalFiles.cjs');

let tempDir: string | null = null;

const createTempDir = async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-external-file-'));
  return tempDir;
};

afterEach(async () => {
  vi.restoreAllMocks();

  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

test('recognizes Markdown paths and ignores unsupported argv values', () => {
  expect(isExternalMarkdownFilePath('/Users/lusice/Notes/Idea.md')).toBe(true);
  expect(isExternalMarkdownFilePath('/Users/lusice/Notes/Idea.markdown')).toBe(true);
  expect(isExternalMarkdownFilePath('/Users/lusice/Notes/Idea.MD')).toBe(true);
  expect(isExternalMarkdownFilePath('/Users/lusice/Notes/Idea.txt')).toBe(false);
  expect(isExternalMarkdownFilePath('workknowlage://document/123')).toBe(false);

  expect(findExternalMarkdownFilePaths([
    '/Applications/WorkKnowlage.app/Contents/MacOS/WorkKnowlage',
    '--some-electron-flag',
    '/Users/lusice/a.md',
    '/Users/lusice/b.txt',
    '/Users/lusice/c.markdown',
  ])).toEqual(['/Users/lusice/a.md', '/Users/lusice/c.markdown']);
});

test('reads external Markdown content and file metadata', async () => {
  const dir = await createTempDir();
  const filePath = path.join(dir, '外部文档.md');
  await fs.writeFile(filePath, '# 标题\n\n正文', 'utf8');

  const record = await readExternalMarkdownFile(filePath);

  expect(record).toMatchObject({
    filePath,
    title: '外部文档',
    markdown: '# 标题\n\n正文',
  });
  expect(record.updatedAt).toEqual(expect.any(String));
  expect(record.updatedAtLabel).toContain('修改');
});

test('rejects unsupported external file extensions before reading or writing', async () => {
  const dir = await createTempDir();
  const filePath = path.join(dir, 'notes.txt');
  await fs.writeFile(filePath, 'plain text', 'utf8');

  await expect(readExternalMarkdownFile(filePath)).rejects.toThrow('仅支持 Markdown 文件');
  await expect(saveExternalMarkdownFile(filePath, '# nope')).rejects.toThrow('仅支持 Markdown 文件');
});

test('saves Markdown back to the original external file path', async () => {
  const dir = await createTempDir();
  const filePath = path.join(dir, 'draft.md');
  await fs.writeFile(filePath, '# Before', 'utf8');

  const result = await saveExternalMarkdownFile(filePath, '# After\n\nUpdated');

  await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('# After\n\nUpdated');
  expect(result).toMatchObject({
    filePath,
    title: 'draft',
  });
  expect(result.updatedAt).toEqual(expect.any(String));
});

test('saves external Markdown through a temporary file before replacing the original', async () => {
  const filePath = '/Users/lusice/Notes/draft.md';
  const calls: Array<[string, string]> = [];
  const fsApi = {
    writeFile: vi.fn(async (targetPath: string, content: string) => {
      calls.push(['writeFile', targetPath]);
      expect(targetPath).not.toBe(filePath);
      expect(targetPath).toContain('.workknowlage-save-');
      expect(content).toBe('# After');
    }),
    rename: vi.fn(async (fromPath: string, toPath: string) => {
      calls.push(['rename', `${fromPath} -> ${toPath}`]);
      expect(fromPath).not.toBe(filePath);
      expect(toPath).toBe(filePath);
    }),
    rm: vi.fn(),
    stat: vi.fn(async () => ({ mtime: new Date('2026-05-20T06:01:00.000Z') })),
  };

  await saveExternalMarkdownFile(filePath, '# After', { fsApi });

  expect(fsApi.stat).toHaveBeenCalledWith(filePath);
  expect(fsApi.rm).not.toHaveBeenCalled();
  expect(calls.map(([name]) => name)).toEqual(['writeFile', 'rename']);
});

test('imports an external Markdown editor snapshot into the first knowledge space', async () => {
  const createdDocument = {
    id: 'doc-imported',
    spaceId: 'space-default',
    folderId: null,
    title: 'Roadmap',
    contentJson: '[{"type":"paragraph","content":[{"type":"text","text":"Hello","styles":{}}]}]',
  };
  const documentsRepo = {
    createDocument: vi.fn(() => ({ ...createdDocument, contentJson: '[]' })),
    updateDocument: vi.fn(() => createdDocument),
  };
  const syncSearchAndBacklinksForSpace = vi.fn();

  const result = importExternalMarkdownFile({
    title: 'Roadmap.md',
    contentJson: createdDocument.contentJson,
  }, {
    spacesRepo: {
      listSpaces: () => [{ id: 'space-default', name: '默认空间', label: 'WORKSPACE' }],
    },
    documentsRepo,
    syncSearchAndBacklinksForSpace,
  });

  expect(documentsRepo.createDocument).toHaveBeenCalledWith({
    spaceId: 'space-default',
    folderId: null,
    title: 'Roadmap',
    kind: 'note',
  });
  expect(documentsRepo.updateDocument).toHaveBeenCalledWith('doc-imported', {
    contentJson: createdDocument.contentJson,
  });
  expect(syncSearchAndBacklinksForSpace).toHaveBeenCalledWith('space-default', {
    upsertDocument: createdDocument,
  });
  expect(result).toEqual({
    success: true,
    message: '已导入知识库',
    document: createdDocument,
  });
});

test('fails import clearly when no knowledge space exists', () => {
  expect(() => importExternalMarkdownFile({
    title: 'orphan.md',
    contentJson: '[]',
  }, {
    spacesRepo: {
      listSpaces: () => [],
    },
    documentsRepo: {
      createDocument: vi.fn(),
      updateDocument: vi.fn(),
    },
    syncSearchAndBacklinksForSpace: vi.fn(),
  })).toThrow('没有可导入的知识库空间');
});
