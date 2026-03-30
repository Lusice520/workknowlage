import type { OutgoingMentionRecord } from '../types/workspace';

type JsonRecord = Record<string, unknown>;

const OUTGOING_MENTION_DESCRIPTION = '在当前文档中已提及';

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : null;

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

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

const collectOutgoingMentions = (
  value: unknown,
  sourceDocumentId: string,
  seenDocumentIds: Set<string>,
  mentions: OutgoingMentionRecord[],
) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectOutgoingMentions(item, sourceDocumentId, seenDocumentIds, mentions);
    });
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  if (record.type === 'docMention') {
    const props = asRecord(record.props);
    const targetDocumentId = normalizeText(props?.documentId);

    if (!targetDocumentId || targetDocumentId === sourceDocumentId || seenDocumentIds.has(targetDocumentId)) {
      return;
    }

    seenDocumentIds.add(targetDocumentId);
    mentions.push({
      id: `outgoing-${targetDocumentId}`,
      targetDocumentId,
      title: normalizeText(props?.title) || '未命名文档',
      description: OUTGOING_MENTION_DESCRIPTION,
    });
    return;
  }

  collectOutgoingMentions(record.content, sourceDocumentId, seenDocumentIds, mentions);
  collectOutgoingMentions(record.children, sourceDocumentId, seenDocumentIds, mentions);
};

export const extractOutgoingMentions = (
  contentJson: string | null | undefined,
  sourceDocumentId: string,
): OutgoingMentionRecord[] => {
  const mentions: OutgoingMentionRecord[] = [];
  collectOutgoingMentions(parseContentArray(contentJson), sourceDocumentId, new Set<string>(), mentions);
  return mentions;
};
