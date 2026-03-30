/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const smokeScriptPath = path.resolve(process.cwd(), 'scripts/electronRootDocumentSmoke.cjs');

test('persists root-level document creation and move in Electron SQLite storage', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-root-doc-'));

  try {
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

    const outputLines = String(result.stdout || '').trim().split('\n').filter(Boolean);
    const resultLine = outputLines.findLast((line) => line.startsWith('__ROOT_SMOKE__'));
    const smokeResult = JSON.parse(resultLine?.replace('__ROOT_SMOKE__', '') ?? '{}');

    expect(smokeResult.ok).toBe(true);
    expect(smokeResult.createdRootFolderId).toBeNull();
    expect(smokeResult.movedRootFolderId).toBeNull();
    expect(smokeResult.rootSearchHit).toMatchObject({
      kind: 'document',
      title: 'Root Smoke Document',
      spaceId: smokeResult.spaceId,
    });
    expect(smokeResult.rootSearchHit).not.toHaveProperty('folderId');
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}, 30_000);
