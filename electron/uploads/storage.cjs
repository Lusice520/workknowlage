const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MIME_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['application/pdf', '.pdf'],
  ['text/plain', '.txt'],
  ['text/markdown', '.md'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp4', '.m4a'],
]);

const EXTENSIONS_TO_MIME = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
]);

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizePathSegment(segment, fallback = 'item') {
  const value = String(segment || '').trim();
  if (!value) return fallback;

  return value
    .replace(/[\\/]+/g, '_')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._()-]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
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

  throw new TypeError('Upload asset bytes must be a Buffer, Uint8Array, ArrayBuffer, or number[]');
}

function guessExtension(asset) {
  const name = sanitizePathSegment(asset?.name || '', '');
  const nameExt = path.extname(name);
  if (nameExt) {
    return nameExt.toLowerCase();
  }

  const mimeType = String(asset?.mimeType || '').trim().toLowerCase();
  return MIME_EXTENSIONS.get(mimeType) || '.bin';
}

function guessMimeType(fileName, explicitMimeType) {
  const candidate = String(explicitMimeType || '').trim().toLowerCase();
  if (candidate) {
    return candidate;
  }

  const ext = path.extname(fileName).toLowerCase();
  return EXTENSIONS_TO_MIME.get(ext) || 'application/octet-stream';
}

function buildStoredFileName(asset) {
  const baseName = sanitizePathSegment(path.basename(String(asset?.name || ''), path.extname(String(asset?.name || ''))), 'asset');
  const extension = guessExtension(asset);
  return `${Date.now()}-${crypto.randomUUID()}-${baseName}${extension}`;
}

function createUploadStorage({ userDataDir }) {
  const uploadsRootDir = path.join(userDataDir, 'uploads');
  ensureDirectory(uploadsRootDir);

  const getDocumentUploadDir = (documentId) =>
    path.join(uploadsRootDir, sanitizePathSegment(documentId, 'document'));

  const storeAssets = (documentId, assets) => {
    if (!documentId) {
      throw new Error('documentId is required when uploading assets');
    }

    const uploadList = Array.isArray(assets) ? assets : [];
    if (uploadList.length === 0) {
      return [];
    }

    const documentUploadDir = getDocumentUploadDir(documentId);
    ensureDirectory(documentUploadDir);

    return uploadList.map((asset) => {
      const fileName = buildStoredFileName(asset);
      const filePath = path.join(documentUploadDir, fileName);
      const bytes = normalizeBuffer(asset?.bytes);
      fs.writeFileSync(filePath, bytes);

      return {
        documentId: String(documentId),
        name: String(asset?.name || fileName),
        mimeType: guessMimeType(fileName, asset?.mimeType),
        size: bytes.byteLength,
        fileName,
        filePath,
        urlPath: `/uploads/${encodeURIComponent(String(documentId))}/${encodeURIComponent(fileName)}`,
      };
    });
  };

  const resolveUploadPath = (segments) => {
    const [documentId, fileName] = Array.isArray(segments) ? segments : [];
    if (!documentId || !fileName) {
      return null;
    }

    const documentUploadDir = getDocumentUploadDir(documentId);
    const resolvedPath = path.resolve(documentUploadDir, sanitizePathSegment(fileName, 'asset.bin'));
    if (!resolvedPath.startsWith(path.resolve(uploadsRootDir))) {
      return null;
    }

    return resolvedPath;
  };

  const removeDocumentUploadDir = (documentId) => {
    if (!documentId) {
      return;
    }

    fs.rmSync(getDocumentUploadDir(documentId), { recursive: true, force: true });
  };

  return {
    uploadsRootDir,
    getDocumentUploadDir,
    storeAssets,
    resolveUploadPath,
    removeDocumentUploadDir,
  };
}

module.exports = {
  createUploadStorage,
  guessMimeType,
};
