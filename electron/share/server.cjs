const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { buildShareHtml } = require('./render.cjs');

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
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
]);

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

function startShareServer({ documentsRepo, shareRepository, uploadStorage, userDataDir }) {
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

      const origin = `http://127.0.0.1:${server.address().port}`;
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

      const origin = `http://127.0.0.1:${server.address().port}`;
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
      server.listen(0, '127.0.0.1');
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
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;

    return {
      server,
      origin,
      port,
      close,
      getPublicUrl(token) {
        return token ? `${origin}/share/${token}` : '';
      },
      getUploadUrl(documentId, fileName) {
        return `${origin}/uploads/${encodeURIComponent(String(documentId))}/${encodeURIComponent(String(fileName))}`;
      },
    };
  });
}

module.exports = {
  startShareServer,
};
