/// <reference types="node" />
// @vitest-environment node

import { afterEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { resolveLanShareHost, resolveMermaidDistDir, startShareServer } = require('./server.cjs');

const runtimes: Array<{ close: () => Promise<void> }> = [];

const requestWithHost = (port: number, requestPath: string, host: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: 'GET',
      headers: { Host: host },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body });
      });
    });
    request.on('error', reject);
    request.end();
  });

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

test('resolves packaged Mermaid vendor assets before dev node_modules assets', async () => {
  const resourcesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-mermaid-assets-'));
  const packagedMermaidDir = path.join(resourcesDir, 'vendor', 'mermaid');
  await fs.mkdir(packagedMermaidDir, { recursive: true });

  expect(resolveMermaidDistDir({ resourcesPath: resourcesDir })).toBe(packagedMermaidDir);
});

test('keeps public shares behind a password gate without affecting LAN share urls', async () => {
  const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workknowlage-public-upload-'));
  const uploadPath = path.join(uploadsDir, 'demo.png');
  await fs.writeFile(uploadPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const shareRepository = {
    getShareByToken: (token) => token === 'lan-token'
      ? { documentId: 'doc-1', enabled: true, token: 'lan-token' }
      : null,
    getPublicShareByToken: (token) => token === 'public-token'
      ? { documentId: 'doc-1', publicEnabled: true, publicToken: 'public-token' }
      : null,
    verifyPublicSharePassword: (token, password) => token === 'public-token' && password === 'correct-password',
  };
  const documentsRepo = {
    getDocumentById: () => ({
      id: 'doc-1',
      title: '公网分享文档',
      contentJson: JSON.stringify([
        {
          id: 'image-1',
          type: 'image',
          props: {
            url: '/uploads/doc-1/demo.png',
            caption: '公开图片',
          },
          children: [],
        },
        {
          id: 'paragraph-1',
          type: 'paragraph',
          content: [{ type: 'text', text: '公网正文', styles: {} }],
          children: [],
        },
      ]),
      updatedAtLabel: 'today',
    }),
  };
  const runtime = await startShareServer({
    documentsRepo,
    shareRepository,
    uploadStorage: {
      resolveUploadPath: ([documentId, fileName]) =>
        documentId === 'doc-1' && fileName === 'demo.png' ? uploadPath : null,
    },
    userDataDir: '',
    networkInterfaces: () => ({
      en0: [{ address: '192.168.31.12', family: 'IPv4', internal: false }],
    }),
  });
  runtimes.push(runtime);

  const publicGate = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token`);
  const publicGateBody = await publicGate.text();
  expect(publicGate.status).toBe(200);
  expect(publicGateBody).toContain('访问密码');
  expect(publicGateBody).not.toContain('公网正文');

  const rejected = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token/auth`, {
    method: 'POST',
    body: new URLSearchParams({ password: 'wrong-password' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  expect(rejected.status).toBe(401);
  expect(await rejected.text()).toContain('访问密码不正确');

  const accepted = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token/auth`, {
    method: 'POST',
    body: new URLSearchParams({ password: 'correct-password' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  expect(accepted.status).toBe(303);
  const cookie = accepted.headers.get('set-cookie') ?? '';
  expect(cookie).toContain('wk_public_share_');

  const publicShare = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  const publicShareBody = await publicShare.text();
  expect(publicShare.status).toBe(200);
  expect(publicShareBody).toContain('公网正文');
  expect(publicShareBody).toContain(`/public/share/public-token/uploads/doc-1/demo.png`);

  const protectedImageWithoutSession = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token/uploads/doc-1/demo.png`);
  expect(protectedImageWithoutSession.status).toBe(200);
  expect(await protectedImageWithoutSession.text()).toContain('访问密码');

  const protectedImage = await fetch(`http://127.0.0.1:${runtime.port}/public/share/public-token/uploads/doc-1/demo.png`, {
    headers: { Cookie: cookie.split(';')[0] },
  });
  expect(protectedImage.status).toBe(200);
  expect(protectedImage.headers.get('content-type')).toBe('image/png');
  expect(new Uint8Array(await protectedImage.arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

  const tunnelUploadBypass = await requestWithHost(runtime.port, '/uploads/doc-1/demo.png', 'demo.trycloudflare.com');
  expect(tunnelUploadBypass.status).toBe(404);

  const tunnelLanShareBypass = await requestWithHost(runtime.port, '/share/lan-token', 'demo.trycloudflare.com');
  expect(tunnelLanShareBypass.status).toBe(404);

  const lanShare = await fetch(`http://127.0.0.1:${runtime.port}/share/lan-token`);
  const lanShareBody = await lanShare.text();
  expect(lanShare.status).toBe(200);
  expect(lanShareBody).toContain('公网正文');
  expect(lanShareBody).not.toContain('访问密码');
});
