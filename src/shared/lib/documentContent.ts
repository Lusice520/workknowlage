import type { DocumentSection, OutlineItem } from '../types/workspace';

const EMPTY_CONTENT_JSON = '[]';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : null;

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const stripLegacyHeadingPrefix = (title: string): string =>
  title.replace(/^\d+\.\s*/, '').trim();

const parseContentArray = (contentJson: string | null | undefined): unknown[] => {
  if (typeof contentJson !== 'string' || contentJson.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(contentJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isLegacySection = (value: unknown): value is DocumentSection => {
  const record = asRecord(value);
  if (!record || typeof record.type !== 'string') {
    return false;
  }

  return !Array.isArray(record.content) && !Array.isArray(record.children);
};

const flattenInlineText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenInlineText(item)).join('');
  }

  const record = asRecord(value);
  if (!record) {
    return '';
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    return typeof props?.title === 'string' && props.title.trim().length > 0
      ? `@${props.title.trim()}`
      : '';
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return [
    flattenInlineText(record.content),
    flattenInlineText(record.children),
  ].join('');
};

const getBlockPropsText = (value: unknown): string => {
  const record = asRecord(value);
  if (!record) {
    return '';
  }

  return [
    hasText(record.name) ? record.name : '',
    hasText(record.title) ? record.title : '',
    hasText(record.caption) ? record.caption : '',
    hasText(record.label) ? record.label : '',
  ].join('');
};

const getLegacySectionText = (section: DocumentSection): string =>
  [
    hasText(section.title) ? section.title : '',
    hasText(section.content) ? section.content : '',
    hasText(section.caption) ? section.caption : '',
    Array.isArray(section.items) ? section.items.join('') : '',
  ].join('');

const collectOutlineFromBlocks = (blocks: unknown[], outline: OutlineItem[] = []): OutlineItem[] => {
  blocks.forEach((block, index) => {
    const record = asRecord(block);
    if (!record || typeof record.type !== 'string') {
      return;
    }

    const children = Array.isArray(record.children) ? record.children : [];
    if (record.type === 'heading') {
      const props = asRecord(record.props);
      const title = flattenInlineText(record.content).trim();
      if (title.length > 0) {
        outline.push({
          id: typeof record.id === 'string' ? record.id : `outline-${outline.length + index}`,
          title,
          level: typeof props?.level === 'number' ? props.level : 1,
        });
      }
    }

    if (children.length > 0) {
      collectOutlineFromBlocks(children, outline);
    }
  });

  return outline;
};

const collectSectionsFromBlocks = (blocks: unknown[]): DocumentSection[] =>
  blocks.flatMap((block, index) => {
    const record = asRecord(block);
    if (!record || typeof record.type !== 'string') {
      return [];
    }

    const id = typeof record.id === 'string' ? record.id : `section-${index}`;
    const text = flattenInlineText(record.content).trim();
    const props = asRecord(record.props);
    const childSections = Array.isArray(record.children)
      ? collectSectionsFromBlocks(record.children)
      : [];

    if (record.type === 'heading' && text.length > 0) {
      return [{ id, type: 'heading', title: text }, ...childSections];
    }

    if (record.type === 'paragraph' && text.length > 0) {
      return [{ id, type: 'paragraph', content: text }, ...childSections];
    }

    if (record.type === 'quote' && text.length > 0) {
      return [{ id, type: 'quote', content: text }, ...childSections];
    }

    if (record.type === 'bulletListItem' && text.length > 0) {
      return [{ id, type: 'bullet-list', items: [text] }, ...childSections];
    }

    if (
      (record.type === 'image' || record.type === 'video' || record.type === 'file' || record.type === 'kbAttachment') &&
      getBlockPropsText(props).trim().length > 0
    ) {
      return [{ id, type: 'gallery', items: [getBlockPropsText(props).trim()] }, ...childSections];
    }

    return childSections;
  });

const countTextFromBlocks = (blocks: unknown[]): number =>
  blocks.reduce<number>((sum, block) => {
    const record = asRecord(block);
    if (!record) {
      return sum;
    }

    return (
      sum +
      flattenInlineText(record.content).length +
      getBlockPropsText(record.props).length +
      countTextFromBlocks(Array.isArray(record.children) ? record.children : [])
    );
  }, 0);

export const normalizeContentJson = (contentJson: string | null | undefined): string =>
  JSON.stringify(parseContentArray(contentJson));

export const serializeSectionsAsContentJson = (sections: DocumentSection[]): string =>
  JSON.stringify(sections);

export const deriveSectionsFromContentJson = (contentJson: string): DocumentSection[] => {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks;
  }

  return collectSectionsFromBlocks(blocks);
};

export const deriveOutlineFromContentJson = (contentJson: string): OutlineItem[] => {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks
      .filter((section): section is DocumentSection & { type: 'heading'; title: string } =>
        section.type === 'heading' && hasText(section.title)
      )
      .map((section, index) => ({
        id: section.id || `outline-${index}`,
        title: stripLegacyHeadingPrefix(section.title),
        level: index === 0 ? 1 : 2,
      }));
  }

  return collectOutlineFromBlocks(blocks);
};

export const deriveWordCount = (contentJson: string): number => {
  const blocks = parseContentArray(contentJson);
  if (blocks.every((block) => isLegacySection(block))) {
    return blocks.reduce((sum, section) => sum + getLegacySectionText(section).length, 0);
  }

  return countTextFromBlocks(blocks);
};

export const buildDerivedDocumentContent = (input: { contentJson?: string; sections?: DocumentSection[] }) => {
  const contentJson = input.contentJson !== undefined
    ? normalizeContentJson(input.contentJson)
    : serializeSectionsAsContentJson(input.sections ?? []);

  return {
    contentJson,
    sections: deriveSectionsFromContentJson(contentJson),
    outline: deriveOutlineFromContentJson(contentJson),
    wordCountLabel: `${deriveWordCount(contentJson)} 字`,
  };
};
