const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const { buildShareHtml } = require('./render.cjs');

const LOOPBACK_SHARE_HOST = '127.0.0.1';
const SHARE_LISTEN_HOST = '0.0.0.0';
const DEV_MERMAID_DIST_DIR = path.resolve(__dirname, '..', '..', 'node_modules', 'mermaid', 'dist');

function resolveMermaidDistDir(options = {}) {
  const resourcesPath = String(options.resourcesPath || process.resourcesPath || '').trim();
  const candidates = [
    resourcesPath ? path.join(resourcesPath, 'vendor', 'mermaid') : '',
    DEV_MERMAID_DIST_DIR,
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || DEV_MERMAID_DIST_DIR;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
]);

function isIPv4NetworkAddress(details) {
  return details?.family === 'IPv4' || details?.family === 4;
}

function isPrivateIPv4Address(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

function isLikelyVirtualInterface(name) {
  return /^(awdl|bridge|docker|gif|llw|lo|stf|utun|vboxnet|vmnet|zt)/i.test(String(name || ''));
}

function resolveLanShareHost(networkInterfaces = os.networkInterfaces()) {
  const interfaces = typeof networkInterfaces === 'function' ? networkInterfaces() : networkInterfaces;
  const candidates = [];

  for (const [name, entries] of Object.entries(interfaces || {})) {
    for (const details of entries || []) {
      const address = String(details?.address || '').trim();
      if (!address || details?.internal || !isIPv4NetworkAddress(details) || address === '0.0.0.0') {
        continue;
      }

      candidates.push({
        address,
        isPrivate: isPrivateIPv4Address(address),
        isVirtual: isLikelyVirtualInterface(name),
        isLinkLocal: /^169\.254\./.test(address),
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.isPrivate !== b.isPrivate) {
      return a.isPrivate ? -1 : 1;
    }
    if (a.isVirtual !== b.isVirtual) {
      return a.isVirtual ? 1 : -1;
    }
    if (a.isLinkLocal !== b.isLinkLocal) {
      return a.isLinkLocal ? 1 : -1;
    }
    return 0;
  });

  return candidates[0]?.address || LOOPBACK_SHARE_HOST;
}

function getShareServerPort(server) {
  const address = server.address();
  return typeof address === 'object' && address ? address.port : 0;
}

function buildShareOrigin(host, port) {
  return `http://${host || LOOPBACK_SHARE_HOST}:${port || 0}`;
}

function getRequestOrigin(request, fallbackOrigin) {
  const host = String(request.headers.host || '').trim();
  if (/^[a-zA-Z0-9.:[\]-]+$/.test(host)) {
    return `http://${host}`;
  }

  return fallbackOrigin;
}

function buildPublicShareAssetOrigin(origin, publicToken) {
  return `${origin}/public/share/${encodeURIComponent(publicToken)}`;
}

function isPublicTunnelHost(host) {
  return /(^|\.)trycloudflare\.com(?::\d+)?$/i.test(String(host || '').trim());
}

function isAllowedPublicTunnelPath(pathname) {
  return (
    pathname === '/' ||
    pathname === '/healthz' ||
    pathname.startsWith('/public/share/') ||
    pathname.startsWith('/vendor/mermaid/')
  );
}

function sendJson(res, statusCode, payload, method = 'GET') {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(method === 'HEAD' ? undefined : body);
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8', method = 'GET') {
  const value = String(body || '');
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(value),
    'Cache-Control': 'no-store',
  });
  res.end(method === 'HEAD' ? undefined : value);
}

function sendRedirect(res, location, headers = {}) {
  res.writeHead(303, {
    Location: location,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end();
}

function readRequestBody(request, limit = 1024 * 8) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Request body is too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function parseCookieHeader(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      cookies[part.slice(0, separatorIndex)] = safeDecodeURIComponent(part.slice(separatorIndex + 1));
      return cookies;
    }, {});
}

