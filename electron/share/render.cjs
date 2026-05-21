function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeInlineText(value = '') {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br />');
}

function sanitizeCssValue(value) {
  return String(value || '').replace(/[<>"`]/g, '').trim();
}

function sanitizeOptionalThemeValue(value) {
  const normalized = sanitizeCssValue(value);
  if (!normalized || normalized === 'default') {
    return '';
  }

  return normalized;
}

const SHARE_TEXT_COLOR_TOKENS = {
  gray: '#9b9a97',
  brown: '#64473a',
  red: '#e03e3e',
  orange: '#d9730d',
  yellow: '#dfab01',
  green: '#2f7a5f',
  blue: '#2f6fdd',
  purple: '#6940a5',
  pink: '#ad1a72',
};

const SHARE_BACKGROUND_COLOR_TOKENS = {
  gray: '#ebeced',
  brown: '#e9e5e3',
  red: '#fbe4e4',
  orange: '#f6e9d9',
  yellow: '#fbf3db',
  green: '#ddedea',
  blue: '#ddebf1',
  purple: '#eae4f2',
  pink: '#f4dfeb',
};

function sanitizeCssColorValue(value) {
  const normalized = sanitizeOptionalThemeValue(value);
  if (!normalized) {
    return '';
  }

  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized)) {
    return normalized;
  }

  if (/^(?:rgb|rgba|hsl|hsla)\([0-9\s.,%/+-]+\)$/i.test(normalized)) {
    return normalized;
  }

  return '';
}

function resolveShareColor(value, tokenMap) {
  const normalized = sanitizeOptionalThemeValue(value);
  if (!normalized) {
    return '';
  }

  const token = normalized.toLowerCase();
  return tokenMap[token] || sanitizeCssColorValue(normalized);
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

function normalizeSpreadsheetSheets(workbookJson) {
  const workbook = parseJsonMaybe(workbookJson, {});
  const sheets = workbook && typeof workbook === 'object' && workbook.sheets && typeof workbook.sheets === 'object'
    ? workbook.sheets
    : {};
  const orderedIds = Array.isArray(workbook?.sheetOrder)
    ? workbook.sheetOrder.filter((id) => typeof id === 'string' && sheets[id])
    : [];
  const sheetIds = orderedIds.length > 0 ? orderedIds : Object.keys(sheets);

  return sheetIds
    .map((id, index) => {
      const sheet = sheets[id];
      if (!sheet || typeof sheet !== 'object') {
        return null;
      }

      return {
        id,
        name: String(sheet.name || `Sheet${index + 1}`),
        cellData: sheet.cellData && typeof sheet.cellData === 'object' ? sheet.cellData : {},
      };
    })
    .filter(Boolean);
}

function getSpreadsheetCellValue(cell) {
  if (!cell || typeof cell !== 'object') {
    return '';
  }
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v);
  }
  if (cell.p !== undefined && cell.p !== null) {
    return String(cell.p);
  }
  return '';
}

