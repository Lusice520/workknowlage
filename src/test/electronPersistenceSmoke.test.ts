/// <reference types="node" />
// @vitest-environment node

import { afterEach, expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

let tempUserDataDir: string | null = null;
const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const dbModulePath = require.resolve('../../electron/db/index.cjs');
const smokeScriptPath = path.resolve(
  process.cwd(),
  'scripts/electronPersistenceSmoke.cjs'
);
const loadDbModule = (): {
  closeDatabase: () => void;
  getDbPath: () => string;
} => require(dbModulePath);

const runElectronSmokeScript = (userDataDir: string) => {
  const result = spawnSync(electronBinary, [smokeScriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      WORKKNOWLAGE_USER_DATA_DIR: userDataDir,
    },
    timeout: 30_000,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error([
      `status ${String(result.status)}`,
      `signal ${String(result.signal)}`,
      String(result.stderr || ''),
      String(result.stdout || ''),
    ].filter(Boolean).join('\n'));
  }

  return JSON.parse(String(result.stdout || '').trim().split('\n').filter(Boolean).at(-1) ?? '{}');
};

const createTempUserDataDir = async () => {
  tempUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-persistence-'));
  process.env.WORKKNOWLAGE_USER_DATA_DIR = tempUserDataDir;
  return tempUserDataDir;
};

afterEach(async () => {
  const dbModule = loadDbModule();
  dbModule.closeDatabase();

  delete process.env.WORKKNOWLAGE_USER_DATA_DIR;

  if (tempUserDataDir) {
    await fs.rm(tempUserDataDir, { recursive: true, force: true });
    tempUserDataDir = null;
  }

  vi.resetModules();
  delete require.cache[dbModulePath];
});

test('resolves the SQLite database path inside an overridden user data directory', async () => {
  const userDataDir = await createTempUserDataDir();
  delete require.cache[dbModulePath];
  const { getDbPath } = loadDbModule();

  expect(getDbPath()).toBe(path.join(userDataDir, 'workknowlage.db'));
});

test('persists created spaces, folders, documents, and quick notes across database reopen in Electron', async () => {
  const userDataDir = await createTempUserDataDir();
  const smokeResult = runElectronSmokeScript(userDataDir);

  expect(smokeResult.ok).toBe(true);
  expect(smokeResult.dbPath).toBe(path.join(userDataDir, 'workknowlage.db'));
  expect(smokeResult.persisted).toEqual({
    spaceName: 'Smoke Space',
    folderName: 'Smoke Folder',
    documentTitle: 'Smoke Document Renamed',
    quickNoteTitle: '3月26日快记',
  });
  expect(smokeResult.backlinks).toMatchObject({
    visibleAfterReopen: true,
    sourceDocumentId: expect.any(String),
    sourceBlockId: expect.any(String),
  });
  await expect(fs.access(smokeResult.dbPath)).resolves.toBeUndefined();
});

test('creates a backup, restores overwritten data, and cleans orphan attachments in Electron', async () => {
  const userDataDir = await createTempUserDataDir();
  const smokeResult = runElectronSmokeScript(userDataDir);

  expect(smokeResult.ok).toBe(true);
  expect(smokeResult.backup).toMatchObject({
    created: true,
    path: expect.any(String),
  });
  expect(smokeResult.restored).toEqual({
    documentTitle: 'Smoke Document Renamed',
    attachmentRestored: true,
    quickNoteAttachmentRestored: true,
  });
  expect(smokeResult.cleanup).toMatchObject({
    deletedFiles: 1,
    deletedDirectories: 1,
  });
});

test('persists the trash lifecycle for documents in Electron', async () => {
  const userDataDir = await createTempUserDataDir();
  const smokeResult = runElectronSmokeScript(userDataDir);

  expect(smokeResult.ok).toBe(true);
  expect(smokeResult.trash).toEqual({
    softDeletedVisible: false,
    restoredVisible: true,
    purgedRecoverable: false,
    attachmentPurged: true,
  });
  expect(smokeResult.backlinks).toEqual({
    visibleAfterReopen: true,
    hiddenAfterTrash: true,
    visibleAfterRestore: true,
    hiddenAfterPurge: true,
    sourceDocumentId: expect.any(String),
    sourceBlockId: expect.any(String),
  });
});