function getPublicShareSessionCookieName(publicToken) {
  return `wk_public_share_${String(publicToken || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function renderPublicSharePasswordPage({ action, message = '', status = 200 }) {
  const messageHtml = message
    ? `<p class="message" role="alert">${escapeHtml(message)}</p>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>访问密码</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(420px, calc(100vw - 40px)); border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; padding: 28px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { color: #64748b; line-height: 1.7; }
    label { display: grid; gap: 8px; margin-top: 20px; font-size: 13px; color: #475569; }
    input { height: 40px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0 12px; font-size: 14px; }
    button { margin-top: 16px; width: 100%; height: 40px; border: 0; border-radius: 12px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
    .message { margin: 14px 0 0; color: ${status >= 400 ? '#e11d48' : '#2563eb'}; }
  </style>
</head>
<body>
  <main>
    <h1>访问密码</h1>
    <p>这是 WorkKnowlage 临时公网分享。请输入分享者提供的访问密码后继续阅读。</p>
    ${messageHtml}
    <form method="post" action="${escapeHtml(action)}">
      <label>
        访问密码
        <input type="password" name="password" autocomplete="current-password" autofocus />
      </label>
      <button type="submit">进入分享页</button>
    </form>
  </main>
</body>
</html>`;
}

function getContentType(fileName, explicitMimeType) {
  if (explicitMimeType) {
    return explicitMimeType;
  }

  const extension = path.extname(fileName).toLowerCase();
  return CONTENT_TYPES.get(extension) || 'application/octet-stream';
}

function resolveVendorAssetPath(rootDir, requestPath, prefix) {
  const relativePath = requestPath.replace(prefix, '').split('/').filter(Boolean).join(path.sep);
  if (!relativePath) {
    return '';
  }

  const filePath = path.resolve(rootDir, relativePath);
  const rootWithSeparator = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (filePath !== rootDir && !filePath.startsWith(rootWithSeparator)) {
    return '';
  }

  return filePath;
}

function startShareServer({ documentsRepo, shareRepository, spreadsheetsRepo = null, uploadStorage, userDataDir, networkInterfaces = os.networkInterfaces }) {
  const getPublicOrigin = () => buildShareOrigin(resolveLanShareHost(networkInterfaces), getShareServerPort(server));
  const publicShareSessions = new Map();
  const hasPublicShareSession = (publicToken, request) => {
    const cookieName = getPublicShareSessionCookieName(publicToken);
    const sessionValue = parseCookieHeader(request.headers.cookie)[cookieName];
    return Boolean(sessionValue && publicShareSessions.get(publicToken)?.has(sessionValue));
  };
  const createPublicShareSession = (publicToken) => {
    const sessionValue = crypto.randomBytes(24).toString('base64url');
    const sessions = publicShareSessions.get(publicToken) || new Set();
    sessions.add(sessionValue);
    publicShareSessions.set(publicToken, sessions);
    return sessionValue;
  };

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = safeDecodeURIComponent(requestUrl.pathname || '/');

    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
      sendText(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', request.method || 'GET');
      return;
    }

    if (request.method === 'POST' && !/^\/public\/share\/[^/]+\/auth$/.test(pathname)) {
      sendText(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', request.method || 'GET');
      return;
    }

    if (isPublicTunnelHost(request.headers.host) && !isAllowedPublicTunnelPath(pathname)) {
      sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
      return;
    }

    if (pathname === '/' || pathname === '/healthz') {
      sendJson(response, 200, {
        ok: true,
        service: 'workknowlage-share-server',
      }, request.method || 'GET');
      return;
    }

    if (pathname.startsWith('/vendor/mermaid/')) {
      const filePath = resolveVendorAssetPath(resolveMermaidDistDir(), pathname, /^\/vendor\/mermaid\//);
      if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      response.writeHead(200, {
        'Content-Type': getContentType(filePath, null),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      fs.createReadStream(filePath).pipe(response);
      return;
    }

    if (pathname.startsWith('/uploads/')) {
      const [documentId, fileName] = pathname.replace(/^\/uploads\//, '').split('/');
      const filePath = uploadStorage.resolveUploadPath([documentId, fileName]);
      if (!filePath || !fs.existsSync(filePath)) {
        sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      const contentType = getContentType(fileName, null);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }

      fs.createReadStream(filePath).pipe(response);
      return;
    }

    if (pathname.startsWith('/public/share/')) {
      const parts = pathname.replace(/^\/public\/share\//, '').split('/');
      const publicToken = parts[0];
      const isAuthRequest = parts[1] === 'auth';
      const isPublicUploadRequest = parts[1] === 'uploads';
      const share = shareRepository.getPublicShareByToken?.(publicToken);
      if (!share || !share.publicEnabled) {
        sendText(response, 404, 'Share not found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      if (isAuthRequest) {
        if (request.method !== 'POST') {
          sendText(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', request.method || 'GET');
          return;
        }

        let body = '';
        try {
          body = await readRequestBody(request);
        } catch {
          sendText(response, 413, 'Request body is too large', 'text/plain; charset=utf-8', request.method || 'GET');
          return;
        }

        const params = new URLSearchParams(body);
        const password = params.get('password') || '';
        if (!shareRepository.verifyPublicSharePassword?.(publicToken, password)) {
          sendText(
            response,
            401,
            renderPublicSharePasswordPage({
              action: `/public/share/${encodeURIComponent(publicToken)}/auth`,
              message: '访问密码不正确',
              status: 401,
            }),
            'text/html; charset=utf-8',
            request.method || 'GET',
          );
          return;
        }

        const sessionValue = createPublicShareSession(publicToken);
        sendRedirect(response, `/public/share/${encodeURIComponent(publicToken)}`, {
          'Set-Cookie': `${getPublicShareSessionCookieName(publicToken)}=${encodeURIComponent(sessionValue)}; HttpOnly; SameSite=Lax; Path=/public/share/${encodeURIComponent(publicToken)}`,
        });
        return;
      }

      if (!hasPublicShareSession(publicToken, request)) {
        sendText(
          response,
          200,
          renderPublicSharePasswordPage({
            action: `/public/share/${encodeURIComponent(publicToken)}/auth`,
          }),
          'text/html; charset=utf-8',
          request.method || 'GET',
        );
        return;
      }

      if (isPublicUploadRequest) {
        const documentId = parts[2];
        const fileName = parts[3];
        if (!documentId || !fileName || documentId !== share.documentId) {
          sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
          return;
        }

        const filePath = uploadStorage.resolveUploadPath([documentId, fileName]);
        if (!filePath || !fs.existsSync(filePath)) {
          sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
          return;
        }

        const contentType = getContentType(fileName, null);
        response.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        if (request.method === 'HEAD') {
          response.end();
          return;
        }

        fs.createReadStream(filePath).pipe(response);
        return;
      }

      const document = documentsRepo.getDocumentById(share.documentId);
      if (!document) {
        sendText(response, 404, 'Document not found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      const spreadsheetWorkbookJson = document.kind === 'spreadsheet'
        ? spreadsheetsRepo?.getWorkbookByDocumentId?.(document.id)?.workbookJson ?? ''
        : '';
      const origin = getRequestOrigin(request, getPublicOrigin());
      const assetOrigin = buildPublicShareAssetOrigin(origin, publicToken);
      const html = buildShareHtml({ document, share, origin: assetOrigin, spreadsheetWorkbookJson });
      sendText(response, 200, html, 'text/html; charset=utf-8', request.method || 'GET');
      return;
    }

    if (pathname.startsWith('/share/')) {
      const token = pathname.replace(/^\/share\//, '').split('/')[0];
      const share = shareRepository.getShareByToken(token);
      if (!share || !share.enabled) {
        sendText(response, 404, 'Share not found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      const document = documentsRepo.getDocumentById(share.documentId);
      if (!document) {
        sendText(response, 404, 'Document not found', 'text/plain; charset=utf-8', request.method || 'GET');
        return;
      }

      const origin = getRequestOrigin(request, getPublicOrigin());
      const spreadsheetWorkbookJson = document.kind === 'spreadsheet'
        ? spreadsheetsRepo?.getSpreadsheetWorkbook?.(document.id)?.workbookJson ?? ''
        : '';
      const html = buildShareHtml({ document, share, origin, spreadsheetWorkbookJson });
      sendText(response, 200, html, 'text/html; charset=utf-8', request.method || 'GET');
      return;
    }

    if (pathname.startsWith('/api/public/share/')) {
      const token = pathname.replace(/^\/api\/public\/share\//, '').split('/')[0];
      const share = shareRepository.getShareByToken(token);
      if (!share || !share.enabled) {
        sendJson(response, 404, { error: 'Share not found' }, request.method || 'GET');
        return;
      }

      const document = documentsRepo.getDocumentById(share.documentId);
      if (!document) {
        sendJson(response, 404, { error: 'Document not found' }, request.method || 'GET');
        return;
      }

      const origin = getRequestOrigin(request, getPublicOrigin());
      const spreadsheetWorkbookJson = document.kind === 'spreadsheet'
        ? spreadsheetsRepo?.getSpreadsheetWorkbook?.(document.id)?.workbookJson ?? ''
        : '';
      sendJson(response, 200, {
        share,
        document,
        publicUrl: `${origin}/share/${share.token}`,
        html: buildShareHtml({ document, share, origin, spreadsheetWorkbookJson }),
      }, request.method || 'GET');
      return;
    }

    sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
    } catch (_err) {
      sendText(response, 500, 'Internal Server Error', 'text/plain; charset=utf-8', 'GET');
    }
  });

  const listen = () =>
    new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(0, SHARE_LISTEN_HOST);
    });

  const close = () =>
    new Promise((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }

      server.close(() => resolve());
    });

  return listen().then(() => {
    const port = getShareServerPort(server);
    const origin = getPublicOrigin();

    return {
      server,
      origin,
      port,
      listenHost: SHARE_LISTEN_HOST,
      close,
      getPublicUrl(token) {
        return token ? `${getPublicOrigin()}/share/${token}` : '';
      },
      getUploadUrl(documentId, fileName) {
        return `${getPublicOrigin()}/uploads/${encodeURIComponent(String(documentId))}/${encodeURIComponent(String(fileName))}`;
      },
    };
  });
}

module.exports = {
  resolveLanShareHost,
  resolveMermaidDistDir,
  startShareServer,
};
