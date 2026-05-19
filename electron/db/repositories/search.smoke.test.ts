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
      title: '创意草案',
    });
    expect(['document', 'document-block']).toContain(smokeResult.seedHit.kind);
    expect(smokeResult.blockHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document-block',
          title: 'Smoke Document Renamed',
          blockId: 'search-heading',
          documentId: expect.any(String),
        }),
      ])
    );
    expect(smokeResult.persistedHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          title: 'Smoke Document Renamed',
          spaceId: smokeResult.spaceId,
        }),
        expect.objectContaining({
          kind: 'document-block',
          title: 'Smoke Document Renamed',
          blockId: 'search-paragraph',
          spaceId: smokeResult.spaceId,
        }),
        expect.objectContaining({
          kind: 'quick-note',
          title: '3月26日快记',
          spaceId: smokeResult.spaceId,
        }),
      ])
    );
    expect(smokeResult.spreadsheetTitleHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          title: 'Smoke Budget 预算表',
          spaceId: smokeResult.spaceId,
        }),
      ])
    );
    expect(smokeResult.spreadsheetCellHits).toEqual([]);
    expect(smokeResult.persistedSpreadsheetTitleHits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'document',
          title: 'Smoke Budget 预算表',
          spaceId: smokeResult.spaceId,
        }),
      ])
    );
    expect(smokeResult.persistedSpreadsheetCellHits).toEqual([]);
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}, 30_000);
