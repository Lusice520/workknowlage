const fs = require('node:fs');
const path = require('node:path');
const { getDatabase } = require('../db/index.cjs');

const BACKUP_MANIFEST_NAME = 'manifest.json';
const BACKUP_FORMAT_VERSION = 1;

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removePathIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function listDirectoryFileCount(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.reduce((count, entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return count + listDirectoryFileCount(entryPath);
    }

    return count + 1;
  }, 0);
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
}

function collectDatabaseFilePaths(dbPath) {
  const candidates = [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`,
  ];

  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function writeBackupManifest(backupDir, manifest) {
  fs.writeFileSync(
    path.join(backupDir, BACKUP_MANIFEST_NAME),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

function readBackupManifest(backupDir) {
  const manifestPath = path.join(backupDir, BACKUP_MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error('备份结构不完整：缺少 manifest.json');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('备份结构不完整：manifest 版本无效');
  }

  return manifest;
}

function createBackupSnapshot({
  appVersion,
  userDataDir,
  dbPath,
  destinationRootDir,
}) {
  ensureDirectory(destinationRootDir);

  const backupDir = path.join(destinationRootDir, `workknowlage-backup-${formatTimestamp()}`);
  const uploadsRootDir = path.join(userDataDir, 'uploads');
  const databaseFiles = collectDatabaseFilePaths(dbPath);

  if (!databaseFiles.some((filePath) => path.basename(filePath) === path.basename(dbPath))) {
    throw new Error('当前数据库文件不存在，无法创建备份');
  }

  ensureDirectory(backupDir);

  databaseFiles.forEach((filePath) => {
    fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
  });

  if (fs.existsSync(uploadsRootDir)) {
    fs.cpSync(uploadsRootDir, path.join(backupDir, 'uploads'), { recursive: true });
  }

  const manifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    sourceStoragePath: dbPath,
    databaseFiles: databaseFiles.map((filePath) => path.basename(filePath)),
    uploadDirectoryIncluded: fs.existsSync(uploadsRootDir),
    uploadFileCount: listDirectoryFileCount(uploadsRootDir),
  };
  writeBackupManifest(backupDir, manifest);

  return {
    success: true,
    message: '备份已创建',
    path: backupDir,
  };
}

function restoreBackupSnapshot({
  backupDir,
  userDataDir,
  dbPath,
}) {
  const manifest = readBackupManifest(backupDir);
  const backupUploadsDir = path.join(backupDir, 'uploads');
  const rollbackDir = path.join(userDataDir, `.restore-rollback-${Date.now()}`);
  const uploadsRootDir = path.join(userDataDir, 'uploads');
  const currentDatabaseFiles = collectDatabaseFilePaths(dbPath);
  const restoredDatabaseFiles = manifest.databaseFiles.map((fileName) => ({
    sourcePath: path.join(backupDir, fileName),
    targetPath: path.join(userDataDir, fileName),
  }));

  restoredDatabaseFiles.forEach(({ sourcePath }) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`备份结构不完整：缺少 ${path.basename(sourcePath)}`);
    }
  });

  ensureDirectory(rollbackDir);

  try {
    currentDatabaseFiles.forEach((filePath) => {
      fs.renameSync(filePath, path.join(rollbackDir, path.basename(filePath)));
    });

    if (fs.existsSync(uploadsRootDir)) {
      fs.renameSync(uploadsRootDir, path.join(rollbackDir, 'uploads'));
    }

    restoredDatabaseFiles.forEach(({ sourcePath, targetPath }) => {
      fs.copyFileSync(sourcePath, targetPath);
    });

    if (manifest.uploadDirectoryIncluded && fs.existsSync(backupUploadsDir)) {
      fs.cpSync(backupUploadsDir, uploadsRootDir, { recursive: true });
    } else {
      removePathIfExists(uploadsRootDir);
      ensureDirectory(uploadsRootDir);
    }
  } catch (error) {
    restoredDatabaseFiles.forEach(({ targetPath }) => removePathIfExists(targetPath));
    removePathIfExists(uploadsRootDir);

    const rollbackUploadsDir = path.join(rollbackDir, 'uploads');
    if (fs.existsSync(rollbackUploadsDir)) {
      fs.renameSync(rollbackUploadsDir, uploadsRootDir);
    }

    fs.readdirSync(rollbackDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        fs.renameSync(path.join(rollbackDir, entry.name), path.join(userDataDir, entry.name));
      });

    throw error;
  } finally {
    removePathIfExists(rollbackDir);
  }

  return {
    success: true,
    message: '备份已恢复',
    path: backupDir,
  };
}

function collectStringValues(value, collector = []) {
  if (typeof value === 'string') {
    collector.push(value);
    return collector;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, collector));
    return collector;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStringValues(item, collector));
  }

  return collector;
}

function collectReferencedUploads(rows) {
  const referenceMap = new Map();
  const uploadPattern = /\/uploads\/([^/]+)\/([^"'?#\s]+)/g;

  rows.forEach((row) => {
    let parsedContent = [];
    try {
      parsedContent = JSON.parse(row.content_json || '[]');
    } catch {
      parsedContent = [];
    }

    const references = new Set();
    const values = collectStringValues(parsedContent);

    values.forEach((value) => {
      let match = uploadPattern.exec(value);
      while (match) {
        const ownerId = decodeURIComponent(match[1] || '');
        const fileName = decodeURIComponent(match[2] || '');
        if (ownerId === row.id && fileName) {
          references.add(fileName);
        }
        match = uploadPattern.exec(value);
      }
      uploadPattern.lastIndex = 0;
    });

    referenceMap.set(row.id, references);
  });

  return referenceMap;
}

function buildReferencedUploadMap() {
  const db = getDatabase();
  const documentRows = db.prepare('SELECT id, content_json FROM documents').all();
  const quickNoteRows = db.prepare('SELECT id, content_json FROM quick_notes').all();

  return new Map([
    ...collectReferencedUploads(documentRows),
    ...collectReferencedUploads(quickNoteRows),
  ]);
}

function cleanupOrphanAttachments({ uploadsRootDir }) {
  if (!fs.existsSync(uploadsRootDir)) {
    return {
      success: true,
      message: '没有可清理的孤儿附件',
      deletedFiles: 0,
      deletedDirectories: 0,
      reclaimedBytes: 0,
    };
  }

  const db = getDatabase();
  const liveOwnerIds = new Set([
    ...db.prepare('SELECT id FROM documents').all().map((row) => row.id),
    ...db.prepare('SELECT id FROM quick_notes').all().map((row) => row.id),
  ]);
  const referencedUploadMap = buildReferencedUploadMap();

  let deletedFiles = 0;
  let deletedDirectories = 0;
  let reclaimedBytes = 0;

  fs.readdirSync(uploadsRootDir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) {
      return;
    }

    const documentId = entry.name;
    const documentDir = path.join(uploadsRootDir, documentId);

    if (!liveOwnerIds.has(documentId)) {
      reclaimedBytes += listDirectorySize(documentDir);
      deletedFiles += listDirectoryFileCount(documentDir);
      removePathIfExists(documentDir);
      deletedDirectories += 1;
      return;
    }

    const referencedFiles = referencedUploadMap.get(documentId) ?? new Set();
    fs.readdirSync(documentDir, { withFileTypes: true }).forEach((fileEntry) => {
      const filePath = path.join(documentDir, fileEntry.name);

      if (fileEntry.isDirectory()) {
        reclaimedBytes += listDirectorySize(filePath);
        deletedFiles += listDirectoryFileCount(filePath);
        removePathIfExists(filePath);
        deletedDirectories += 1;
        return;
      }

      if (referencedFiles.has(fileEntry.name)) {
        return;
      }

      reclaimedBytes += fs.statSync(filePath).size;
      fs.rmSync(filePath, { force: true });
      deletedFiles += 1;
    });

    if (fs.existsSync(documentDir) && fs.readdirSync(documentDir).length === 0) {
      fs.rmdirSync(documentDir);
      deletedDirectories += 1;
    }
  });

  return {
    success: true,
    message: deletedFiles > 0 ? `已清理 ${deletedFiles} 个孤儿附件` : '没有可清理的孤儿附件',
    deletedFiles,
    deletedDirectories,
    reclaimedBytes,
  };
}

function listDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).reduce((size, entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return size + listDirectorySize(entryPath);
    }

    return size + fs.statSync(entryPath).size;
  }, 0);
}

module.exports = {
  BACKUP_MANIFEST_NAME,
  createBackupSnapshot,
  restoreBackupSnapshot,
  cleanupOrphanAttachments,
  readBackupManifest,
};
