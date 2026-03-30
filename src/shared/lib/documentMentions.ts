type JsonRecord = Record<string, unknown>;

export interface ExtractedDocumentMention {
  targetDocumentId: string;
  sourceBlockId: string | null;
  description: string;
}

const BACKLINK_DESCRIPTION_LIMIT = 120;

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : null;

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

const normalizeTitle = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
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
    const title = normalizeTitle(props?.title);
    return title ? `@${title}` : '';
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return `${flattenInlineText(record.content)}${flattenInlineText(record.children)}`;
};

const collectMentionTargets = (
  value: unknown,
  mentions: Array<{ documentId: string; title: string }> = [],
): Array<{ documentId: string; title: string }> => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectMentionTargets(item, mentions);
    });
    return mentions;
  }

  const record = asRecord(value);
  if (!record) {
    return mentions;
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    const documentId = normalizeTitle(props?.documentId);
    if (documentId) {
      mentions.push({
        documentId,
        title: normalizeTitle(props?.title),
      });
    }
    return mentions;
  }

  collectMentionTargets(record.content, mentions);
  collectMentionTargets(record.children, mentions);
  return mentions;
};

const trimDescription = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, BACKLINK_DESCRIPTION_LIMIT);

const buildBacklinkDescription = (block: JsonRecord, mentionTitle: string): string => {
  const blockText = trimDescription(flattenInlineText(block.content));
  if (blockText.length > 0) {
    return blockText;
  }

  return mentionTitle ? `提到：@${mentionTitle}` : '提到了一篇文档';
};

const collectMentionsFromBlocks = (
  blocks: unknown[],
  sourceDocumentId: string,
  seenTargetIds: Set<string> = new Set<string>(),
  extractedMentions: ExtractedDocumentMention[] = [],
): ExtractedDocumentMention[] => {
  blocks.forEach((block) => {
    const record = asRecord(block);
    if (!record) {
      return;
    }

    const blockMentions = collectMentionTargets(record.content);
    blockMentions.forEach((mention) => {
      if (!mention.documentId || mention.documentId === sourceDocumentId || seenTargetIds.has(mention.documentId)) {
        return;
      }

      seenTargetIds.add(mention.documentId);
      extractedMentions.push({
        targetDocumentId: mention.documentId,
        sourceBlockId: typeof record.id === 'string' ? record.id : null,
        description: buildBacklinkDescription(record, mention.title),
      });
    });

    const children = Array.isArray(record.children) ? record.children : [];
    if (children.length > 0) {
      collectMentionsFromBlocks(children, sourceDocumentId, seenTargetIds, extractedMentions);
    }
  });

  return extractedMentions;
};

export const extractDocumentMentions = (
  contentJson: string | null | undefined,
  sourceDocumentId: string,
): ExtractedDocumentMention[] => collectMentionsFromBlocks(parseContentArray(contentJson), sourceDocumentId);
