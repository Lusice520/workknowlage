import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LevelSuffix,
  Paragraph,
  Packer,
  LineRuleType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { parseBlocks, extractInlineText } from './exportUtils';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_FONT_FAMILY = {
  ascii: 'Aptos',
  hAnsi: 'Aptos',
  eastAsia: 'PingFang SC',
  cs: 'Aptos',
};

const DOCX_COLORS = {
  text: '1F2937',
  heading: '0F172A',
  muted: '667085',
  border: 'D7DEE8',
  tableHeader: 'F4F7FB',
  alertBorder: '60A5FA',
  alertBackground: 'F5F9FF',
  hyperlink: '2563EB',
};

const ORDERED_LIST_REFERENCE = 'wk-ordered-list';
const BULLET_LIST_REFERENCE = 'wk-bullet-list';
const CHECKLIST_UNCHECKED_REFERENCE = 'wk-checklist-unchecked';
const CHECKLIST_CHECKED_REFERENCE = 'wk-checklist-checked';
const MAX_LIST_LEVEL = 5;
const LIST_INDENT_STEP = 720;
const LIST_HANGING = 360;
const ORDERED_LIST_FORMATS = [
  LevelFormat.DECIMAL,
  LevelFormat.LOWER_LETTER,
  LevelFormat.LOWER_ROMAN,
  LevelFormat.DECIMAL,
  LevelFormat.LOWER_LETTER,
  LevelFormat.LOWER_ROMAN,
];
const BULLET_LIST_MARKERS = ['•', '◦', '▪', '•', '◦', '▪'];

const SUPPORTED_IMAGE_TYPES = new Set(['png', 'jpg', 'gif', 'bmp']);

const withAutoLineSpacing = ({ before = 0, after = 120, line = 360 } = {}) => ({
  before,
  after,
  line,
  lineRule: LineRuleType.AUTO,
});

const buildHeadingSpacing = (level: number) => {
  if (level <= 1) return withAutoLineSpacing({ before: 120, after: 180, line: 320 });
  if (level === 2) return withAutoLineSpacing({ before: 260, after: 120, line: 300 });
  if (level === 3) return withAutoLineSpacing({ before: 220, after: 100, line: 300 });
  return withAutoLineSpacing({ before: 180, after: 80, line: 280 });
};

const resolveAlertIcon = (type: unknown): string => {
  switch (String(type || 'warning')) {
    case 'error':
      return '✖';
    case 'success':
      return '✓';
    case 'info':
      return 'ℹ';
    default:
      return '⚠';
  }
};

const resolveDocxAlignment = (
  value: unknown,
  options: { allowJustify?: boolean; fallback?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) => {
  const normalized = String(value || '').trim();

  if (normalized === 'center') {
    return AlignmentType.CENTER;
  }

  if (normalized === 'right') {
    return AlignmentType.RIGHT;
  }

  if (options.allowJustify && normalized === 'justify') {
    return AlignmentType.JUSTIFIED;
  }

  return options.fallback;
};

type DocxListState = {
  nextOrderedInstance: number;
  nextBulletInstance: number;
  nextChecklistUncheckedInstance: number;
  nextChecklistCheckedInstance: number;
};

const createDocxListState = (): DocxListState => ({
  nextOrderedInstance: 0,
  nextBulletInstance: 0,
  nextChecklistUncheckedInstance: 0,
  nextChecklistCheckedInstance: 0,
});

const clampListLevel = (level: number) => Math.min(MAX_LIST_LEVEL, Math.max(0, level));

const createListLevelStyle = (level: number) => ({
  run: {
    font: DOCX_FONT_FAMILY,
    size: 22,
    color: DOCX_COLORS.text,
  },
  paragraph: {
    indent: {
      left: LIST_INDENT_STEP * (level + 1),
      hanging: LIST_HANGING,
    },
    spacing: withAutoLineSpacing({ after: 80, line: 340 }),
  },
});

const createListLevelConfig = (
  reference: string,
  getLevelOptions: (level: number) => Record<string, unknown>,
) => ({
  reference,
  levels: Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, rawLevel) => {
    const level = clampListLevel(rawLevel);
    return {
      level,
      alignment: AlignmentType.LEFT,
      suffix: LevelSuffix.SPACE,
      style: createListLevelStyle(level),
      ...getLevelOptions(level),
    };
  }),
});

