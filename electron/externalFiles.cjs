const fs = require('node:fs/promises');
const path = require('node:path');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

function isExternalMarkdownFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return false;
  }

  const normalized = filePath.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    return false;
  }

  return MARKDOWN_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function findExternalMarkdownFilePaths(argv = []) {
  return argv
    .filter((item) => typeof item === 'string' && !item.startsWith('-'))
    .filter((item) => isExternalMarkdownFilePath(item));
}

function assertMarkdownFilePath(filePath) {
  if (!isExternalMarkdownFilePath(filePath)) {
    throw new Error('仅支持 Markdown 文件（.md / .markdown）。');
  }
}

function getExternalFileTitle(filePath) {
  const basename = path.basename(String(filePath || '').trim());
  const extension = path.extname(basename);
  const title = extension ? basename.slice(0, -extension.length) : basename;
  return title.trim() || '未命名文档';
}

function formatExternalFileUpdatedAtLabel(updatedAt) {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return '修改时间未知';
  }

  return `修改 ${date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function toExternalMarkdownFileRecord(filePath, markdown, stat) {
  const updatedAtDate = stat?.mtime instanceof Date ? stat.mtime : new Date();
  const updatedAt = updatedAtDate.toISOString();

  return {
    filePath,
    title: getExternalFileTitle(filePath),
    markdown: typeof markdown === 'string' ? markdown : '',
    updatedAt,
    updatedAtLabel: formatExternalFileUpdatedAtLabel(updatedAtDate),
  };
}

function getExternalMarkdownTempPath(filePath) {
  const directory = path.dirname(filePath);
  const basename = path.basename(filePath);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return path.join(directory, `.${basename}.workknowlage-save-${suffix}.tmp`);
}

async function readExternalMarkdownFile(filePath, options = {}) {
  assertMarkdownFilePath(filePath);
  const fsApi = options.fsApi || fs;
  const [markdown, stat] = await Promise.all([
    fsApi.readFile(filePath, 'utf8'),
    fsApi.stat(filePath),
  ]);

  return toExternalMarkdownFileRecord(filePath, markdown, stat);
}

async function saveExternalMarkdownFile(filePath, markdown, options = {}) {
  assertMarkdownFilePath(filePath);
  const fsApi = options.fsApi || fs;
  const tempPath = getExternalMarkdownTempPath(filePath);
  try {
    await fsApi.writeFile(tempPath, String(markdown ?? ''), 'utf8');
    await fsApi.rename(tempPath, filePath);
  } catch (error) {
    await fsApi.rm?.(tempPath, { force: true });
    throw error;
  }

  const stat = await fsApi.stat(filePath);
  return toExternalMarkdownFileRecord(filePath, String(markdown ?? ''), stat);
}

function sanitizeImportedTitle(title) {
  return getExternalFileTitle(String(title || '外部文档').replace(/[\\/:*?"<>|]+/g, '-'));
}

function importExternalMarkdownFile(input, dependencies) {
  const spaces = dependencies.spacesRepo.listSpaces();
  const defaultSpace = Array.isArray(spaces) ? spaces[0] : null;
  if (!defaultSpace?.id) {
    throw new Error('没有可导入的知识库空间。');
  }

  const createdDocument = dependencies.documentsRepo.createDocument({
    spaceId: defaultSpace.id,
    folderId: null,
    title: sanitizeImportedTitle(input?.title),
    kind: 'note',
  });
  const updatedDocument = dependencies.documentsRepo.updateDocument(createdDocument.id, {
    contentJson: input?.contentJson ?? '[]',
  });

  dependencies.syncSearchAndBacklinksForSpace(updatedDocument?.spaceId ?? defaultSpace.id, {
    upsertDocument: updatedDocument,
  });

  return {
    success: true,
    message: '已导入知识库',
    document: updatedDocument,
  };
}

module.exports = {
  MARKDOWN_EXTENSIONS,
  findExternalMarkdownFilePaths,
  formatExternalFileUpdatedAtLabel,
  getExternalFileTitle,
  getExternalMarkdownTempPath,
  importExternalMarkdownFile,
  isExternalMarkdownFilePath,
  readExternalMarkdownFile,
  saveExternalMarkdownFile,
  toExternalMarkdownFileRecord,
};
