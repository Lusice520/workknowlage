/// <reference types="node" />
// @vitest-environment node

import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const smokeScriptPath = path.resolve(process.cwd(), 'scripts/electronRichTableOverlaySmoke.cjs');

const runElectronSmokeScript = () => {
  const result = spawnSync(electronBinary, [smokeScriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
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

test('reports the browser regression matrix scenarios from Electron smoke', () => {
  const smokeResult = runElectronSmokeScript();

  expect(smokeResult.ok).toBe(true);
  expect(smokeResult.scenarios).toEqual([
    'page scroll with active table',
    'editor scroll with active table',
    'toolbar visibility and anchor semantics',
    'add-row and add-col affordances',
    'rounded corners',
    'equal-width action',
    'merged-cell guardrail',
  ]);
  expect(smokeResult.checks).toMatchObject({
    richTableSource: true,
    overlaySource: true,
    overlayModelSource: true,
  });
});
