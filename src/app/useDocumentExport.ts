import { useEffect, useRef, useState } from 'react';
import { getWorkKnowlageApi } from '../shared/lib/workKnowlageApi';

type ExportBlock = Record<string, any>;

interface UseDocumentExportOptions {
  activeDocumentId: string | null;
  activeDocumentTitle: string | null;
  activeQuickNoteDate: string | null;
  getCurrentContentJson: () => string;
  onSaveDocumentContent: (documentId: string, contentJson: string) => Promise<unknown>;
}

export interface DocumentExportState {
  exportMarkdown: () => Promise<void>;
  exportPdf: () => Promise<void>;
  exportWord: () => Promise<void>;
  exportBusy: boolean;
  exportStatusText: string;
}

interface ExportActionResponse {
  success?: boolean;
  message?: string;
  path?: string;
}

interface ExportUtilitiesModule {
  parseBlocks?: (rawContent: string) => ExportBlock[];
  sanitizeFileName?: (rawTitle?: string) => string;
  toMarkdownFromBlocks?: (blocks: ExportBlock[]) => string;
  toPrintHtmlFromBlocks?: (blocks: ExportBlock[]) => string;
  toPrintHtmlDocumentFromBlocks?: (blocks: ExportBlock[], title?: string) => string;
}

interface DocxExportUtilitiesModule {
  buildDocxBytesFromBlocks?: (blocks: ExportBlock[], options?: { title?: string }) => Promise<Uint8Array | Blob | ArrayBuffer | number[]>;
  buildDocxBlobFromBlocks?: (blocks: ExportBlock[], options?: { title?: string }) => Promise<Uint8Array | Blob | ArrayBuffer | number[]>;
}

let exportUtilitiesPromise: Promise<ExportUtilitiesModule | null> | null = null;
let docxUtilitiesPromise: Promise<DocxExportUtilitiesModule | null> | null = null;

const normalizeFileName = (rawTitle: string, extension: string) => {
  const base = String(rawTitle || '文档')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || '文档';

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');

  return `${base}-${stamp}.${extension}`;
};

const parseBlocks = (rawContent: string): ExportBlock[] => {
  try {
    const parsed = JSON.parse(rawContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractInlineText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractInlineText(item)).join('');
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const record = content as Record<string, unknown>;
  if (record.type === 'text') {
    return String(record.text ?? '');
  }

  if (record.type === 'docMention') {
    const title = String(record.props && typeof record.props === 'object' ? (record.props as Record<string, unknown>).title ?? '' : '').trim();
    return `@${title || '未命名文档'}`;
  }

  const nestedContent = Array.isArray(record.content) ? record.content : [];
  const nestedChildren = Array.isArray(record.children) ? record.children : [];
  return [...nestedContent, ...nestedChildren].map((item) => extractInlineText(item)).join('');
};

const renderMarkdownTable = (block: ExportBlock) => {
  const rows: string[][] = [];
  try {
    const parsed = JSON.parse(String(block?.props?.data ?? '[]'));
    const tableNode = Array.isArray(parsed?.content) ? parsed.content.find((item: Record<string, unknown>) => item?.type === 'table') : null;
    const tableRows = Array.isArray(tableNode?.content) ? tableNode.content : [];

    tableRows.forEach((row: Record<string, unknown>) => {
      const cells = Array.isArray(row?.content) ? row.content : [];
      rows.push(cells.map((cell) => extractInlineText(cell).trim() || ' '));
    });
  } catch {
    return '';
  }

  if (rows.length === 0) {
    return '';
  }

  const headers = rows[0];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ];
  return lines.join('\n');
};