const DOCX_NUMBERING_CONFIG = [
  createListLevelConfig(ORDERED_LIST_REFERENCE, (level) => ({
    format: ORDERED_LIST_FORMATS[level] || LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
  })),
  createListLevelConfig(BULLET_LIST_REFERENCE, (level) => ({
    format: LevelFormat.BULLET,
    text: BULLET_LIST_MARKERS[level] || BULLET_LIST_MARKERS[0],
  })),
  createListLevelConfig(CHECKLIST_UNCHECKED_REFERENCE, () => ({
    format: LevelFormat.BULLET,
    text: '☐',
  })),
  createListLevelConfig(CHECKLIST_CHECKED_REFERENCE, () => ({
    format: LevelFormat.BULLET,
    text: '☑',
  })),
];

const isListBlockType = (type: string) =>
  type === 'checkListItem' || type === 'bulletListItem' || type === 'numberedListItem';

const getListReferenceForBlock = (block: any) => {
  const type = String(block?.type || '');
  if (type === 'numberedListItem') {
    return ORDERED_LIST_REFERENCE;
  }
  if (type === 'bulletListItem') {
    return BULLET_LIST_REFERENCE;
  }
  return block?.props?.checked ? CHECKLIST_CHECKED_REFERENCE : CHECKLIST_UNCHECKED_REFERENCE;
};

const allocateListInstance = (reference: string, state: DocxListState) => {
  if (reference === ORDERED_LIST_REFERENCE) {
    const next = state.nextOrderedInstance;
    state.nextOrderedInstance += 1;
    return next;
  }

  if (reference === BULLET_LIST_REFERENCE) {
    const next = state.nextBulletInstance;
    state.nextBulletInstance += 1;
    return next;
  }

  if (reference === CHECKLIST_CHECKED_REFERENCE) {
    const next = state.nextChecklistCheckedInstance;
    state.nextChecklistCheckedInstance += 1;
    return next;
  }

  const next = state.nextChecklistUncheckedInstance;
  state.nextChecklistUncheckedInstance += 1;
  return next;
};

const normalizeExportAssetUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:image/')) {
    return raw;
  }

  if (raw.startsWith('/uploads/')) {
    return raw;
  }

  return '';
};

const getSupportedImageType = (url: string): 'png' | 'jpg' | 'gif' | 'bmp' | null => {
  const value = String(url || '').trim().split('?')[0].split('#')[0];
  const match = value.match(/\.([a-z0-9]+)$/i);
  if (!match) {
    return null;
  }
  const ext = match[1].toLowerCase();
  if (ext === 'jpeg') {
    return 'jpg';
  }
  return SUPPORTED_IMAGE_TYPES.has(ext) ? (ext as 'png' | 'jpg' | 'gif' | 'bmp') : null;
};

