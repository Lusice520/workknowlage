/// <reference types="node" />
// @vitest-environment node

import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  getPublicShareExpiryDelay,
  parseCloudflaredReady,
  parseTryCloudflareUrl,
  startCloudflareTunnel,
} = require('./cloudflareTunnel.cjs');

test('parses trycloudflare urls from cloudflared output', () => {
  expect(parseTryCloudflareUrl('Visit https://plain-moon-42.trycloudflare.com for your tunnel')).toBe(
    'https://plain-moon-42.trycloudflare.com',
  );
});

test('detects when cloudflared has registered a tunnel connection', () => {
  expect(parseCloudflaredReady('Registered tunnel connection connIndex=0 connection=abc')).toBe(true);
  expect(parseCloudflaredReady('Your quick Tunnel has been created! https://demo.trycloudflare.com')).toBe(false);
});

test('calculates public share expiry delays for auto-closing tunnels', () => {
  expect(getPublicShareExpiryDelay('', 1_000)).toBeNull();
  expect(getPublicShareExpiryDelay('2026-05-20T03:00:05.000Z', Date.parse('2026-05-20T03:00:00.000Z'))).toBe(5000);
  expect(getPublicShareExpiryDelay('2026-05-20T03:00:00.000Z', Date.parse('2026-05-20T03:00:05.000Z'))).toBe(0);
  expect(getPublicShareExpiryDelay('not-a-date', 1_000)).toBeNull();
});

test('starts a tunnel and resolves when cloudflared registers the public url', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.emit('close', 0);
  };

  const spawnCalls: unknown[] = [];
  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: (...args: unknown[]) => {
      spawnCalls.push(args);
      return child;
    },
    timeoutMs: 1000,
    readinessGraceMs: 0,
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://demo.trycloudflare.com\n'));
  child.stderr.emit('data', Buffer.from('Registered tunnel connection connIndex=0 connection=abc\n'));
  const runtime = await tunnelPromise;

  expect(runtime.publicUrl).toBe('https://demo.trycloudflare.com');
  expect(spawnCalls[0]).toEqual([
    '/usr/local/bin/cloudflared',
    ['tunnel', '--url', 'http://127.0.0.1:4123', '--no-autoupdate', '--protocol', 'http2'],
    expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
  ]);

  await runtime.close();
});

test('notifies when an established cloudflared tunnel exits unexpectedly', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.emit('close', 0);
  };
  let unexpectedExitCode: number | null = null;

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 1000,
    readinessGraceMs: 0,
    onUnexpectedExit: ({ code }: { code: number | null }) => {
      unexpectedExitCode = code;
    },
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://demo.trycloudflare.com\n'));
  child.stderr.emit('data', Buffer.from('Registered tunnel connection connIndex=0 connection=abc\n'));
  const runtime = await tunnelPromise;

  child.emit('exit', 42);
  expect(unexpectedExitCode).toBe(42);

  await runtime.close();
});

test('does not notify unexpected exit when closing the tunnel intentionally', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.emit('exit', 0);
  };
  let unexpectedExitCalled = false;

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 1000,
    readinessGraceMs: 0,
    onUnexpectedExit: () => {
      unexpectedExitCalled = true;
    },
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://demo.trycloudflare.com\n'));
  child.stderr.emit('data', Buffer.from('Registered tunnel connection connIndex=0 connection=abc\n'));
  const runtime = await tunnelPromise;

  await runtime.close();
  expect(unexpectedExitCalled).toBe(false);
});

test('waits for a registered cloudflared connection before exposing the public url', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    child.emit('close', 0);
  };

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 1000,
    readinessGraceMs: 0,
  });

  let resolved = false;
  tunnelPromise.then(() => {
    resolved = true;
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://demo.trycloudflare.com\n'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(resolved).toBe(false);

  child.stderr.emit('data', Buffer.from('Registered tunnel connection connIndex=0 connection=abc\n'));
  const runtime = await tunnelPromise;

  expect(runtime.publicUrl).toBe('https://demo.trycloudflare.com');
  await runtime.close();
});

test('rejects when cloudflared exits during the readiness grace window', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 1000,
    readinessGraceMs: 20,
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://flaky.trycloudflare.com\n'));
  child.stderr.emit('data', Buffer.from('Registered tunnel connection connIndex=0 connection=abc\n'));
  child.emit('exit', 1);

  await expect(tunnelPromise).rejects.toThrow('flaky.trycloudflare.com');
});

test('fails clearly when cloudflared cannot be started', async () => {
  await expect(startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/missing/cloudflared',
    spawnProcess: () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: () => void;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      queueMicrotask(() => child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })));
      return child;
    },
    timeoutMs: 1000,
  })).rejects.toThrow('Cloudflare Tunnel 启动失败');
});

test('rejects a public url when cloudflared exits before registering a connection', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 1000,
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://dead.trycloudflare.com\n'));
  child.stderr.emit('data', Buffer.from('network registration failed\n'));
  child.emit('exit', 1);

  await expect(tunnelPromise).rejects.toThrow('network registration failed');
});

test('includes recent cloudflared output when startup times out before readiness', async () => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};

  const tunnelPromise = startCloudflareTunnel({
    localUrl: 'http://127.0.0.1:4123',
    cloudflaredPath: '/usr/local/bin/cloudflared',
    spawnProcess: () => child,
    timeoutMs: 5,
  });

  child.stderr.emit('data', Buffer.from('Your quick Tunnel has been created! https://slow.trycloudflare.com\n'));

  await expect(tunnelPromise).rejects.toThrow('https://slow.trycloudflare.com');
});