const renderMarkdownFromBlocks = (blocks: ExportBlock[] = [], depth = 0): string => {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  blocks.forEach((block) => {
    const type = String(block?.type || 'paragraph');
    const text = extractInlineText(block?.content).trim();

    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(block?.props?.level) || 1));
      lines.push(`${'#'.repeat(level)} ${text || '未命名标题'}`);
    } else if (type === 'paragraph') {
      lines.push(text);
    } else if (type === 'quote') {
      lines.push(`> ${text || '引用'}`);
    } else if (type === 'alert') {
      lines.push(`> ${text || '提醒'}`);
    } else if (type === 'bulletListItem') {
      lines.push(`${indent}- ${text}`);
    } else if (type === 'numberedListItem') {
      lines.push(`${indent}1. ${text}`);
    } else if (type === 'checkListItem') {
      const checked = block?.props?.checked ? 'x' : ' ';
      lines.push(`${indent}- [${checked}] ${text}`);
    } else if (type === 'kbAttachment') {
      const name = String(block?.props?.name || '附件');
      const url = String(block?.props?.url || '').trim();
      lines.push(url ? `[${name}](${url})` : name);
    } else if (type === 'richTable') {
      const tableMarkdown = renderMarkdownTable(block);
      if (tableMarkdown) {
        lines.push(tableMarkdown);
      }
    } else if (text) {
      lines.push(text);
    }

    if (Array.isArray(block?.children) && block.children.length > 0) {
      const childMarkdown = renderMarkdownFromBlocks(block.children as ExportBlock[], depth + 1);
      if (childMarkdown) {
        lines.push(childMarkdown);
      }
    }
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderHtmlTable = (block: ExportBlock) => {
  try {
    const parsed = JSON.parse(String(block?.props?.data ?? '[]'));
    const tableNode = Array.isArray(parsed?.content) ? parsed.content.find((item: Record<string, unknown>) => item?.type === 'table') : null;
    const tableRows = Array.isArray(tableNode?.content) ? tableNode.content : [];

    if (tableRows.length === 0) {
      return '';
    }

    const rowsHtml = tableRows.map((row: Record<string, unknown>) => {
      const cells = Array.isArray(row?.content) ? row.content : [];
      const cellsHtml = cells.map((cell: Record<string, unknown>) => {
        const cellTag = cell?.type === 'tableHeader' ? 'th' : 'td';
        const attrs = cell?.attrs && typeof cell.attrs === 'object' ? (cell.attrs as Record<string, unknown>) : {};
        const innerText = escapeHtml(extractInlineText(cell).trim() || '\u00A0');
        const align = String(attrs.textAlign || '').trim();
        const bg = String(attrs.backgroundColor || '').trim();
        const color = String(attrs.textColor || '').trim();
        const styleParts = [
          align ? `text-align:${align}` : '',
          bg ? `background-color:${bg}` : '',
          color ? `color:${color}` : '',
        ].filter(Boolean);
        const attrParts = [
          styleParts.length > 0 ? `style="${escapeHtml(styleParts.join(';'))}"` : '',
          Number(attrs.colspan) > 1 ? `colspan="${Number(attrs.colspan)}"` : '',
          Number(attrs.rowspan) > 1 ? `rowspan="${Number(attrs.rowspan)}"` : '',
        ].filter(Boolean);
        return `<${cellTag}${attrParts.length > 0 ? ` ${attrParts.join(' ')}` : ''}>${innerText}</${cellTag}>`;
      }).join('');
      return `<tr>${cellsHtml}</tr>`;
    }).join('');

    return `<div class="wk-export-table"><table>${rowsHtml}</table></div>`;
  } catch {
    return '';
  }
};

