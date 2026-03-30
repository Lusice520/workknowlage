const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { resolveSavePath, sanitizeExportFileName } = require('./files.cjs');

function ensurePrintableHtml(html, title) {
  const rawHtml = String(html ?? '').trim();
  if (/<!doctype html>/i.test(rawHtml) || /<html[\s>]/i.test(rawHtml)) {
    return rawHtml;
  }

  const safeTitle = String(title || 'WorkKnowlage Export').replace(/[<>&"]/g, '');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #1f2937;
      background: white;
    }
    .wk-export-page {
      padding: 32px 40px;
    }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body><div class="wk-export-page">${rawHtml}</div></body>
</html>`;
}

async function createHiddenExportWindow(html, title) {
  if (app && typeof app.whenReady === 'function' && typeof app.isReady === 'function' && !app.isReady()) {
    await app.whenReady();
  }

  const window = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.setMenuBarVisibility(false);

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(ensurePrintableHtml(html, title))}`;
  const loadPromise = new Promise((resolve, reject) => {
    const cleanup = () => {
      window.webContents.removeListener('did-finish-load', handleLoad);
      window.webContents.removeListener('did-fail-load', handleFail);
      window.webContents.removeListener('render-process-gone', handleGone);
    };

    const handleLoad = () => {
      cleanup();
      resolve();
    };

    const handleFail = (_event, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`Failed to load export HTML: ${errorCode} ${errorDescription}`));
    };

    const handleGone = (_event, details) => {
      cleanup();
      reject(new Error(`Export window closed unexpectedly: ${details?.reason || 'unknown'}`));
    };

    window.webContents.once('did-finish-load', handleLoad);
    window.webContents.once('did-fail-load', handleFail);
    window.webContents.once('render-process-gone', handleGone);
  });

  await window.loadURL(dataUrl);
  await loadPromise;
  await window.webContents.executeJavaScript(`
    Promise.all(
      Array.from(document.images || [])
        .filter((image) => !image.complete)
        .map((image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }))
    )
  `).catch(() => undefined);
  return window;
}

async function savePdfFromHtml(options = {}) {
  const {
    html = '',
    outputPath,
    defaultPath,
    title = 'WorkKnowlage Export',
    dialog,
    browserWindow,
    windowFactory = createHiddenExportWindow,
    printOptions = {
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      marginsType: 1,
    },
  } = options;

  const safeTitle = sanitizeExportFileName(title || 'WorkKnowlage Export');
  const resolvedPath = outputPath || (await resolveSavePath({
    dialog,
    browserWindow,
    defaultPath: defaultPath || `${safeTitle}.pdf`,
    title: '导出 PDF',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })).filePath;

  if (!resolvedPath) {
    return { canceled: true, path: '' };
  }

  const exportWindow = await windowFactory(html, title);

  try {
    const pdfBuffer = await exportWindow.webContents.printToPDF(printOptions);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, pdfBuffer);
    return {
      path: resolvedPath,
      bytesWritten: pdfBuffer.byteLength,
    };
  } finally {
    if (!exportWindow.isDestroyed()) {
      exportWindow.destroy();
    }
  }
}

module.exports = {
  createHiddenExportWindow,
  ensurePrintableHtml,
  savePdfFromHtml,
};