const fetchBinary = async (src: unknown, resourceBaseUrl: string) => {
  const rawSrc = String(src || '').trim();
  if (!rawSrc) {
    return new Uint8Array();
  }

  const resolvedUrl = rawSrc.startsWith('http://') || rawSrc.startsWith('https://')
    ? rawSrc
    : rawSrc.startsWith('/')
      ? `${String(resourceBaseUrl || '').replace(/\/$/, '')}${rawSrc}`
      : rawSrc;

  const res = await fetch(resolvedUrl);
  if (!res.ok) {
    throw new Error(`Failed to load image: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
};

const textRunFromInlineNode = (node: any, extra: Record<string, unknown> = {}) => {
  if (!node) {
    return null;
  }

  if (typeof node === 'string') {
    return new TextRun({ text: node, ...extra });
  }

  if (node.type === 'text') {
    const styles = node.styles || {};
    return new TextRun({
      text: String(node.text || ''),
      bold: Boolean(styles.bold),
      italics: Boolean(styles.italic),
      underline: styles.underline ? {} : undefined,
      strike: Boolean(styles.strike),
      color: styles.textColor ? String(styles.textColor).replace('#', '') : (extra.color as string | undefined),
      ...extra,
    });
  }

  if (node.type === 'docMention') {
    const title = String(node?.props?.title || '').trim() || '未命名文档';
    return new TextRun({
      text: `@${title}`,
      bold: true,
      color: DOCX_COLORS.hyperlink,
      ...extra,
    });
  }

  if (node.type === 'hardBreak') {
    return new TextRun({ break: 1 });
  }

  return null;
};

const inlineChildrenFromContent = (content: unknown, extra: Record<string, unknown> = {}): any[] => {
  if (typeof content === 'string') {
    return [textRunFromInlineNode(content, extra)].filter(Boolean);
  }

  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((node) => {
    if (typeof node === 'string') {
      return [textRunFromInlineNode(node, extra)].filter(Boolean);
    }

    if (!node || typeof node !== 'object') {
      return [];
    }

    if (node.type === 'link') {
      const href = String(node?.attrs?.href || '').trim();
      const children = inlineChildrenFromContent(node.content, {
        color: DOCX_COLORS.hyperlink,
        underline: {},
      });

      if (!href) {
        return children;
      }

      return [new ExternalHyperlink({
        link: href,
        children,
      })];
    }

    const run = textRunFromInlineNode(node, extra);
    if (run) {
      return [run];
    }

    if (Array.isArray((node as any).content) || typeof (node as any).content === 'string') {
      return inlineChildrenFromContent((node as any).content, extra);
    }

    return [];
  });
};

const textParagraph = (content: unknown, opts: Record<string, unknown> = {}) =>
  new Paragraph({
    children: inlineChildrenFromContent(content),
    spacing: withAutoLineSpacing(),
    ...opts,
  });

const headingParagraph = (content: unknown, level: number, opts: Record<string, unknown> = {}) =>
  new Paragraph({
    children: inlineChildrenFromContent(content),
    heading: [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][Math.min(6, Math.max(1, level)) - 1],
    keepNext: true,
    spacing: buildHeadingSpacing(level),
    ...opts,
  });

const buildTableRowsFromRichTable = (rawData: unknown) => {
  const parsed = typeof rawData === 'string' ? (() => {
    try {
      return JSON.parse(rawData);
    } catch {
      return null;
    }
  })() : rawData;

  const tableNode = Array.isArray(parsed?.content) ? parsed.content.find((node: any) => node?.type === 'table') : null;
  const rows = Array.isArray(tableNode?.content) ? tableNode.content : [];

  return rows.map((row: any, rowIndex: number) => {
    const cells = Array.isArray(row?.content) ? row.content : [];
    return new TableRow({
      children: cells.map((cell: any) => {
        const cellText = extractInlineText(cell?.content || []);
        const isHeader = cell?.type === 'tableHeader' || rowIndex === 0;
        const backgroundColor = String(cell?.attrs?.backgroundColor || '').trim();
        const textColor = String(cell?.attrs?.textColor || '').trim().replace('#', '') || undefined;
        const textAlign = String(cell?.attrs?.textAlign || '').trim();
        const shadingColor = isHeader ? DOCX_COLORS.tableHeader : backgroundColor;
        return new TableCell({
          children: [
            new Paragraph({
              children: inlineChildrenFromContent(cellText, textColor ? { color: textColor } : {}),
              spacing: withAutoLineSpacing({ before: 0, after: 0, line: 276 }),
              alignment: resolveDocxAlignment(textAlign, { allowJustify: true }),
            }),
          ],
          ...(shadingColor ? {
            shading: {
              type: ShadingType.SOLID,
              color: shadingColor,
              fill: shadingColor,
            },
          } : {}),
          margins: {
            top: 48,
            bottom: 48,
            left: 80,
            right: 80,
            marginUnitType: WidthType.DXA,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            bottom: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            left: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            right: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
          },
        });
      }),
    });
  });
};

const createDocxDocument = (children: Array<Paragraph | Table>, title: string) =>
  new Document({
    creator: 'WorkKnowlage',
    title,
    description: title,
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 22,
            color: DOCX_COLORS.text,
          },
          paragraph: {
            spacing: withAutoLineSpacing(),
          },
        },
        heading1: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 34,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(1),
            keepNext: true,
          },
        },
        heading2: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 30,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(2),
            keepNext: true,
          },
        },
        heading3: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 26,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(3),
            keepNext: true,
          },
        },
        heading4: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 24,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(4),
            keepNext: true,
          },
        },
        heading5: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 22,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(5),
            keepNext: true,
          },
        },
        heading6: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 21,
            bold: true,
            color: DOCX_COLORS.heading,
          },
          paragraph: {
            spacing: buildHeadingSpacing(6),
            keepNext: true,
          },
        },
        listParagraph: {
          run: {
            font: DOCX_FONT_FAMILY,
            size: 22,
            color: DOCX_COLORS.text,
          },
          paragraph: {
            spacing: withAutoLineSpacing({ after: 80, line: 340 }),
          },
        },
        hyperlink: {
          run: {
            color: DOCX_COLORS.hyperlink,
            underline: {},
          },
        },
      },
    },
    numbering: {
      config: DOCX_NUMBERING_CONFIG,
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              bottom: 1080,
              left: 1040,
              right: 1040,
              header: 520,
              footer: 520,
              gutter: 0,
            },
          },
        },
        children: children.length > 0 ? children : [textParagraph('')],
      },
    ],
  });

const buildDocxChildrenFromBlocks = async (
  blocks: unknown,
  resourceBaseUrl: string,
  listState: DocxListState = createDocxListState(),
  listLevel = 0,
): Promise<Array<Paragraph | Table>> => {
  const list = Array.isArray(blocks) ? blocks : parseBlocks(blocks);
  const output: Array<Paragraph | Table> = [];
  let currentListReference: string | null = null;
  let currentListInstance: number | null = null;

  for (const block of list as any[]) {
    const type = block?.type || 'paragraph';

    if (type === 'heading') {
      currentListReference = null;
      currentListInstance = null;
      const level = Math.min(6, Math.max(1, Number(block?.props?.level) || 1));
      output.push(headingParagraph(block?.content, level, {
        alignment: resolveDocxAlignment(block?.props?.textAlignment, { allowJustify: true }),
      }));
    } else if (type === 'paragraph') {
      currentListReference = null;
      currentListInstance = null;
      output.push(textParagraph(block?.content, {
        alignment: resolveDocxAlignment(block?.props?.textAlignment, { allowJustify: true }),
      }));
    } else if (type === 'alert') {
      currentListReference = null;
      currentListInstance = null;
      output.push(new Paragraph({
        children: [
          new TextRun({
            text: `${resolveAlertIcon(block?.props?.type)} `,
            bold: true,
            color: DOCX_COLORS.heading,
          }),
          ...inlineChildrenFromContent(block?.content, { bold: true }),
        ],
        border: {
          left: {
            style: BorderStyle.SINGLE,
            color: DOCX_COLORS.alertBorder,
            size: 12,
            space: 12,
          },
        },
        shading: {
          type: ShadingType.SOLID,
          color: DOCX_COLORS.alertBackground,
          fill: DOCX_COLORS.alertBackground,
        },
        spacing: withAutoLineSpacing({ before: 60, after: 100, line: 320 }),
        indent: { left: 320 },
      }));
    } else if (type === 'kbAttachment') {
      currentListReference = null;
      currentListInstance = null;
      const url = String(block?.props?.url || '').trim();
      const name = String(block?.props?.name || '附件').trim();
      if (block?.props?.isImage && url) {
        const imageType = getSupportedImageType(url);
        if (imageType) {
          const data = await fetchBinary(url, resourceBaseUrl).catch(() => new Uint8Array());
          if (data.byteLength > 0) {
            output.push(new Paragraph({
              children: [
                new ImageRun({
                  data,
                  transformation: { width: 520, height: 320 },
                  type: imageType,
                }),
              ],
              spacing: withAutoLineSpacing({ before: 40, after: 80, line: 240 }),
              alignment: AlignmentType.CENTER,
            }));
            if (name) {
              output.push(new Paragraph({
                children: [new TextRun({ text: name, italics: true, color: DOCX_COLORS.muted })],
                spacing: withAutoLineSpacing({ before: 0, after: 180, line: 300 }),
                alignment: AlignmentType.CENTER,
              }));
            }
            continue;
          }
        }
      }

      if (url) {
        output.push(new Paragraph({
          children: [
            new ExternalHyperlink({
              link: url,
              children: [
                new TextRun({
                  text: name || url,
                  color: DOCX_COLORS.hyperlink,
                  underline: {},
                }),
              ],
            }),
          ],
          spacing: withAutoLineSpacing({ before: 40, after: 140, line: 300 }),
          alignment: resolveDocxAlignment(block?.props?.textAlignment, { fallback: AlignmentType.LEFT }),
        }));
      } else {
        output.push(textParagraph(name));
      }
    } else if (type === 'image') {
      currentListReference = null;
      currentListInstance = null;
      const url = normalizeExportAssetUrl(block?.props?.url);
      const caption = String(block?.props?.caption || '').trim();
      if (url) {
        const imageType = getSupportedImageType(url);
        if (imageType) {
          const data = await fetchBinary(url, resourceBaseUrl).catch(() => new Uint8Array());
          if (data.byteLength > 0) {
            output.push(new Paragraph({
              children: [
                new ImageRun({
                  data,
                  transformation: { width: 520, height: 320 },
                  type: imageType,
                }),
              ],
              spacing: withAutoLineSpacing({ before: 40, after: 80, line: 240 }),
              alignment: AlignmentType.CENTER,
            }));
            if (caption) {
              output.push(new Paragraph({
                children: [new TextRun({ text: caption, italics: true, color: DOCX_COLORS.muted })],
                spacing: withAutoLineSpacing({ before: 0, after: 180, line: 300 }),
                alignment: AlignmentType.CENTER,
              }));
            }
          }
        }
      }
    } else if (type === 'richTable') {
      currentListReference = null;
      currentListInstance = null;
      const rows = buildTableRowsFromRichTable(block?.props?.data);
      if (rows.length > 0) {
        output.push(new Table({
          rows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          layout: TableLayoutType.FIXED,
          margins: {
            top: 72,
            bottom: 72,
            left: 72,
            right: 72,
            marginUnitType: WidthType.DXA,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            bottom: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            left: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            right: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            insideHorizontal: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
            insideVertical: { style: BorderStyle.SINGLE, color: DOCX_COLORS.border, size: 4 },
          },
        }));
      }
    } else if (isListBlockType(type)) {
      const reference = getListReferenceForBlock(block);
      if (currentListReference !== reference || currentListInstance === null) {
        currentListReference = reference;
        currentListInstance = allocateListInstance(reference, listState);
      }
      output.push(new Paragraph({
        children: inlineChildrenFromContent(block?.content),
        numbering: {
          reference,
          level: clampListLevel(listLevel),
          instance: currentListInstance,
        },
        spacing: withAutoLineSpacing({ after: 80, line: 340 }),
        style: 'listParagraph',
      }));
    } else if (type === 'divider') {
      currentListReference = null;
      currentListInstance = null;
      output.push(new Paragraph({
        children: [new TextRun({ text: '―', color: DOCX_COLORS.border })],
        alignment: AlignmentType.CENTER,
        spacing: withAutoLineSpacing({ before: 100, after: 100, line: 240 }),
      }));
    } else if (type === 'codeBlock') {
      currentListReference = null;
      currentListInstance = null;
      output.push(new Paragraph({
        children: [new TextRun({
          text: typeof block?.content === 'string' ? block.content : extractInlineText(block?.content),
          font: 'Consolas',
          color: DOCX_COLORS.heading,
        })],
        spacing: withAutoLineSpacing({ before: 60, after: 100, line: 300 }),
      }));
    } else {
      currentListReference = null;
      currentListInstance = null;
      output.push(textParagraph(block?.content));
    }

    if (Array.isArray(block?.children) && block.children.length > 0) {
      output.push(...await buildDocxChildrenFromBlocks(
        block.children,
        resourceBaseUrl,
        listState,
        isListBlockType(type) ? listLevel + 1 : listLevel,
      ));
    }
  }

  return output;
};

export const buildDocxBlobFromBlocks = async (
  blocks: unknown,
  { title = '文档', resourceBaseUrl = '' } = {},
) => {
  const children = await buildDocxChildrenFromBlocks(blocks, resourceBaseUrl);
  const doc = createDocxDocument(children, title);

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Blob([arrayBuffer], { type: DOCX_MIME_TYPE });
};

export const buildDocxBytesFromBlocks = async (
  blocks: unknown,
  { title = '文档', resourceBaseUrl = '' } = {},
) => {
  const children = await buildDocxChildrenFromBlocks(blocks, resourceBaseUrl);
  const doc = createDocxDocument(children, title);

  return new Uint8Array(await Packer.toArrayBuffer(doc));
};

export const downloadBlobFile = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
