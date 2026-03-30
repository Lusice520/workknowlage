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
const smokeScriptPath = path.resolve(process.cwd(), 'scripts/electronSearchSmoke.cjs');

test('indexes seeded content and persists workspace search results across reopen', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-search-'));

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
    expect(smokeResult.dbPath).toBe(path.join(userDataDir, 'workknowlage.db'));
    expect(smokeResult.seedHit).toMatchObject({
      kind: 'document',
      title: '创意草案',
    });
    expect(smokeResult.persistedHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          title: 'Smoke Document Renamed',
          spaceId: smokeResult.spaceId,
        }),
        expect.objectContaining({
          kind: 'quick-note',
          title: '3月26日快记',
          spaceId: smokeResult.spaceId,
        }),
      ])
    );
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}, 30_000);
