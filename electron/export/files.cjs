const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEXT_ENCODING = 'utf8';

function ensureDirectoryForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) {
    return Buffer.from(bytes);
  }

  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes);
  }

  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }

  if (Array.isArray(bytes)) {
    return Buffer.from(bytes);
  }

  throw new TypeError('Export bytes must be a Buffer, Uint8Array, ArrayBuffer, or number[]');
}

function sanitizeExportFileName(rawTitle = '文档') {
  return String(rawTitle || '文档')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || '文档';
}

async function resolveSavePath({
  dialog,
  browserWindow,
  defaultPath,
  title,
  filters,
}) {
  if (defaultPath) {
    return { canceled: false, filePath: defaultPath };
  }

  if (!dialog || typeof dialog.showSaveDialog !== 'function') {
    throw new Error('Save dialog is unavailable');
  }

  const result = await dialog.showSaveDialog(browserWindow ?? undefined, {
    title,
    defaultPath,
    filters,
  });

  return {
    canceled: Boolean(result?.canceled),
    filePath: result?.filePath || '',
  };
}

function writeTextFile({ outputPath, content, encoding = DEFAULT_TEXT_ENCODING }) {
  if (!outputPath) {
    throw new Error('outputPath is required');
  }

  const text = String(content ?? '');
  ensureDirectoryForFile(outputPath);
  fs.writeFileSync(outputPath, text, encoding);
  return {
    path: outputPath,
    bytesWritten: Buffer.byteLength(text, encoding),
  };
}

function writeBinaryFile({ outputPath, bytes }) {
  if (!outputPath) {
    throw new Error('outputPath is required');
  }

  const buffer = normalizeBuffer(bytes);
  ensureDirectoryForFile(outputPath);
  fs.writeFileSync(outputPath, buffer);
  return {
    path: outputPath,
    bytesWritten: buffer.byteLength,
  };
}

async function saveTextFile(options = {}) {
  const {
    outputPath,
    defaultPath,
    title = '导出 Markdown',
    content = '',
    dialog,
    browserWindow,
    filters = [{ name: 'Text', extensions: ['md', 'txt', 'text'] }],
    encoding = DEFAULT_TEXT_ENCODING,
  } = options;

  const resolvedPath = outputPath || (await resolveSavePath({
    dialog,
    browserWindow,
    defaultPath,
    title,
    filters,
  })).filePath;

  if (!resolvedPath) {
    return { canceled: true, path: '' };
  }

  return writeTextFile({ outputPath: resolvedPath, content, encoding });
}

async function saveBinaryFile(options = {}) {
  const {
    outputPath,
    defaultPath,
    title = '导出文件',
    bytes,
    dialog,
    browserWindow,
    filters = [{ name: 'Binary', extensions: ['bin'] }],
  } = options;

  const resolvedPath = outputPath || (await resolveSavePath({
    dialog,
    browserWindow,
    defaultPath,
    title,
    filters,
  })).filePath;

  if (!resolvedPath) {
    return { canceled: true, path: '' };
  }

  return writeBinaryFile({ outputPath: resolvedPath, bytes });
}

module.exports = {
  sanitizeExportFileName,
  resolveSavePath,
  saveTextFile,
  saveBinaryFile,
  writeTextFile,
  writeBinaryFile,
};