const renderHtmlFromBlocks = (blocks: ExportBlock[] = [], title = '文档') => {
  const bodyHtml = blocks.map((block) => {
    const type = String(block?.type || 'paragraph');
    const text = escapeHtml(extractInlineText(block?.content).trim());

    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(block?.props?.level) || 1));
      return `<h${level}>${text || '未命名标题'}</h${level}>`;
    }

    if (type === 'quote') {
      return `<blockquote>${text || '引用'}</blockquote>`;
    }

    if (type === 'alert') {
      return `<section class="wk-export-alert">${text || '提醒'}</section>`;
    }

    if (type === 'bulletListItem') {
      return `<li>${text}</li>`;
    }

    if (type === 'numberedListItem') {
      return `<li>${text}</li>`;
    }

    if (type === 'checkListItem') {
      const checked = block?.props?.checked ? 'checked' : 'unchecked';
      return `<section class="wk-export-checklist" data-state="${checked}">${text}</section>`;
    }

    if (type === 'kbAttachment') {
      const name = escapeHtml(String(block?.props?.name || '附件'));
      const url = escapeHtml(String(block?.props?.url || '').trim());
      if (!url) {
        return `<p>${name}</p>`;
      }
      return `<p><a href="${url}" target="_blank" rel="noreferrer">${name}</a></p>`;
    }

    if (type === 'richTable') {
      return renderHtmlTable(block);
    }

    return `<p>${text || '<br />'}</p>`;
  }).join('');

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title || '文档')}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 40px;
        background: #fff;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        line-height: 1.75;
      }
      .wk-export-document { max-width: 900px; margin: 0 auto; }
      h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.2em 0 0.6em; }
      p, blockquote, section { margin: 0 0 0.9em; }
      blockquote {
        border-left: 4px solid #93c5fd;
        padding: 0.25em 0 0.25em 1em;
        color: #334155;
        background: #eff6ff;
      }
      .wk-export-alert {
        border: 1px solid #bfdbfe;
        background: #f8fbff;
        border-radius: 12px;
        padding: 12px 14px;
      }
      .wk-export-table { margin: 18px 0; overflow-x: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d7dee8; padding: 8px 10px; vertical-align: top; }
      th { background: #f4f7fb; font-weight: 700; }
      img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
      a { color: #2563eb; text-decoration: none; }
    </style>
  </head>
  <body>
    <article class="wk-export-document">
      <h1>${escapeHtml(title || '文档')}</h1>
      ${bodyHtml || '<p><br /></p>'}
    </article>
  </body>
</html>`;
};

const normalizeBytes = async (value: Uint8Array | Blob | ArrayBuffer | number[]): Promise<Uint8Array> => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }

  const arrayBuffer = await value.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

const loadExportUtilities = async () => {
  if (!exportUtilitiesPromise) {
    exportUtilitiesPromise = import('../features/export/exportUtils')
      .then((module) => module as ExportUtilitiesModule)
      .catch(() => null);
  }

  return exportUtilitiesPromise;
};

const loadDocxUtilities = async () => {
  if (!docxUtilitiesPromise) {
    docxUtilitiesPromise = import('../features/export/docxExportUtils')
      .then((module) => module as DocxExportUtilitiesModule)
      .catch(() => null);
  }

  return docxUtilitiesPromise;
};

export function useDocumentExport({
  activeDocumentId,
  activeDocumentTitle,
  activeQuickNoteDate,
  getCurrentContentJson,
  onSaveDocumentContent,
}: UseDocumentExportOptions): DocumentExportState {
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const getCurrentContentJsonRef = useRef(getCurrentContentJson);

  useEffect(() => {
    getCurrentContentJsonRef.current = getCurrentContentJson;
  }, [getCurrentContentJson]);

  useEffect(() => {
    setExportBusy(false);
    setExportStatusText('');
  }, [activeDocumentId, activeQuickNoteDate]);

  const runExport = async (
    format: 'markdown' | 'pdf' | 'word',
    exportAction: (helpers: {
      blocks: ExportBlock[];
      contentJson: string;
      fileName: string;
      title: string;
      markdown: string;
      html: string;
    }) => Promise<ExportActionResponse | void>,
  ) => {
    if (!activeDocumentId || activeQuickNoteDate) {
      return;
    }

    const title = String(activeDocumentTitle || '文档').trim() || '文档';
    const contentJson = getCurrentContentJsonRef.current?.() ?? '[]';
    const fileName = normalizeFileName(title, format === 'markdown' ? 'md' : format === 'pdf' ? 'pdf' : 'docx');

    setExportBusy(true);
    setExportStatusText(`正在导出 ${title}`);

    try {
      await onSaveDocumentContent(activeDocumentId, contentJson);

      const exportUtilities = await loadExportUtilities();
      const blocks = exportUtilities?.parseBlocks?.(contentJson) ?? parseBlocks(contentJson);
      const markdown = exportUtilities?.toMarkdownFromBlocks?.(blocks) || renderMarkdownFromBlocks(blocks);
      const html = exportUtilities?.toPrintHtmlDocumentFromBlocks?.(blocks, title) || renderHtmlFromBlocks(blocks, title);

      const result = await exportAction({
        blocks,
        contentJson,
        fileName,
        title,
        markdown,
        html,
      });

      if (result && result.success === false) {
        setExportStatusText(result.message || '已取消导出');
        return;
      }

      setExportStatusText(result?.message || `${title} 已导出`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setExportStatusText(`导出失败：${message}`);
      console.error('[App] Failed to export document:', error);
    } finally {
      setExportBusy(false);
    }
  };

  const exportMarkdown = async () => {
    await runExport('markdown', async ({ fileName, markdown }) => {
      const exportApi = getWorkKnowlageApi().exports;
      if (!exportApi) {
        return { success: false, message: '当前环境不支持导出' };
      }

      return exportApi.saveText(fileName, markdown);
    });
  };

  const exportPdf = async () => {
    await runExport('pdf', async ({ fileName, html }) => {
      const exportApi = getWorkKnowlageApi().exports;
      if (!exportApi) {
        return { success: false, message: '当前环境不支持导出' };
      }

      return exportApi.savePdfFromHtml(fileName, html);
    });
  };

  const exportWord = async () => {
    await runExport('word', async ({ fileName, blocks, title }) => {
      const exportApi = getWorkKnowlageApi().exports;
      if (!exportApi) {
        return { success: false, message: '当前环境不支持导出' };
      }

      try {
        const docxUtilities = await loadDocxUtilities();
        if (!docxUtilities) {
          return { success: false, message: 'Word 导出模块加载失败' };
        }

        let bytes: Uint8Array | null = null;
        if (docxUtilities?.buildDocxBytesFromBlocks) {
          bytes = await normalizeBytes(await docxUtilities.buildDocxBytesFromBlocks(blocks, { title }));
        } else if (docxUtilities?.buildDocxBlobFromBlocks) {
          bytes = await normalizeBytes(await docxUtilities.buildDocxBlobFromBlocks(blocks, { title }));
        }

        if (!bytes || bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
          return { success: false, message: 'Word 导出失败：生成的文件不是有效的 DOCX' };
        }

        return exportApi.saveBinary(fileName, bytes);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        console.error('[App] Failed to export Word document:', error);
        return { success: false, message: `Word 导出失败：${message}` };
      }
    });
  };

  return {
    exportMarkdown,
    exportPdf,
    exportWord,
    exportBusy,
    exportStatusText,
  };
}
