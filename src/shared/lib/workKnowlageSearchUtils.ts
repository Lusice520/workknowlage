import type { WorkspaceSearchResultRecord } from '../types/preload';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

export const SEARCH_PREVIEW_LENGTH = 72;

export const tokenizeSearchQuery = (query: string): string[] =>
  query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

export const collectSearchStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSearchStrings(item));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, nestedValue]) => {
    if (typeof nestedValue === 'string') {
      return ['text', 'title', 'content', 'caption', 'label', 'name'].includes(key)
        ? [nestedValue]
        : [];
    }

    return collectSearchStrings(nestedValue);
  });
};

export const extractSearchableText = (contentJson: string): string =>
  collectSearchStrings((() => {
    try {
      return JSON.parse(contentJson);
    } catch {
      return [];
    }
  })())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const asBlockRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const extractDirectInlineText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = asBlockRecord(item);
        if (record && typeof record.text === 'string') {
          return record.text;
        }

        return typeof item === 'string' ? item : '';
      })
      .join(' ');
  }

  const record = asBlockRecord(value);
  if (!record) {
    return '';
  }

  if (record.type === 'docMention') {
    const props = asBlockRecord(record.props);
    return typeof props?.title === 'string' && props.title.trim().length > 0
      ? `@${props.title.trim()}`
      : '';
  }

  return typeof record.text === 'string' ? record.text : '';
};

const collectDirectFieldText = (record: Record<string, unknown> | null, keys: string[]): string[] => {
  if (!record) {
    return [];
  }

  return keys.flatMap((key) => {
    const value = record[key];
    const text = extractDirectInlineText(value).replace(/\s+/g, ' ').trim();
    return text.length > 0 ? [text] : [];
  });
};

export interface SearchableBlockRecord {
  blockId: string;
  blockType: string;
  preview: string;
  searchableText: string;
}

export const extractSearchableBlocks = (contentJson: string): SearchableBlockRecord[] => {
  const parsed = (() => {
    try {
      return JSON.parse(contentJson);
    } catch {
      return [];
    }
  })();

  if (!Array.isArray(parsed)) {
    return [];
  }

  const blocks: SearchableBlockRecord[] = [];
  const visit = (items: unknown[]) => {
    items.forEach((item) => {
      const block = asBlockRecord(item);
      if (!block || typeof block.id !== 'string') {
        return;
      }

      const props = asBlockRecord(block.props);
      const propText = collectDirectFieldText(props, ['title', 'caption', 'label', 'name']).join(' ');
      const blockFieldText = collectDirectFieldText(block, ['title', 'content', 'caption', 'label', 'name', 'items']).join(' ');
      const directText = [propText, blockFieldText]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (directText.length > 0) {
        blocks.push({
          blockId: block.id,
          blockType: typeof block.type === 'string' ? block.type : 'unknown',
          preview: buildSearchPreview('', directText, ''),
          searchableText: directText,
        });
      }

      if (Array.isArray(block.children) && block.children.length > 0) {
        visit(block.children);
      }
    });
  };

  visit(parsed);
  return blocks;
};

export const includesAllTokens = (value: string, tokens: string[]): boolean => {
  const normalizedValue = value.toLocaleLowerCase();
  return tokens.every((token) => normalizedValue.includes(token));
};

export const buildSearchPreview = (title: string, bodyText: string, query: string): string => {
  const fallbackText = bodyText.trim() || title.trim();
  if (!fallbackText) {
    return '没有可预览的正文内容';
  }

  const normalizedText = fallbackText.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchIndex = normalizedQuery ? normalizedText.indexOf(normalizedQuery) : -1;

  if (matchIndex < 0) {
    return fallbackText.slice(0, SEARCH_PREVIEW_LENGTH);
  }

  const start = Math.max(0, matchIndex - 16);
  const end = Math.min(fallbackText.length, start + SEARCH_PREVIEW_LENGTH);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < fallbackText.length ? '...' : '';
  return `${prefix}${fallbackText.slice(start, end)}${suffix}`;
};

export const scoreSearchResult = (title: string, bodyText: string, query: string): number => {
  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedBody = bodyText.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();

  let score = 0;
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 5;
  }
  if (normalizedBody.includes(normalizedQuery)) {
    score += 2;
  }

  return score;
};

export type FallbackSearchCandidate = WorkspaceSearchResultRecord & {
  score: number;
  searchableText: string;
};