function renderSpreadsheetShareTable(workbookJson) {
  const sheets = normalizeSpreadsheetSheets(workbookJson);
  if (sheets.length === 0) {
    return '<p class="share-spreadsheet-empty">这个表格暂时没有可分享的内容。</p>';
  }

  return sheets.map((sheet) => {
    const rows = Object.keys(sheet.cellData)
      .map((key) => Number(key))
      .filter((index) => Number.isInteger(index) && index >= 0)
      .sort((left, right) => left - right);
    const maxColumnIndex = rows.reduce((max, rowIndex) => {
      const row = sheet.cellData[String(rowIndex)];
      if (!row || typeof row !== 'object') {
        return max;
      }

      return Math.max(
        max,
        ...Object.keys(row).map((key) => Number(key)).filter((index) => Number.isInteger(index) && index >= 0),
      );
    }, 0);
    const renderedRows = (rows.length > 0 ? rows : [0]).map((rowIndex) => {
      const row = sheet.cellData[String(rowIndex)] || {};
      const cells = Array.from({ length: Math.max(1, maxColumnIndex + 1) }, (_, columnIndex) => {
        const value = getSpreadsheetCellValue(row[String(columnIndex)]);
        return `<td>${value ? escapeInlineText(value) : '&nbsp;'}</td>`;
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <section class="share-spreadsheet-sheet">
        <h2>${escapeHtml(sheet.name)}</h2>
        <div class="share-spreadsheet-wrap">
          <table class="share-spreadsheet-table"><tbody>${renderedRows}</tbody></table>
        </div>
      </section>`;
  }).join('');
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

function applyInlineStyles(html, styles = {}) {
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

  const textColor = resolveShareColor(styles.textColor, SHARE_TEXT_COLOR_TOKENS);
  if (textColor) {
    html = `<span style="color:${escapeHtml(textColor)}">${html}</span>`;
  }

  const backgroundColor = resolveShareColor(styles.backgroundColor, SHARE_BACKGROUND_COLOR_TOKENS);
  if (backgroundColor) {
    html = `<span style="background-color:${escapeHtml(backgroundColor)}">${html}</span>`;
  }

  return html;
}

function renderInlineMarks(rawText, marks, origin, styles = {}) {
  let html = escapeInlineText(rawText || '');
  html = applyInlineStyles(html, styles || {});
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
    if (type === 'rtTextColor' || type === 'textColor') {
      const color = resolveShareColor(mark?.attrs?.color || mark?.attrs?.textColor || mark?.color, SHARE_TEXT_COLOR_TOKENS);
      html = color ? `<span style="color:${escapeHtml(color)}">${html}</span>` : html;
      continue;
    }
    if (type === 'rtTextBackground' || type === 'backgroundColor') {
      const color = resolveShareColor(mark?.attrs?.color || mark?.attrs?.backgroundColor || mark?.color, SHARE_BACKGROUND_COLOR_TOKENS);
      html = color ? `<span style="background-color:${escapeHtml(color)}">${html}</span>` : html;
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
    return escapeInlineText(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => renderInlineNode(item, origin)).join('');
  }

  if (typeof node !== 'object') {
    return '';
  }

  const type = String(node.type || '');
  if (type === 'text') {
    return renderInlineMarks(node.text || '', node.marks, origin, node.styles || {});
  }

  if (type === 'docMention') {
    const title = String(node?.props?.title || node?.title || '').trim() || '未命名文档';
    return `<span class="kb-doc-mention">@${escapeHtml(title)}</span>`;
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

function extractCodeBlockText(content) {
  if (content == null) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => extractCodeBlockText(item)).join('');
  }

  if (typeof content !== 'object') {
    return '';
  }

  const type = String(content.type || '');
  if (type === 'text') {
    return String(content.text || '');
  }

  if (type === 'hardBreak') {
    return '\n';
  }

  return extractCodeBlockText(content.content || '');
}

function renderCodeBlock(block) {
  const codeText = extractCodeBlockText(block?.content);
  const code = escapeHtml(codeText);
  const language = sanitizeCssValue(block?.props?.language || 'text') || 'text';

  if (language.toLowerCase() === 'mermaid') {
    return `
      <figure class="share-mermaid" data-language="mermaid">
        <pre class="share-mermaid-source"><code class="language-mermaid" data-language="mermaid">${code}</code></pre>
      </figure>
    `;
  }

  return `<pre class="share-code-block"><code class="language-${escapeHtml(language)}" data-language="${escapeHtml(language)}">${code}</code></pre>`;
}

function renderCellContent(contentNodes, origin) {
  const html = (Array.isArray(contentNodes) ? contentNodes : []).map((node) => renderInlineNode(node, origin)).join('');
  return html || '<p><br /></p>';
}

function renderShareTableRows(rows, origin, options = {}) {
  const headerRows = Math.max(0, Number(options.headerRows) || 0);
  const headerCols = Math.max(0, Number(options.headerCols) || 0);
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  return rows.map((row, rowIndex) => {
    const cells = Array.isArray(row?.cells) ? row.cells : Array.isArray(row?.content) ? row.content : [];
    const cellHtml = cells.map((rawCell, colIndex) => {
      const isStructuredCell = rawCell && typeof rawCell === 'object' && rawCell.type === 'tableCell';
      const cellProps = isStructuredCell ? (rawCell.props || {}) : {};
      const contentNodes = isStructuredCell
        ? (Array.isArray(rawCell.content) ? rawCell.content : [])
        : (Array.isArray(rawCell) ? rawCell : [rawCell].filter(Boolean));
      const shouldUseHeader = rowIndex < headerRows || colIndex < headerCols;
      const tag = shouldUseHeader ? 'th' : 'td';
      const attrParts = [];

      const colspan = Number(cellProps.colspan) || 1;
      const rowspan = Number(cellProps.rowspan) || 1;
      if (colspan > 1) {
        attrParts.push(`colspan="${colspan}"`);
      }
      if (rowspan > 1) {
        attrParts.push(`rowspan="${rowspan}"`);
      }

      const styleParts = [];
      const bg = sanitizeOptionalThemeValue(cellProps.backgroundColor);
      const color = sanitizeOptionalThemeValue(cellProps.textColor);
      const align = sanitizeCssValue(cellProps.textAlignment || cellProps.textAlign);
      if (bg) styleParts.push(`background-color:${bg}`);
      if (color) styleParts.push(`color:${color}`);
      if (align) styleParts.push(`text-align:${align}`);
      if (styleParts.length > 0) {
        attrParts.push(`style="${escapeHtml(styleParts.join(';'))}"`);
      }

      const innerHtml = renderCellContent(contentNodes, origin);
      const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
      return `<${tag}${attrText}>${innerHtml}</${tag}>`;
    }).join('');

    return `<tr>${cellHtml}</tr>`;
  }).join('');
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

  const normalizedRows = rows.map((row) => ({
    cells: (Array.isArray(row?.content) ? row.content : []).map((cell) => ({
      type: 'tableCell',
      props: {
        colspan: cell?.attrs?.colspan,
        rowspan: cell?.attrs?.rowspan,
        backgroundColor: cell?.attrs?.backgroundColor,
        textColor: cell?.attrs?.textColor,
        textAlignment: cell?.attrs?.textAlign,
      },
      content: Array.isArray(cell?.content) ? cell.content : [],
      _tag: cell?.type === 'tableHeader' ? 'th' : 'td',
    })),
  }));
  const rowHtml = normalizedRows.map((row) => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return `<tr>${cells.map((cell) => {
      const tag = cell?._tag === 'th' ? 'th' : 'td';
      const cellProps = cell?.props || {};
      const attrParts = [];
      const colspan = Number(cellProps.colspan) || 1;
      const rowspan = Number(cellProps.rowspan) || 1;
      if (colspan > 1) attrParts.push(`colspan="${colspan}"`);
      if (rowspan > 1) attrParts.push(`rowspan="${rowspan}"`);
      const styleParts = [];
      const bg = sanitizeOptionalThemeValue(cellProps.backgroundColor);
      const color = sanitizeOptionalThemeValue(cellProps.textColor);
      const align = sanitizeCssValue(cellProps.textAlignment);
      if (bg) styleParts.push(`background-color:${bg}`);
      if (color) styleParts.push(`color:${color}`);
      if (align) styleParts.push(`text-align:${align}`);
      if (styleParts.length > 0) {
        attrParts.push(`style="${escapeHtml(styleParts.join(';'))}"`);
      }
      const attrText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
      return `<${tag}${attrText}>${renderCellContent(cell?.content || [], origin)}</${tag}>`;
    }).join('')}</tr>`;
  }).join('');

  return `<div class="share-table-wrap"><table class="share-table"><tbody>${rowHtml}</tbody></table></div>`;
}

function renderNativeTableHtml(tableContent, origin) {
  if (!tableContent || tableContent.type !== 'tableContent') {
    return '';
  }

  const rows = Array.isArray(tableContent.rows) ? tableContent.rows : [];
  const rowHtml = renderShareTableRows(rows, origin, {
    headerRows: tableContent.headerRows,
    headerCols: tableContent.headerCols,
  });
  if (!rowHtml) {
    return '';
  }

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

function renderImageBlock(block, origin) {
  const props = block?.props || {};
  const url = resolveAssetUrl(props.url || '', origin);
  if (!url) {
    return '';
  }

  const caption = String(props.caption || '').trim();
  const name = String(props.name || '').trim();
  const alt = caption || name || '图片';
  const captionHtml = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';

  return `
    <figure class="share-image">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" />
      ${captionHtml}
    </figure>
  `;
}

function renderShareAlertIcon(type, label) {
  const icons = {
    warning: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  };
  const paths = icons[type] || icons.warning;

  return `<svg class="share-alert-icon" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function renderAlertBlock(block, origin) {
  const type = String(block?.props?.type || 'warning');
  const alertMeta = {
    warning: { label: '警告' },
    error: { label: '错误' },
    info: { label: '提示' },
    success: { label: '成功' },
  }[type] || { label: '警告' };
  const children = Array.isArray(block?.children) ? renderBlockSequence(block.children, origin) : '';
  const content = renderInlineNode(block?.content || [], origin);
  return `
    <div class="share-alert share-alert-${escapeHtml(type)}">
      ${renderShareAlertIcon(type, alertMeta.label)}
      <div class="share-alert-body">
        ${content ? `<div class="share-alert-content">${content}</div>` : ''}
        ${children}
      </div>
    </div>
  `;
}

function renderBlockChildren(block, origin) {
  const children = Array.isArray(block?.children) ? renderBlockSequence(block.children, origin) : '';
  return children ? `<div class="share-block-children">${children}</div>` : '';
}

function renderLegacySection(section, origin) {
  if (!section || typeof section !== 'object') {
    return '';
  }

  if (section.type === 'heading') {
    return `<h2>${escapeHtml(section.title || '')}</h2>`;
  }

  if (section.type === 'paragraph') {
    return `<p>${escapeInlineText(section.content || '')}</p>`;
  }

  if (section.type === 'quote') {
    return `
      <blockquote>
        <p>${escapeInlineText(section.content || '')}</p>
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

  if (type === 'image') {
    return renderImageBlock(block, origin);
  }

  if (type === 'richTable') {
    return renderRichTableHtml(block?.props?.data || '', origin);
  }

  if (type === 'codeBlock') {
    return renderCodeBlock(block);
  }

  if (type === 'table') {
    return renderNativeTableHtml(block?.content, origin);
  }

  if (type === 'divider') {
    return '<hr class="share-divider" />';
  }

  if (type === 'toggleListItem') {
    const children = Array.isArray(block.children) ? renderBlockSequence(block.children, origin) : '';
    return `
      <details class="share-toggle" open>
        <summary>${renderInlineNode(block.content || [], origin) || '<br />'}</summary>
        ${children ? `<div class="share-toggle-content">${children}</div>` : ''}
      </details>
    `;
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
    const children = renderBlockChildren(block, origin);
    const className = children ? 'share-list-item share-list-item-with-children' : 'share-list-item';
    return `
      <li class="${className}">
        ${renderInlineNode(block.content || [], origin) || '<br />'}
        ${children}
      </li>
    `;
  }

  if (type === 'checkListItem') {
    const children = renderBlockChildren(block, origin);
    const className = children ? 'share-check-list-item share-list-item-with-children' : 'share-check-list-item';
    const checked = block?.props?.checked ? ' checked' : '';
    return `
      <li class="${className}">
        <label><input type="checkbox"${checked} disabled /> <span>${renderInlineNode(block.content || [], origin) || '<br />'}</span></label>
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

    if (type === 'bulletListItem' || type === 'numberedListItem' || type === 'checkListItem') {
      const ordered = type === 'numberedListItem';
      const listTag = ordered ? 'ol' : 'ul';
      const className = type === 'checkListItem' ? ' class="share-check-list"' : '';
      const listItems = [];

      while (index < items.length && String(items[index]?.type || '') === type) {
        listItems.push(renderBlock(items[index], origin));
        index += 1;
      }

      html += `<${listTag}${className}>${listItems.join('')}</${listTag}>`;
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

function buildShareHtml({ document, share, origin, spreadsheetWorkbookJson = '' }) {
  const isSpreadsheet = document?.kind === 'spreadsheet';
  const blocks = isSpreadsheet ? [] : normalizeBlocks(document);
  const bodyHtml = isSpreadsheet
    ? renderSpreadsheetShareTable(spreadsheetWorkbookJson)
    : renderBlockSequence(blocks, origin);
  const headings = isSpreadsheet ? [] : extractHeadings(blocks);
  const title = escapeHtml(document?.title || 'WorkKnowlage');
  const badge = escapeHtml(isSpreadsheet ? '表格' : document?.badgeLabel || '');
  const updatedAt = escapeHtml(document?.updatedAtLabel || '');
  const shareState = share?.enabled ? '已开启只读分享' : '分享已关闭';
  const tocHtml = headings.length > 0
    ? `<nav class="share-toc">${headings.map((heading) => `<div class="share-toc-item share-toc-level-${heading.level}">${escapeHtml(heading.title)}</div>`).join('')}</nav>`
    : '';
  const mermaidScript = bodyHtml.includes('class="share-mermaid"') ? `
  <script type="module">
    import mermaid from '/vendor/mermaid/mermaid.esm.min.mjs';

    const diagrams = Array.from(document.querySelectorAll('.share-mermaid'));
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

    await Promise.all(diagrams.map(async (diagram, index) => {
      const source = diagram.querySelector('.share-mermaid-source')?.textContent || '';
      if (!source.trim()) return;

      try {
        const { svg } = await mermaid.render(\`wk-share-mermaid-\${index}\`, source);
        const rendered = document.createElement('div');
        rendered.className = 'share-mermaid-rendered';
        rendered.innerHTML = svg;
        diagram.prepend(rendered);
        diagram.dataset.rendered = 'true';
      } catch (error) {
        diagram.dataset.error = 'true';
        console.error('Mermaid render failed', error);
      }
    }));

    window.__wkMermaidReady = true;
  </script>` : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - WorkKnowlage</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --paper: #ffffff;
      --ink: #172033;
      --body: #2f3b4f;
      --muted: #64748b;
      --border: #e2e8f0;
      --accent: #2563eb;
      --list-marker: #2563eb;
      --share-list-marker-column: 28px;
      --share-list-content-indent: var(--share-list-marker-column);
      --share-list-marker-center: calc(var(--share-list-marker-column) / 2);
      --share-list-marker-dot-size: 6px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    .page {
      width: min(calc(100vw - 56px), 1600px);
      margin: 0 auto;
      padding: 32px 0 64px;
    }
    .hero {
      width: min(100%, 1484px);
      margin: 0 auto;
      padding: 0 0 24px;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
    }
    h1 {
      margin: 12px 0 0;
      max-width: 1180px;
      font-size: clamp(24px, 2.2vw, 32px);
      line-height: 1.32;
      letter-spacing: 0;
      font-weight: 750;
    }
    .meta {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 9px;
      border: 1px solid #dbeafe;
      background: #eff6ff;
      color: var(--accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1180px) minmax(220px, 260px);
      justify-content: center;
      gap: clamp(32px, 2.4vw, 44px);
      align-items: start;
      margin-top: 8px;
    }
    .content {
      width: 100%;
      padding: 38px clamp(40px, 3vw, 56px);
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--paper);
      box-shadow: 0 10px 28px rgba(15,23,42,0.035);
    }
    .sidebar {
      position: sticky;
      top: 24px;
      align-self: start;
      max-height: calc(100vh - 48px);
      overflow: auto;
      padding: 4px 0 4px 16px;
      border-left: 1px solid var(--border);
    }
    .sidebar-title {
      margin: 0 0 14px;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .share-toc { display: grid; gap: 1px; }
    .share-toc-item {
      border-radius: 6px;
      color: #475569;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.55;
      padding: 5px 4px;
      overflow-wrap: anywhere;
    }
    .share-toc-level-1 { color: #1e293b; font-weight: 650; }
    .share-toc-level-2 { padding-left: 12px; color: #64748b; }
    .share-toc-level-3 { padding-left: 22px; color: #64748b; }
    .share-toc-level-4,
    .share-toc-level-5,
    .share-toc-level-6 { padding-left: 30px; color: #64748b; }
    .content h2, .content h3, .content h4, .content h5, .content h6 {
      margin: 30px 0 12px;
      letter-spacing: 0;
      line-height: 1.35;
      color: #172033;
    }
    .content h2 { font-size: 22px; }
    .content h3 { font-size: 18px; }
    .content h4, .content h5, .content h6 { font-size: 16px; }
    .content p, .content blockquote, .content ul, .content ol, .content .share-gallery, .content .share-alert, .content .share-table-wrap, .content .share-code-block, .content .share-image, .content .share-divider, .content .share-toggle {
      margin: 16px 0;
    }
    .content p {
      max-width: none;
      line-height: 1.78;
      color: var(--body);
      font-size: 15px;
    }
    .content blockquote {
      border-left: 3px solid #cbd5e1;
      margin-left: 0;
      padding: 10px 16px;
      background: #f8fafc;
      border-radius: 8px;
      color: var(--body);
    }
    .content blockquote cite {
      display: block;
      margin-top: 10px;
      font-style: normal;
      font-size: 12px;
      color: var(--muted);
    }
    .content ul, .content ol {
      max-width: none;
      padding-left: 0;
      list-style: none;
      color: var(--body);
      font-size: 15px;
      line-height: 1.78;
    }
    .content ol {
      counter-reset: share-list-index;
    }
    .content li {
      margin: 6px 0;
      padding-left: 0;
    }
    .content .share-list-item {
      position: relative;
      padding-left: var(--share-list-content-indent);
    }
    .content .share-list-item::before {
      position: absolute;
      color: var(--list-marker);
      font-weight: 650;
      text-align: center;
      box-sizing: border-box;
    }
    .content ul > .share-list-item::before {
      content: "";
      top: calc((1.78em - var(--share-list-marker-dot-size)) / 2);
      left: calc(var(--share-list-marker-center) - (var(--share-list-marker-dot-size) / 2));
      width: var(--share-list-marker-dot-size);
      height: var(--share-list-marker-dot-size);
      border-radius: 999px;
      background: var(--list-marker);
    }
    .content .share-block-children ul > .share-list-item::before {
      content: "";
      top: calc((1.78em - var(--share-list-marker-dot-size)) / 2);
      left: calc(var(--share-list-marker-center) - (var(--share-list-marker-dot-size) / 2));
      width: var(--share-list-marker-dot-size);
      height: var(--share-list-marker-dot-size);
      border-radius: 999px;
      border: 1px solid var(--list-marker);
      background: transparent;
    }
    .content .share-block-children .share-block-children ul > .share-list-item::before {
      content: "";
      top: calc((1.78em - var(--share-list-marker-dot-size)) / 2);
      left: calc(var(--share-list-marker-center) - (var(--share-list-marker-dot-size) / 2));
      width: var(--share-list-marker-dot-size);
      height: var(--share-list-marker-dot-size);
      border-radius: 1px;
      border: 0;
      background: var(--list-marker);
    }
    .content ol > .share-list-item {
      counter-increment: share-list-index;
    }
    .content ol > .share-list-item::before {
      content: counter(share-list-index) ".";
      top: 0;
      left: 0;
      width: var(--share-list-marker-column);
      line-height: 1.78;
      font-size: 15px;
    }
    .content .share-list-item > .share-block-children {
      position: relative;
      margin-left: calc(var(--share-list-content-indent) * -1);
      margin-top: 8px;
      padding-left: var(--share-list-content-indent);
    }
    .content .share-list-item > .share-block-children::before {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--share-list-marker-center);
      border-left: 1px solid #cbd5e1;
    }
    .content .share-block-children > :first-child { margin-top: 0; }
    .content .share-block-children > :last-child { margin-bottom: 0; }
    .content .share-block-children > ul,
    .content .share-block-children > ol {
      margin-top: 6px;
      margin-bottom: 6px;
      margin-left: 3px;
    }
    .content strong { font-weight: 700; color: #172033; }
    .content em { font-style: italic; }
    .content u { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.14em; }
    .content s { text-decoration: line-through; color: #64748b; }
    .content a {
      color: var(--accent);
      font-weight: 600;
      text-decoration: none;
      border-bottom: 1px solid rgba(37, 99, 235, 0.24);
    }
    .content a:hover {
      border-bottom-color: rgba(37, 99, 235, 0.56);
    }
    .content code:not(.share-code-block code) {
      border-radius: 6px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: rgba(241, 245, 249, 0.92);
      color: #1d4ed8;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.92em;
      padding: 0.08em 0.38em;
    }
    .share-code-block {
      overflow-x: auto;
      max-width: none;
      padding: 18px 20px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f3f4f6;
      color: #111827;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      line-height: 1.65;
      tab-size: 2;
      white-space: pre;
    }
    .share-code-block code {
      font: inherit;
      color: inherit;
      background: transparent;
    }
    .share-mermaid {
      max-width: none;
      overflow-x: auto;
      padding: 18px 20px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .share-mermaid-rendered {
      display: grid;
      justify-items: center;
      min-width: max-content;
    }
    .share-mermaid-rendered svg {
      max-width: 100%;
      height: auto;
    }
    .share-mermaid-source {
      margin: 0;
      color: #111827;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      line-height: 1.65;
      white-space: pre;
    }
    .share-mermaid[data-rendered="true"] .share-mermaid-source {
      display: none;
    }
    .share-mermaid[data-error="true"] {
      background: #fff7ed;
      border-color: #fed7aa;
    }
    .share-alert {
      --share-alert-bg: #fff7df;
      --share-alert-border: #f0cf85;
      --share-alert-icon: #e69819;
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      max-width: none;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid var(--share-alert-border);
      background: var(--share-alert-bg);
      color: var(--body);
    }
    .share-alert-warning {
      --share-alert-bg: #fff7df;
      --share-alert-border: #f0cf85;
      --share-alert-icon: #e69819;
    }
    .share-alert-error {
      --share-alert-bg: #ffecec;
      --share-alert-border: #efb0b0;
      --share-alert-icon: #d80d0d;
    }
    .share-alert-info {
      --share-alert-bg: #eef1ff;
      --share-alert-border: #b8c4ff;
      --share-alert-icon: #3657ff;
    }
    .share-alert-success {
      --share-alert-bg: #ebffed;
      --share-alert-border: #98d69d;
      --share-alert-icon: #0bc10b;
    }
    .share-alert-icon {
      width: 20px;
      height: 20px;
      margin-top: 2px;
      color: var(--share-alert-icon);
    }
    .share-alert-body { min-width: 0; font-size: 14px; line-height: 1.72; }
    .share-alert-content > *:first-child { margin-top: 0; }
    .share-alert-body > *:last-child,
    .share-alert-content > *:last-child { margin-bottom: 0; }
    .share-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .share-gallery-card, .share-attachment {
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #f8fafc;
      padding: 14px;
    }
    .share-image img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #f8fafc;
    }
    .share-image figcaption {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }
    .share-check-list {
      list-style: none;
      padding-left: 0;
    }
    .share-check-list li {
      display: grid;
      gap: 6px;
      padding-left: 0;
    }
    .share-check-list label {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
    }
    .share-check-list input {
      width: 14px;
      height: 14px;
      margin: 0;
      transform: translateY(2px);
      accent-color: var(--accent);
    }
    .share-divider {
      border: 0;
      border-top: 1px solid var(--border);
    }
    .share-toggle {
      border-left: 3px solid #cbd5e1;
      padding-left: 14px;
    }
    .share-toggle summary {
      cursor: default;
      color: #172033;
      font-weight: 650;
    }
    .share-toggle-content {
      margin-top: 8px;
      padding-left: 10px;
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
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid var(--border);
    }
    .share-table th, .share-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      text-align: left;
      color: var(--body);
      font-size: 14px;
    }
    .share-table th { background: #f1f5f9; font-weight: 650; color: #172033; }
    .share-spreadsheet-sheet h2 {
      margin: 0 0 14px;
      color: #172033;
      font-size: 16px;
      letter-spacing: 0;
    }
    .share-spreadsheet-wrap {
      width: 100%;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #ffffff;
    }
    .share-spreadsheet-table {
      width: 100%;
      min-width: 720px;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .share-spreadsheet-table td {
      min-width: 120px;
      height: 34px;
      border: 1px solid #dbe3ee;
      padding: 7px 10px;
      color: #1f2937;
      font-size: 13px;
      line-height: 1.45;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .share-spreadsheet-empty {
      color: var(--muted);
    }
    .kb-doc-mention {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid rgba(37, 99, 235, 0.18);
      background: rgba(37, 99, 235, 0.08);
      padding: 0.08em 0.52em;
      color: var(--accent);
      font-weight: 650;
      white-space: nowrap;
    }
    @media (max-width: 920px) {
      .layout { grid-template-columns: 1fr; }
      .page { padding: 28px 16px 48px; }
      .hero { max-width: none; }
      .content { max-width: none; padding: 24px 20px; }
      .sidebar { position: static; max-height: none; padding: 0; border-left: none; }
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
  ${mermaidScript}
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
