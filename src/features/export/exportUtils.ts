const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeCssValue = (value: unknown) => String(value || '').replace(/[<>"`]/g, '').trim();

export const sanitizeFileName = (rawTitle = '文档') =>
  String(rawTitle || '文档')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || '文档';

export const parseBlocks = (rawContent: unknown) => {
  if (!rawContent) {
    return [];
  }

  if (Array.isArray(rawContent)) {
    return rawContent;
  }

  if (typeof rawContent !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(rawContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeExportAssetUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/uploads/')) {
    return raw;
  }

  if (raw.startsWith('data:image/')) {
    return raw;
  }

  return '';
};

const isListType = (type: string) => type === 'bulletListItem' || type === 'numberedListItem';

const parseRichTableRows = (rawData: unknown) => {
  if (!rawData) {
    return [];
  }

  try {
    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    const tableNode = Array.isArray(parsed?.content)
      ? parsed.content.find((node: any) => node?.type === 'table')
      : null;
    const rows = Array.isArray(tableNode?.content) ? tableNode.content : [];

    return rows.map((row: any) => {
      const cells = Array.isArray(row?.content) ? row.content : [];
      return cells.map((cell: any) => extractInlineText(cell?.content || []));
    });
  } catch {
    return [];
  }
};

const renderRichTableNodeToHtml = (node: any): string => {
  if (!node) {
    return '';
  }

  if (typeof node === 'string') {
    return escapeHtml(node);
  }

  if (node.type === 'text') {
    let html = escapeHtml(node.text || '');
    const marks = Array.isArray(node.marks) ? node.marks : [];

    for (const mark of marks) {
      const type = mark?.type;

      if (type === 'bold') {
        html = `<strong>${html}</strong>`;
        continue;
      }

      if (type === 'italic') {
        html = `<em>${html}</em>`;
        continue;
      }

      if (type === 'underline') {
        html = `<u>${html}</u>`;
        continue;
      }

      if (type === 'strike') {
        html = `<s>${html}</s>`;
        continue;
      }

      if (type === 'code') {
        html = `<code>${html}</code>`;
        continue;
      }

      if (type === 'rtTextColor') {
        const color = sanitizeCssValue(mark?.attrs?.color);
        html = color ? `<span style="color:${escapeHtml(color)}">${html}</span>` : html;
        continue;
      }

      if (type === 'rtTextBackground') {
        const color = sanitizeCssValue(mark?.attrs?.color);
        html = color ? `<span style="background-color:${escapeHtml(color)}">${html}</span>` : html;
        continue;
      }

      if (type === 'link') {
        const hrefRaw = String(mark?.attrs?.href || '').trim();
        const safeHref = /^https?:\/\//i.test(hrefRaw) || hrefRaw.startsWith('/uploads/') ? hrefRaw : '#';
        html = `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${html}</a>`;
      }
    }

    return html;
  }

  if (node.type === 'hardBreak') {
    return '<br />';
  }

  const children = Array.isArray(node.content)
    ? node.content.map((child: any) => renderRichTableNodeToHtml(child)).join('')
    : '';

  if (node.type === 'paragraph') {
    return `<p>${children || '<br />'}</p>`;
  }

  if (node.type === 'bulletList') {
    return `<ul>${children}</ul>`;
  }

  if (node.type === 'orderedList') {
    return `<ol>${children}</ol>`;
  }

  if (node.type === 'listItem') {
    return `<li>${children || '<p><br /></p>'}</li>`;
  }

  return children;
};

const renderRichTableCellHtml = (contentNodes: any[] = []) => {
  const html = (Array.isArray(contentNodes) ? contentNodes : []).map((item) => renderRichTableNodeToHtml(item)).join('');
  return html || '<p><br /></p>';
};

const renderRichTableHtml = (rawData: unknown) => {
  const rows = parseRichTableRows(rawData);
  if (rows.length === 0) {
    return '';
  }

  const doc = typeof rawData === 'string' ? (() => {
    try {
      return JSON.parse(rawData);
    } catch {
      return null;
    }
  })() : rawData;
  const tableNode = Array.isArray(doc?.content) ? doc.content.find((node: any) => node?.type === 'table') : null;
  const tableRows = Array.isArray(tableNode?.content) ? tableNode.content : [];

  const htmlRows = tableRows.map((row: any, rowIndex: number) => {
    const cells = Array.isArray(row?.content) ? row.content : [];
    const cellHtml = cells.map((cell: any, cellIndex: number) => {
      const tag = cell?.type === 'tableHeader' || rowIndex === 0 ? 'th' : 'td';
      const attrs = cell?.attrs || {};
      const attrParts: string[] = [];
      const colspan = Number(attrs.colspan) || 1;
      const rowspan = Number(attrs.rowspan) || 1;

      if (colspan > 1) {
        attrParts.push(`colspan="${colspan}"`);
      }

      if (rowspan > 1) {
        attrParts.push(`rowspan="${rowspan}"`);
      }

      const styleParts: string[] = [];
      const bg = String(attrs.backgroundColor || '').trim();
      const color = String(attrs.textColor || '').trim();
      const align = String(attrs.textAlign || '').trim();
      if (bg) {
        styleParts.push(`background-color:${bg}`);
      }
      if (color) {
        styleParts.push(`color:${color}`);
      }
      if (align) {
        styleParts.push(`text-align:${align}`);
      }
      if (styleParts.length > 0) {
        attrParts.push(`style="${escapeHtml(styleParts.join(';'))}"`);
      }

      const contentNodes = Array.isArray(cell?.content) ? cell.content : [];
      const innerHtml = renderRichTableCellHtml(contentNodes);
      const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
      return `<${tag}${attrText}>${innerHtml}</${tag}>`;
    }).join('');

    return `<tr>${cellHtml}</tr>`;
  }).join('');

  return `<div class="kb-export-table"><table>${htmlRows}</table></div>`;
};

const getAlertExportTheme = (type: unknown) => {
  const value = String(type || 'warning');
  if (value === 'error') {
    return { value: 'error', icon: '✖', label: '错误' };
  }
  if (value === 'info') {
    return { value: 'info', icon: 'ℹ', label: '提示' };
  }
  if (value === 'success') {
    return { value: 'success', icon: '✓', label: '成功' };
  }
  return { value: 'warning', icon: '⚠', label: '警告' };
};

const renderExportImageFigure = ({ src, alt, caption }: { src: string; alt: string; caption?: string }) => {
  const safeSrc = normalizeExportAssetUrl(src);
  if (!safeSrc) {
    return '';
  }

  const safeAlt = escapeHtml(alt || caption || '图片');
  const safeCaption = escapeHtml(caption || '');
  const captionHtml = safeCaption ? `<figcaption>${safeCaption}</figcaption>` : '';
  return `<figure class="kb-export-image"><img src="${escapeHtml(safeSrc)}" alt="${safeAlt}" />${captionHtml}</figure>`;
};

const renderInlineHtmlNode = (node: any): string => {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string') {
    return escapeHtml(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => renderInlineHtmlNode(item)).join('');
  }

  if (typeof node !== 'object') {
    return '';
  }

  if (node.type === 'text') {
    let html = escapeHtml(node.text || '');
    const styles = node.styles || {};

    if (styles.code) {
      html = `<code>${html}</code>`;
    }
    if (styles.bold) {
      html = `<strong>${html}</strong>`;
    }
    if (styles.italic) {
      html = `<em>${html}</em>`;
    }
    if (styles.underline) {
      html = `<u>${html}</u>`;
    }
    if (styles.strike) {
      html = `<s>${html}</s>`;
    }

    const textColor = sanitizeCssValue(styles.textColor);
    if (textColor) {
      html = `<span style="color:${escapeHtml(textColor)}">${html}</span>`;
    }

    const backgroundColor = sanitizeCssValue(styles.backgroundColor);
    if (backgroundColor) {
      html = `<span style="background-color:${escapeHtml(backgroundColor)}">${html}</span>`;
    }

    return html;
  }

  if (node.type === 'docMention') {
    const title = String((node.props as Record<string, unknown> | undefined)?.title || '').trim() || '未命名文档';
    return `<span class="kb-doc-mention">@${escapeHtml(title)}</span>`;
  }

  if (node.type === 'hardBreak') {
    return '<br />';
  }

  if (node.type === 'link') {
    const hrefRaw = String(node?.href || node?.attrs?.href || '').trim();
    const safeHref = /^https?:\/\//i.test(hrefRaw) || hrefRaw.startsWith('/uploads/') ? hrefRaw : '#';
    const children = renderInlineHtmlNode(node.content);
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${children || escapeHtml(hrefRaw || '链接')}</a>`;
  }

  if (Array.isArray(node.content) || typeof node.content === 'string') {
    return renderInlineHtmlNode(node.content);
  }

  return '';
};

const renderInlineHtml = (content: unknown) => renderInlineHtmlNode(content);

const buildBlockAlignmentStyle = (value: unknown) => {
  const alignment = String(value || '').trim();
  return alignment ? ` style="text-align:${escapeHtml(sanitizeCssValue(alignment))}"` : '';
};

export const extractInlineText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((node) => extractInlineText(node)).join('');
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const node = content as Record<string, unknown>;

  if (node.type === 'text') {
    return String(node.text || '');
  }

  if (node.type === 'docMention') {
    const title = String((node.props as Record<string, unknown> | undefined)?.title || '').trim();
    return title ? `@${title}` : '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'link') {
    return extractInlineText(node.content);
  }

  if (Array.isArray(node.content)) {
    return node.content.map((value) => extractInlineText(value)).join('');
  }

  if (typeof node.content === 'string') {
    return node.content;
  }

  return '';
};

export const toMarkdownFromBlocks = (blocks: unknown, depth = 0): string => {
  const lines: string[] = [];
  const list = Array.isArray(blocks) ? blocks : [];
  const indent = '  '.repeat(depth);

  for (const block of list as any[]) {
    const type = block?.type || 'paragraph';
    const text = extractInlineText(block?.content).trim();

    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(block?.props?.level) || 1));
      lines.push(`${'#'.repeat(level)} ${text || '未命名标题'}`);
    } else if (type === 'paragraph') {
      lines.push(text);
    } else if (type === 'checkListItem') {
      const checked = block?.props?.checked ? 'x' : ' ';
      lines.push(`${indent}- [${checked}] ${text}`);
    } else if (type === 'bulletListItem') {
      lines.push(`${indent}- ${text}`);
    } else if (type === 'numberedListItem') {
      lines.push(`${indent}1. ${text}`);
    } else if (type === 'alert') {
      lines.push(`> ${text || '提醒'}`);
    } else if (type === 'kbAttachment') {
      const name = block?.props?.name || '附件';
      const url = block?.props?.url || '';
      lines.push(url ? `[${name}](${url})` : name);
    } else if (type === 'image') {
      const src = String(block?.props?.url || '').trim();
      const caption = String(block?.props?.caption || '').trim();
      const alt = caption || '图片';
      lines.push(src ? `![${alt}](${src})` : alt);
    } else if (type === 'richTable') {
      const rows = parseRichTableRows(block?.props?.data);
      if (rows.length > 0) {
        const headers = rows[0].map((cell: string) => cell || ' ');
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
        rows.slice(1).forEach((row: string[]) => {
          lines.push(`| ${row.map((cell) => cell || ' ').join(' | ')} |`);
        });
      }
    } else if (text) {
      lines.push(text);
    }

    if (Array.isArray(block?.children) && block.children.length > 0) {
      const childMarkdown = toMarkdownFromBlocks(block.children, isListType(type) ? depth + 1 : depth);
      if (childMarkdown) {
        lines.push(childMarkdown);
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const toPrintHtmlFromBlocks = (blocks: unknown): string => {
  const renderListItem = (block: any) => {
    const text = renderInlineHtml(block?.content);
    const childHtml = Array.isArray(block?.children) && block.children.length > 0 ? renderBlocks(block.children) : '';
    return `<li${buildBlockAlignmentStyle(block?.props?.textAlignment)}>${text || '<span class="kb-export-empty"></span>'}${childHtml}</li>`;
  };

  const renderNormal = (block: any) => {
    const type = block?.type || 'paragraph';
    const text = renderInlineHtml(block?.content);
    const childHtml = Array.isArray(block?.children) && block.children.length > 0 ? renderBlocks(block.children) : '';
    const alignmentAttr = buildBlockAlignmentStyle(block?.props?.textAlignment);

    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, Number(block?.props?.level) || 1));
      return `<h${level}${alignmentAttr}>${text || '未命名标题'}</h${level}>${childHtml}`;
    }

    if (type === 'paragraph') {
      return `<p${alignmentAttr}>${text || '<br />'}</p>${childHtml}`;
    }

    if (type === 'alert') {
      const alertTheme = getAlertExportTheme(block?.props?.type);
      const childSection = childHtml ? `<div class="kb-export-alert-children">${childHtml}</div>` : '';
      return `<section class="kb-export-alert kb-export-alert-${alertTheme.value}"><div class="kb-export-alert-head"><span class="kb-export-alert-icon">${alertTheme.icon}</span><div class="kb-export-alert-text">${text || alertTheme.label}</div></div>${childSection}</section>`;
    }

    if (type === 'kbAttachment') {
      const href = normalizeExportAssetUrl(block?.props?.url) || '#';
      const name = escapeHtml(block?.props?.name || '附件');
      if (block?.props?.isImage && href !== '#') {
        return `${renderExportImageFigure({
          src: href,
          alt: block?.props?.name || '图片附件',
          caption: block?.props?.name || '',
        })}${childHtml}`;
      }
      return `<p${alignmentAttr}><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${name}</a></p>${childHtml}`;
    }

    if (type === 'image') {
      const src = normalizeExportAssetUrl(block?.props?.url);
      const caption = String(block?.props?.caption || '').trim();
      if (!src) {
        return childHtml;
      }
      return `${renderExportImageFigure({
        src,
        alt: caption || '图片',
        caption,
      })}${childHtml}`;
    }

    if (type === 'richTable') {
      const tableHtml = renderRichTableHtml(block?.props?.data);
      return `${tableHtml || ''}${childHtml}`;
    }

    if (type === 'divider') {
      return `<hr />${childHtml}`;
    }

    if (type === 'codeBlock') {
      const code = escapeHtml(typeof block?.content === 'string' ? block.content : extractInlineText(block?.content));
      return `<pre><code>${code}</code></pre>${childHtml}`;
    }

    return `<p${alignmentAttr}>${text || '<br />'}</p>${childHtml}`;
  };

  const renderBlocks = (list: unknown): string => {
    const blocksList = Array.isArray(list) ? list : [];
    let html = '';

    for (let index = 0; index < blocksList.length; index += 1) {
      const block = blocksList[index] as any;
      if (isListType(block?.type)) {
        const tag = block.type === 'numberedListItem' ? 'ol' : 'ul';
        const items: string[] = [];

        while (index < blocksList.length && (blocksList[index] as any)?.type === block.type) {
          items.push(renderListItem(blocksList[index]));
          index += 1;
        }

        index -= 1;
        html += `<${tag}>${items.join('')}</${tag}>`;
      } else {
        html += renderNormal(block);
      }
    }

    return html;
  };

  return renderBlocks(blocks);
};

export const buildPrintHtmlDocument = (bodyHtml: string, title = '文档') => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title || '文档')}</title>
    <style>
      :root {
        color-scheme: light;
        --kb-export-text: #0f172a;
        --kb-export-muted: #475569;
        --kb-export-border: #d7dee8;
        --kb-export-surface: #ffffff;
        --kb-export-soft: #f8fafc;
        --kb-export-soft-blue: #eff6ff;
        --kb-export-link: #2563eb;
        --kb-export-code-bg: rgba(241, 245, 249, 0.92);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 40px;
        background: #ffffff;
        color: var(--kb-export-text);
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        line-height: 1.78;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .kb-export-document {
        max-width: 900px;
        margin: 0 auto;
      }
      .kb-export-title {
        margin: 0 0 28px;
        font-size: 30px;
        line-height: 1.22;
      }
      h1, h2, h3, h4, h5, h6 {
        margin: 1.2em 0 0.55em;
        line-height: 1.28;
        color: #0f172a;
      }
      p, blockquote, section, figure, pre, ul, ol {
        margin: 0 0 0.92em;
      }
      ul, ol {
        padding-left: 1.6em;
      }
      li + li {
        margin-top: 0.28em;
      }
      strong {
        font-weight: 700;
      }
      em {
        font-style: italic;
      }
      u {
        text-decoration: underline;
      }
      s {
        text-decoration: line-through;
      }
      a {
        color: var(--kb-export-link);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      code {
        border-radius: 6px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: var(--kb-export-code-bg);
        color: #1d4ed8;
        font-family: "SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
        font-size: 0.92em;
        padding: 0.08em 0.38em;
      }
      pre {
        overflow-x: auto;
        padding: 14px 16px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 14px;
        background: #f8fafc;
      }
      pre code {
        display: block;
        padding: 0;
        border: none;
        background: transparent;
        color: #0f172a;
        font-size: 0.92em;
        white-space: pre-wrap;
      }
      blockquote {
        border-left: 4px solid #93c5fd;
        padding: 0.25em 0 0.25em 1em;
        color: #334155;
        background: var(--kb-export-soft-blue);
      }
      .kb-doc-mention {
        display: inline-flex;
        align-items: center;
        margin: 0 0.08em;
        padding: 0.08em 0.52em;
        border-radius: 999px;
        border: 1px solid rgba(37, 99, 235, 0.18);
        background: rgba(37, 99, 235, 0.08);
        color: #1d4ed8;
        font-size: 0.94em;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
      }
      .kb-export-alert {
        border: 1px solid #d8e0ff;
        border-radius: 12px;
        padding: 12px 14px;
      }
      .kb-export-alert-head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .kb-export-alert-icon {
        flex: 0 0 auto;
        width: 28px;
        text-align: center;
        font-weight: 700;
        line-height: 1.8;
      }
      .kb-export-alert-text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .kb-export-alert-children {
        margin-top: 6px;
        padding-left: 40px;
      }
      .kb-export-alert-warning {
        background: #fff7df;
        border-color: #f0cf85;
      }
      .kb-export-alert-error {
        background: #ffecec;
        border-color: #efb0b0;
      }
      .kb-export-alert-info {
        background: #eef1ff;
        border-color: #3657ff;
      }
      .kb-export-alert-success {
        background: #ebffed;
        border-color: #98d69d;
      }
      .kb-export-checklist::before {
        display: inline-block;
        width: 1.4em;
        color: var(--kb-export-muted);
      }
      .kb-export-checklist[data-state="checked"]::before {
        content: "☑";
      }
      .kb-export-checklist[data-state="unchecked"]::before {
        content: "☐";
      }
      .kb-export-image {
        margin: 18px 0;
      }
      .kb-export-image img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        border-radius: 14px;
      }
      .kb-export-image figcaption {
        margin-top: 8px;
        color: var(--kb-export-muted);
        font-size: 0.92em;
        text-align: center;
      }
      .kb-export-table {
        margin: 18px 0;
        overflow-x: auto;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        background: var(--kb-export-surface);
      }
      th, td {
        border: 1px solid var(--kb-export-border);
        padding: 9px 11px;
        vertical-align: top;
      }
      th {
        background: #f4f7fb;
        font-weight: 700;
      }
      hr {
        border: none;
        border-top: 1px solid var(--kb-export-border);
        margin: 22px 0;
      }
    </style>
  </head>
  <body>
    <article class="kb-export-document">
      <h1 class="kb-export-title">${escapeHtml(title || '文档')}</h1>
      ${bodyHtml || '<p><br /></p>'}
    </article>
  </body>
</html>`;

export const toPrintHtmlDocumentFromBlocks = (blocks: unknown, title = '文档') =>
  buildPrintHtmlDocument(toPrintHtmlFromBlocks(blocks), title);

export const stripInteractiveExportNodes = (rawHtml = '') => {
  if (!rawHtml || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="kb-export-root">${rawHtml}</div>`, 'text/html');
    const root = doc.getElementById('kb-export-root');
    if (!root) {
      return rawHtml;
    }

    const removeSelectors = [
      '.rt-top-toolbar',
      '.rt-color-menu',
      '.rt-table-grip',
      '.rt-add-col-handle',
      '.rt-add-row-handle',
      '.rt-handle-menu',
      '.rt-hint',
      '.bn-side-menu',
      '.bn-drag-handle-menu',
      '[role="menu"]',
      '[aria-haspopup="menu"]',
    ];

    root.querySelectorAll(removeSelectors.join(',')).forEach((element) => element.remove());
    return root.innerHTML;
  } catch {
    return rawHtml;
  }
};
