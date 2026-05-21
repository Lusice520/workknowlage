const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TRYCLOUDFLARE_URL_PATTERN = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com\b/;
const CLOUDFLARED_READY_PATTERN = /(Registered tunnel connection|Connection .* registered|registered connIndex=)/i;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function parseTryCloudflareUrl(output) {
  return String(output || '').match(TRYCLOUDFLARE_URL_PATTERN)?.[0] || '';
}

function parseCloudflaredReady(output) {
  return CLOUDFLARED_READY_PATTERN.test(String(output || ''));
}

function getPublicShareExpiryDelay(expiresAt, nowMs = Date.now()) {
  const normalizedExpiresAt = String(expiresAt || '').trim();
  if (!normalizedExpiresAt) {
    return null;
  }

  const expiresTime = Date.parse(normalizedExpiresAt);
  if (Number.isNaN(expiresTime)) {
    return null;
  }

  return Math.min(Math.max(expiresTime - nowMs, 0), MAX_TIMER_DELAY_MS);
}

function resolveCloudflaredPath({ resourcesPath = process.resourcesPath, env = process.env } = {}) {
  const candidates = [
    resourcesPath ? path.join(resourcesPath, 'bin', 'cloudflared') : '',
    env.CLOUDFLARED_PATH,
    'cloudflared',
  ].filter(Boolean);

  return candidates.find((candidate) => candidate === 'cloudflared' || fs.existsSync(candidate)) || 'cloudflared';
}

function startCloudflareTunnel({
  localUrl,
  cloudflaredPath = resolveCloudflaredPath(),
  protocol = 'http2',
  spawnProcess = spawn,
  timeoutMs = 15_000,
  readinessGraceMs = 750,
  onUnexpectedExit = null,
} = {}) {
  const normalizedLocalUrl = String(localUrl || '').trim();
  if (!normalizedLocalUrl) {
    return Promise.reject(new Error('Cloudflare Tunnel 启动失败：缺少本地分享地址'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let child = null;
    let publicUrl = '';
    let ready = false;
    let closingIntentionally = false;
    let readinessTimerId = null;
    const appendLog = (() => {
      let log = '';
      return {
        add: (chunk) => {
          log += String(chunk || '');
          if (log.length > 4000) {
            log = log.slice(-4000);
          }
        },
        flush: () => {
          const result = log;
          log = '';
          return result;
        },
      };
    })();
    const withRecentLog = (message) => {
      const recentLog = appendLog.flush().trim();
      return recentLog ? `${message}，日志：${recentLog}` : message;
    };
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (readinessTimerId) {
        clearTimeout(readinessTimerId);
      }
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        child?.kill?.();
      } catch {
        // Best effort cleanup.
      }
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const succeed = (publicUrl) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({
        publicUrl,
        close: () => new Promise((closeResolve) => {
          if (!child) {
            closeResolve();
            return;
          }

          closingIntentionally = true;
          const done = () => closeResolve();
          child.once?.('close', done);
          child.once?.('exit', done);
          try {
            child.kill?.();
          } catch {
            closeResolve();
          }
        }),
      });
    };

    const timeoutId = setTimeout(() => {
      fail(new Error(withRecentLog('Cloudflare Tunnel 启动失败：未在限定时间内获得可用公网链接')));
    }, timeoutMs);

    try {
      const normalizedProtocol = String(protocol || '').trim();
      const args = ['tunnel', '--url', normalizedLocalUrl, '--no-autoupdate'];
      if (normalizedProtocol) {
        args.push('--protocol', normalizedProtocol);
      }

      child = spawnProcess(
        cloudflaredPath,
        args,
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (error) {
      fail(new Error(`Cloudflare Tunnel 启动失败：${error.message}`));
      return;
    }

    const maybeSucceed = () => {
      if (!publicUrl || !ready || readinessTimerId) {
        return;
      }
      if (readinessGraceMs <= 0) {
        succeed(publicUrl);
        return;
      }
      readinessTimerId = setTimeout(() => {
        readinessTimerId = null;
        succeed(publicUrl);
      }, readinessGraceMs);
    };

    const handleOutput = (chunk) => {
      appendLog.add(chunk);
      const nextPublicUrl = parseTryCloudflareUrl(chunk);
      if (nextPublicUrl) {
        publicUrl = nextPublicUrl;
      }
      if (parseCloudflaredReady(chunk)) {
        ready = true;
      }
      maybeSucceed();
    };

    child.stdout?.on?.('data', handleOutput);
    child.stderr?.on?.('data', handleOutput);
    child.once?.('error', (error) => {
      fail(new Error(withRecentLog(`Cloudflare Tunnel 启动失败：${error.message}`)));
    });
    child.once?.('exit', (code) => {
      if (!settled) {
        fail(new Error(withRecentLog(`Cloudflare Tunnel 启动失败：进程已退出（code ${String(code)}）`)));
        return;
      }

      if (!closingIntentionally && typeof onUnexpectedExit === 'function') {
        onUnexpectedExit({ code, publicUrl });
      }
    });
  });
}

module.exports = {
  getPublicShareExpiryDelay,
  parseCloudflaredReady,
  parseTryCloudflareUrl,
  resolveCloudflaredPath,
  startCloudflareTunnel,
};
