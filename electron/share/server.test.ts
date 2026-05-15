/// <reference types="node" />
// @vitest-environment node

import { afterEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveLanShareHost, startShareServer } = require('./server.cjs');

const runtimes: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

test('resolves a private LAN IPv4 address for share URLs', () => {
  const host = resolveLanShareHost({
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    utun4: [{ address: '100.64.0.4', family: 'IPv4', internal: false }],
    en0: [{ address: '192.168.31.12', family: 'IPv4', internal: false }],
  });

  expect(host).toBe('192.168.31.12');
});

test('falls back to loopback when no LAN IPv4 address is available', () => {
  const host = resolveLanShareHost({
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  });

  expect(host).toBe('127.0.0.1');
});

test('starts the share server on all interfaces and returns LAN public urls', async () => {
  const runtime = await startShareServer({
    documentsRepo: {},
    shareRepository: {},
    uploadStorage: {},
    userDataDir: '',
    networkInterfaces: () => ({
      en0: [{ address: '192.168.31.12', family: 'IPv4', internal: false }],
    }),
  });
  runtimes.push(runtime);
  const address = runtime.server.address();

  expect(runtime.listenHost).toBe('0.0.0.0');
  expect(typeof address === 'object' && address ? address.address : '').toBe('0.0.0.0');
  expect(runtime.getPublicUrl('share-token')).toBe(`http://192.168.31.12:${runtime.port}/share/share-token`);
  expect(runtime.getUploadUrl('doc 1', 'image 1.png')).toBe(
    `http://192.168.31.12:${runtime.port}/uploads/doc%201/image%201.png`,
  );
});

test('serves Mermaid browser bundle for shared diagrams', async () => {
  const runtime = await startShareServer({
    documentsRepo: {},
    shareRepository: {},
    uploadStorage: {},
    userDataDir: '',
    networkInterfaces: () => ({
      en0: [{ address: '192.168.31.12', family: 'IPv4', internal: false }],
    }),
  });
  runtimes.push(runtime);

  const response = await fetch(`http://127.0.0.1:${runtime.port}/vendor/mermaid/mermaid.esm.min.mjs`);
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  expect(body).toContain('mermaid');
});
