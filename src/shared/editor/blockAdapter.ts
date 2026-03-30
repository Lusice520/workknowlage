import type { DocumentRecord } from '../types/workspace';
import { deriveSectionsFromContentJson, normalizeContentJson } from '../lib/documentContent';

const EMPTY_PARAGRAPH_BLOCKS = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: '', styles: {} }],
  },
];

type BlockLike = Record<string, unknown>;

const isLegacySectionLike = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.type === 'string' && !Array.isArray(record.content) && !Array.isArray(record.children);
};

const normalizeBlock = (block: BlockLike): BlockLike => ({
  ...block,
  children: Array.isArray(block.children)
    ? block.children.map((child) => normalizeBlock((child as BlockLike)))
    : [],
});

const parseBlocks = (contentJson: string | null | undefined): BlockLike[] => {
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

const textNode = (text: string) => [{ type: 'text', text, styles: {} }];

const sectionToBlocks = (section: DocumentRecord['sections'][number]): BlockLike[] => {
  if (section.type === 'heading') {
    return [{
      id: section.id,
      type: 'heading',
      props: { level: 1 },
      content: textNode(section.title ?? ''),
      children: [],
    }];
  }

  if (section.type === 'paragraph') {
    return [{
      id: section.id,
      type: 'paragraph',
      content: textNode(section.content ?? ''),
      children: [],
    }];
  }

  if (section.type === 'quote') {
    return [{
      id: section.id,
      type: 'quote',
      content: textNode(section.content ?? ''),
      children: [],
    }];
  }

  if (section.type === 'bullet-list') {
    return (section.items ?? []).map((item, index) => ({
      id: `${section.id}-item-${index}`,
      type: 'bulletListItem',
      content: textNode(item),
      children: [],
    }));
  }

  if (section.type === 'gallery') {
    return (section.items ?? []).map((item, index) => ({
      id: `${section.id}-gallery-${index}`,
      type: 'paragraph',
      content: textNode(item),
      children: [],
    }));
  }

  return [];
};

export const fromDocumentToInitialBlocks = (
  document: Pick<DocumentRecord, 'contentJson' | 'sections'> | null | undefined
): BlockLike[] => {
  const persistedBlocks = parseBlocks(document?.contentJson);
  if (persistedBlocks.length > 0 && !persistedBlocks.every((block) => isLegacySectionLike(block))) {
    return persistedBlocks.map((block) => normalizeBlock(block));
  }

  const legacySections = (document?.sections?.length ?? 0) > 0
    ? document?.sections ?? []
    : deriveSectionsFromContentJson(document?.contentJson ?? '[]');
  const legacyBlocks = legacySections.flatMap((section) => sectionToBlocks(section));
  if (legacyBlocks.length > 0) {
    return legacyBlocks;
  }

  return EMPTY_PARAGRAPH_BLOCKS;
};

export const serializeEditorDocument = (blocks: unknown): string =>
  normalizeContentJson(JSON.stringify(Array.isArray(blocks) ? blocks : EMPTY_PARAGRAPH_BLOCKS));
