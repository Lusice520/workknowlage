function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeCssValue(value) {
  return String(value || '').replace(/[<>"`]/g, '').trim();
}

function parseJsonMaybe(value, fallback) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeBlocks(document) {
  const source = document?.contentJson || JSON.stringify(document?.sections || []);
  const parsed = parseJsonMaybe(source, []);
  return Array.isArray(parsed) ? parsed : [];
}

function resolveAssetUrl(url, origin) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:|mailto:|tel:)/i.test(raw)) return raw;
  if (raw.startsWith('/uploads/')) return `${origin}${raw}`;
  if (raw.startsWith('uploads/')) return `${origin}/${raw}`;
  if (raw.startsWith('/')) return `${origin}${raw}`;
  return raw;
}

function renderInlineMarks(rawText, marks, origin) {
  let html = escapeHtml(rawText || '');
  const markList = Array.isArray(marks) ? marks : [];

  for (const mark of markList) {
    const type = String(mark?.type || '');
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
    if (type === 'link') {
      const href = resolveAssetUrl(mark?.attrs?.href || mark?.href || '', origin) || '#';
      html = `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${html}</a>`;
    }
  }

  return html;
}

function renderInlineNode(node, origin) {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string') {
    return escapeHtml(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => renderInlineNode(item, origin)).join('');
  }

  if (typeof node !== 'object') {
    return '';
  }

  const type = String(node.type || '');
  if (type === 'text') {
    return renderInlineMarks(node.text || '', node.marks, origin);
  }

  if (type === 'hardBreak') {
    return '<br />';
  }

  if (type === 'link') {
    const href = resolveAssetUrl(node.attrs?.href || node.href || '', origin) || '#';
    const children = renderInlineNode(node.content || node.text || '', origin);
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${children}</a>`;
  }

  if (type === 'paragraph' || type === 'heading' || type === 'listItem') {
    return renderInlineNode(node.content || [], origin);
  }

  return renderInlineNode(node.content || '', origin);
}

function renderCellContent(contentNodes, origin) {
  const html = (Array.isArray(contentNodes) ? contentNodes : []).map((node) => renderInlineNode(node, origin)).join('');
  return html || '<p><br /></p>';
}

function renderRichTableHtml(rawData, origin) {
  const parsed = parseJsonMaybe(rawData, null);
  if (!parsed) {
    return '';
  }

  const tableNode = parsed?.content?.find?.((node) => node?.type === 'table') || parsed?.content?.find?.((node) => node?.type === 'tableNode');
  const rows = Array.isArray(tableNode?.content) ? tableNode.content : [];
  if (rows.length === 0) {
    return '';
  }

  const rowHtml = rows.map((row) => {
    const cells = Array.isArray(row?.content) ? row.content : [];
    const cellHtml = cells.map((cell) => {
      const tag = cell?.type === 'tableHeader' ? 'th' : 'td';
      const attrs = cell?.attrs || {};
      const attrParts = [];

      const colspan = Number(attrs.colspan) || 1;
      const rowspan = Number(attrs.rowspan) || 1;
      if (colspan > 1) {
        attrParts.push(`colspan="${colspan}"`);
      }
      if (rowspan > 1) {
        attrParts.push(`rowspan="${rowspan}"`);
      }

      const styleParts = [];
      const bg = sanitizeCssValue(attrs.backgroundColor);
      const color = sanitizeCssValue(attrs.textColor);
      const align = sanitizeCssValue(attrs.textAlign);
      if (bg) styleParts.push(`background-color:${bg}`);
      if (color) styleParts.push(`color:${color}`);
      if (align) styleParts.push(`text-align:${align}`);
      if (styleParts.length > 0) {
        attrParts.push(`style="${escapeHtml(styleParts.join(';'))}"`);
      }

      const contentNodes = Array.isArray(cell?.content) ? cell.content : [];
      const innerHtml = renderCellContent(contentNodes, origin);
      const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
      return `<${tag}${attrText}>${innerHtml}</${tag}>`;
    }).join('');

    return `<tr>${cellHtml}</tr>`;
  }).join('');

  return `<div class="share-table-wrap"><table class="share-table"><tbody>${rowHtml}</tbody></table></div>`;
}

function renderAttachmentBlock(block, origin) {
  const props = block?.props || {};
  const url = resolveAssetUrl(props.url || '', origin);
  const name = String(props.name || '附件');
  const isImage = Boolean(props.isImage) || /^image\//i.test(String(props.mimeType || ''));

  if (!url) {
    return '';
  }

  if (isImage) {
    return `
      <figure class="share-attachment share-attachment-image">
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy" />
        </a>
        <figcaption>${escapeHtml(name)}</figcaption>
      </figure>
    `;
  }

  return `
    <div class="share-attachment">
      <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(name)}</a>
    </div>
  `;
}

function renderAlertBlock(block, origin) {
  const type = String(block?.props?.type || 'warning');
  const children = Array.isArray(block?.children) ? renderBlockSequence(block.children, origin) : '';
  const content = renderInlineNode(block?.content || [], origin);
  return `
    <div class="share-alert share-alert-${escapeHtml(type)}">
      <div class="share-alert-icon" aria-hidden="true">${escapeHtml(type.slice(0, 1).toUpperCase())}</div>
      <div class="share-alert-body">
        ${content ? `<div class="share-alert-content">${content}</div>` : ''}
        ${children}
      </div>
    </div>
  `;
}

function renderLegacySection(section, origin) {
  if (!section || typeof section !== 'object') {
    return '';
  }

  if (section.type === 'heading') {
    return `<h2>${escapeHtml(section.title || '')}</h2>`;
  }

  if (section.type === 'paragraph') {
    return `<p>${escapeHtml(section.content || '')}</p>`;
  }

  if (section.type === 'quote') {
    return `
      <blockquote>
        <p>${escapeHtml(section.content || '')}</p>
        ${section.caption ? `<cite>${escapeHtml(section.caption)}</cite>` : ''}
      </blockquote>
    `;
  }

  if (section.type === 'bullet-list') {
    const items = Array.isArray(section.items) ? section.items : [];
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  if (section.type === 'gallery') {
    const items = Array.isArray(section.items) ? section.items : [];
    return `
      <div class="share-gallery">
        ${items.map((item) => `<div class="share-gallery-card">${escapeHtml(item)}</div>`).join('')}
      </div>
    `;
  }

  if (section.type === 'kbAttachment') {
    return renderAttachmentBlock(section, origin);
  }

  return '';
}

function renderBlock(block, origin) {
  if (!block || typeof block !== 'object') {
    return '';
  }

  if (block.title && block.content && !block.type) {
    return renderLegacySection(block, origin);
  }

  const type = String(block.type || '');
  if (type === 'heading') {
    const level = Math.min(Math.max(Number(block?.props?.level) || 1, 1), 6);
    return `<h${level}>${renderInlineNode(block.content || [], origin)}</h${level}>`;
  }

  if (type === 'paragraph') {
    return `<p>${renderInlineNode(block.content || [], origin) || '<br />'}</p>`;
  }

  if (type === 'quote') {
    const caption = block?.props?.caption || '';
    return `
      <blockquote>
        <p>${renderInlineNode(block.content || [], origin) || '<br />'}</p>
        ${caption ? `<cite>${escapeHtml(caption)}</cite>` : ''}
      </blockquote>
    `;
  }

  if (type === 'kbAttachment') {
    return renderAttachmentBlock(block, origin);
  }

  if (type === 'richTable') {
    return renderRichTableHtml(block?.props?.data || '', origin);
  }

  if (type === 'alert') {
    return renderAlertBlock(block, origin);
  }

  if (type === 'gallery') {
    const items = Array.isArray(block.items) ? block.items : [];
    return `
      <div class="share-gallery">
        ${items.map((item) => `<div class="share-gallery-card">${escapeHtml(item)}</div>`).join('')}
      </div>
    `;
  }

  if (type === 'bullet-list' || type === 'bulletList') {
    const items = Array.isArray(block.items) ? block.items : [];
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  if (type === 'numbered-list' || type === 'numberedList') {
    const items = Array.isArray(block.items) ? block.items : [];
    return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
  }

  if (type === 'bulletListItem' || type === 'numberedListItem') {
    const children = Array.isArray(block.children) ? renderBlockSequence(block.children, origin) : '';
    return `
      <li>
        ${renderInlineNode(block.content || [], origin) || '<br />'}
        ${children}
      </li>
    `;
  }

  if (block.contentJson || block.sections || block.content) {
    return renderLegacySection(block, origin);
  }

  return '';
}

function renderBlockSequence(blocks, origin) {
  const items = Array.isArray(blocks) ? blocks : [];
  let html = '';

  for (let index = 0; index < items.length; index += 1) {
    const block = items[index];
    const type = String(block?.type || '');

    if (type === 'bulletListItem' || type === 'numberedListItem') {
      const ordered = type === 'numberedListItem';
      const listTag = ordered ? 'ol' : 'ul';
      const listItems = [];

      while (index < items.length && String(items[index]?.type || '') === type) {
        listItems.push(renderBlock(items[index], origin));
        index += 1;
      }

      html += `<${listTag}>${listItems.join('')}</${listTag}>`;
      index -= 1;
      continue;
    }

    html += renderBlock(block, origin);
  }

  return html;
}

function extractHeadings(blocks, headings = []) {
  const items = Array.isArray(blocks) ? blocks : [];
  items.forEach((block) => {
    const type = String(block?.type || '');
    if (type === 'heading') {
      const level = Math.min(Math.max(Number(block?.props?.level) || 1, 1), 6);
      const title = renderInlineNode(block.content || [], '').replace(/<[^>]+>/g, '').trim();
      if (title) {
        headings.push({ level, title });
      }
    }

    if (Array.isArray(block?.children) && block.children.length > 0) {
      extractHeadings(block.children, headings);
    }
  });

  return headings;
}

function buildShareHtml({ document, share, origin }) {
  const blocks = normalizeBlocks(document);
  const bodyHtml = renderBlockSequence(blocks, origin);
  const headings = extractHeadings(blocks);
  const title = escapeHtml(document?.title || 'WorkKnowlage');
  const badge = escapeHtml(document?.badgeLabel || '');
  const updatedAt = escapeHtml(document?.updatedAtLabel || '');
  const shareState = share?.enabled ? '已开启只读分享' : '分享已关闭';
  const tocHtml = headings.length > 0
    ? `<nav class="share-toc">${headings.map((heading) => `<div class="share-toc-item share-toc-level-${heading.level}">${escapeHtml(heading.title)}</div>`).join('')}</nav>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - WorkKnowlage</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef3f9;
      --card: rgba(255,255,255,0.88);
      --ink: #0f172a;
      --muted: #64748b;
      --border: rgba(148,163,184,0.24);
      --accent: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 30%), linear-gradient(135deg, #f8fafc 0%, #eef3f9 46%, #e2e8f0 100%);
      color: var(--ink);
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    .hero {
      padding: 28px 30px;
      background: var(--card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 18px 40px rgba(15,23,42,0.06);
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--accent);
    }
    h1 {
      margin: 12px 0 0;
      font-size: clamp(30px, 6vw, 48px);
      line-height: 1.02;
      letter-spacing: -0.05em;
    }
    .meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 6px 12px;
      background: rgba(37,99,235,0.08);
      color: var(--accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 18px;
      margin-top: 18px;
    }
    .content, .sidebar {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      backdrop-filter: blur(20px);
      box-shadow: 0 18px 40px rgba(15,23,42,0.04);
    }
    .content { padding: 30px; }
    .sidebar { padding: 18px; position: sticky; top: 18px; align-self: start; }
    .sidebar-title {
      margin: 0 0 12px;
      font-size: 12px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .share-toc { display: grid; gap: 8px; }
    .share-toc-item { font-size: 13px; color: var(--ink); }
    .share-toc-level-2 { padding-left: 12px; color: var(--muted); }
    .share-toc-level-3 { padding-left: 24px; color: var(--muted); }
    .content h2, .content h3, .content h4, .content h5, .content h6 {
      margin: 28px 0 14px;
      letter-spacing: -0.03em;
    }
    .content p, .content blockquote, .content ul, .content ol, .content .share-gallery, .content .share-alert, .content .share-table-wrap {
      margin: 16px 0;
    }
    .content p { line-height: 1.8; color: #334155; font-size: 15px; }
    .content blockquote {
      border-left: 4px solid rgba(37,99,235,0.22);
      margin-left: 0;
      padding: 14px 18px;
      background: rgba(255,255,255,0.7);
      border-radius: 14px;
      color: #334155;
    }
    .content blockquote cite {
      display: block;
      margin-top: 10px;
      font-style: normal;
      font-size: 12px;
      color: var(--muted);
    }
    .content ul, .content ol {
      padding-left: 22px;
      color: #334155;
      line-height: 1.8;
    }
    .share-alert {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 12px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(37,99,235,0.12);
      background: rgba(37,99,235,0.05);
    }
    .share-alert-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-weight: 700;
      background: rgba(37,99,235,0.12);
      color: var(--accent);
    }
    .share-alert-content > *:first-child { margin-top: 0; }
    .share-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .share-gallery-card, .share-attachment {
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(255,255,255,0.8);
      padding: 14px;
    }
    .share-attachment-image img {
      display: block;
      max-width: 100%;
      border-radius: 14px;
    }
    .share-attachment-image figcaption {
      margin-top: 10px;
      font-size: 12px;
      color: var(--muted);
    }
    .share-table-wrap { overflow-x: auto; }
    .share-table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 18px;
      overflow: hidden;
      background: rgba(255,255,255,0.8);
      border: 1px solid rgba(148,163,184,0.2);
    }
    .share-table th, .share-table td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(148,163,184,0.18);
      vertical-align: top;
      text-align: left;
    }
    .share-table th { background: rgba(37,99,235,0.06); font-weight: 700; }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">WorkKnowlage Share</div>
      <h1>${title}</h1>
      <div class="meta">
        ${badge ? `<span class="pill">#${badge}</span>` : ''}
        ${updatedAt ? `<span>${updatedAt}</span>` : ''}
        <span>${escapeHtml(shareState)}</span>
      </div>
    </section>
    <section class="layout">
      <article class="content">
        ${bodyHtml || '<p>暂无内容</p>'}
      </article>
      <aside class="sidebar">
        <div class="sidebar-title">Contents</div>
        ${tocHtml || '<div class="share-toc-item">没有标题可显示</div>'}
      </aside>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  buildShareHtml,
  escapeHtml,
  normalizeBlocks,
  renderBlockSequence,
  resolveAssetUrl,
};
