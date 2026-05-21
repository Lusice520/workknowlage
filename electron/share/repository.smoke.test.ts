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
const smokeScriptPath = path.resolve(process.cwd(), 'scripts/electronShareRepositorySmoke.cjs');

test('keeps LAN shares separate from temporary public shares', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-share-repo-'));

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
    const smokeResult = JSON.parse(outputLines.at(-1) ?? '{}');

    expect(smokeResult.ok).toBe(true);
    expect(smokeResult.refreshedLocalToken).toBe(smokeResult.localToken);
    expect(smokeResult.publicToken).not.toBe(smokeResult.localToken);
    expect(smokeResult.publicEnabled).toBe(true);
    expect(smokeResult.publicExpiresAt).toBe('2026-05-22 09:30:00');
    expect(smokeResult.hasPublicPassword).toBe(true);
    expect(smokeResult.tokenLookupDocumentId).toBe(smokeResult.documentId);
    expect(smokeResult.validPassword).toBe(true);
    expect(smokeResult.invalidPassword).toBe(false);
    expect(smokeResult.listedSharesCount).toBe(1);
    expect(smokeResult.listedDocumentTitle).toBe('Public Share Smoke Document');
    expect(smokeResult.disabledPublicEnabled).toBe(false);
    expect(smokeResult.disabledAllCount).toBe(1);
    expect(smokeResult.sharesAfterDisableAllCount).toBe(0);
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}, 30_000);
