const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const { buildShareHtml } = require('./render.cjs');

const LOOPBACK_SHARE_HOST = '127.0.0.1';
const SHARE_LISTEN_HOST = '0.0.0.0';
const MERMAID_DIST_DIR = path.resolve(__dirname, '..', '..', 'node_modules', 'mermaid', 'dist');

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

function startShareServer({ documentsRepo, shareRepository, uploadStorage, userDataDir, networkInterfaces = os.networkInterfaces }) {
  const getPublicOrigin = () => buildShareOrigin(resolveLanShareHost(networkInterfaces), getShareServerPort(server));
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname || '/');

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Method Not Allowed', 'text/plain; charset=utf-8', request.method || 'GET');
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
      const filePath = resolveVendorAssetPath(MERMAID_DIST_DIR, pathname, /^\/vendor\/mermaid\//);
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
      const html = buildShareHtml({ document, share, origin });
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
      sendJson(response, 200, {
        share,
        document,
        publicUrl: `${origin}/share/${share.token}`,
        html: buildShareHtml({ document, share, origin }),
      }, request.method || 'GET');
      return;
    }

    sendText(response, 404, 'Not Found', 'text/plain; charset=utf-8', request.method || 'GET');
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
  startShareServer,
};
