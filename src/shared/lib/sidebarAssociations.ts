import { getFolderPathLabel } from './documentPaths';
import { deriveSectionsFromContentJson } from './documentContent';
import { extractOutgoingMentions } from './outgoingMentions';
import type { DocumentRecord, FolderNode, OutlineItem, TagRecord } from '../types/workspace';

export interface SidebarRelatedDocument {
  documentId: string;
  title: string;
  folderPath: string;
  score: number;
  reason: string;
  currentSnippet?: string;
  matchedSnippet?: string;
  matchedSnippets?: string[];
  previewMatches?: SidebarRelatedDocumentPreviewMatch[];
  matchCount?: number;
}

export interface SidebarRelatedDocumentPreviewMatch {
  blockId: string;
  label: string;
  snippet: string;
  searchText: string;
}

export interface SidebarRelatedTag {
  id: string;
  label: string;
  score: number;
  sourceDocumentCount: number;
}

export interface SidebarSimilarBlock {
  documentId: string;
  documentTitle: string;
  blockId: string;
  label: string;
  text: string;
  score: number;
}

export interface SidebarSuggestedLink {
  documentId: string;
  documentTitle: string;
  blockId: string;
  text: string;
  score: number;
}

export interface SidebarTextEvidence {
  documentId: string;
  documentTitle: string;
  blockId: string;
  label: string;
  matchedText: string;
  snippet: string;
  reason: string;
  score: number;
}

export type SidebarAssociatedDocumentBadge = '主题相似' | '局部相似' | '原文命中';

export interface SidebarAssociatedDocumentEvidence {
  blockId: string;
  label: string;
  snippet: string;
  searchText: string;
  reason: string;
  score: number;
}

export interface SidebarAssociatedDocument {
  documentId: string;
  title: string;
  folderPath: string;
  score: number;
  badges: SidebarAssociatedDocumentBadge[];
  recommendationReason: string;
  evidenceStrength: 'high' | 'medium' | 'low';
  similarityEvidence: SidebarAssociatedDocumentEvidence[];
  textEvidence: SidebarTextEvidence[];
}

export interface SidebarAssociationSummary {
  wikiAssociationCount: number;
}

export interface SidebarAssociationResult {
  relatedDocuments: SidebarRelatedDocument[];
  relatedTags: SidebarRelatedTag[];
  similarBlocks: SidebarSimilarBlock[];
  suggestedLinks: SidebarSuggestedLink[];
  textEvidence: SidebarTextEvidence[];
  associatedDocuments: SidebarAssociatedDocument[];
  summary: SidebarAssociationSummary;
}

interface DeriveSidebarAssociationsInput {
  activeDocument: DocumentRecord | null;
  documents: DocumentRecord[];
  folders: FolderNode[];
  focusedOutlineItem?: OutlineItem | null;
}

const MAX_RELATED_DOCUMENTS = 4;
const MAX_RELATED_TAGS = 6;
const MAX_SIMILAR_BLOCKS = 3;
const MAX_SUGGESTED_LINKS = 3;
const MIN_TEXT_OVERLAP = 3;
const MIN_DOCUMENT_TEXT_OVERLAP = 3;
const MIN_DOCUMENT_SIMILARITY_RATIO = 0.22;
const MIN_DOCUMENT_COVERAGE_RATIO = 0.18;
const MIN_BLOCK_SIMILARITY_RATIO = 0.22;
const MIN_BLOCK_COVERAGE_RATIO = 0.18;
const MIN_MEANINGFUL_BODY_LENGTH = 10;
const MAX_PREVIEW_SNIPPET_LENGTH = 72;
const MAX_PREVIEW_MATCHES = 10;
const MIN_TEXT_EVIDENCE_LENGTH = 4;
const MAX_TEXT_EVIDENCE_LENGTH = 40;
const MAX_TEXT_EVIDENCE = 8;

type JsonRecord = Record<string, unknown>;

const tokenizeText = (value: string): string[] => {
  const normalized = value.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const asciiTokens = normalized.match(/[a-z0-9#@_-]+/g) ?? [];
  const cjkChars = Array.from(normalized.replace(/[^\p{Script=Han}]/gu, ''));
  const cjkBigrams = cjkChars.slice(0, -1).map((char, index) => `${char}${cjkChars[index + 1]}`);

  return [...new Set([...asciiTokens, ...cjkBigrams].filter((token) => token.length > 1))];
};

const countTokenOverlap = (left: string[], right: string[]): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  return left.reduce((sum, token) => sum + (rightSet.has(token) ? 1 : 0), 0);
};

const getSharedTokens = (left: string[], right: string[]): string[] => {
  if (left.length === 0 || right.length === 0) {
    return [];
  }

  const rightSet = new Set(right);
  return [...new Set(left.filter((token) => rightSet.has(token)))];
};

const getVisibleTextLength = (value: string): number => value.replace(/\s+/g, '').trim().length;

const getDocumentTags = (document: DocumentRecord): TagRecord[] => document.tags ?? [];

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : null;

const parseContentBlocks = (contentJson: string | null | undefined): unknown[] => {
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

const isLegacySectionLike = (value: unknown): boolean => {
  const record = asRecord(value);
  return Boolean(record && typeof record.type === 'string' && !Array.isArray(record.content) && !Array.isArray(record.children));
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
    return typeof props?.title === 'string' && props.title.trim().length > 0 ? `@${props.title.trim()}` : '';
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return [
    flattenInlineText(record.content),
    flattenInlineText(record.children),
    flattenInlineText(record.rows),
    flattenInlineText(record.cells),
  ].join(' ');
};

const parseJsonMaybe = (value: unknown): unknown => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getBlockPropsText = (value: unknown): string => {
  const record = asRecord(value);
  if (!record) {
    return '';
  }

  return [
    typeof record.name === 'string' ? record.name : '',
    typeof record.title === 'string' ? record.title : '',
    typeof record.caption === 'string' ? record.caption : '',
    typeof record.label === 'string' ? record.label : '',
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');
};

const getRichTableText = (props: unknown): string => {
  const record = asRecord(props);
  const data = typeof record?.data === 'string' ? parseJsonMaybe(record.data) : record?.data;
  return flattenInlineText(data).trim();
};

const getBlockCandidateText = (record: JsonRecord): string => {
  const props = asRecord(record.props);
  return [
    flattenInlineText(record.content),
    getBlockPropsText(props),
    record.type === 'richTable' ? getRichTableText(props) : '',
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');
};

const getDocumentSections = (document: DocumentRecord) =>
  Array.isArray(document.sections) && document.sections.length > 0
    ? document.sections
    : deriveSectionsFromContentJson(document.contentJson);

const getTextFromSection = (document: DocumentRecord['sections'][number]) =>
  [document.title ?? '', document.content ?? '', ...(document.items ?? [])].join(' ').trim();

const getSectionText = (document: DocumentRecord, outlineItem: OutlineItem | null | undefined): string => {
  if (!outlineItem) {
    return '';
  }

  const sections = getDocumentSections(document);
  const headingIndex = sections.findIndex(
    (section) => section.id === outlineItem.id || section.title?.trim() === outlineItem.title.trim(),
  );

  if (headingIndex === -1) {
    return outlineItem.title.trim();
  }

  const groupedSections: string[] = [];
  for (let index = headingIndex; index < sections.length; index += 1) {
    const section = sections[index];
    if (index !== headingIndex && section.type === 'heading') {
      break;
    }
    groupedSections.push(getTextFromSection(section));
  }

  return groupedSections.join(' ').trim();
};

interface SectionSimilarityCandidate {
  id: string;
  label: string;
  kind: 'heading' | 'body';
  text: string;
  tokens: string[];
}

interface DocumentSimilarityMatch {
  activeCandidate: SectionSimilarityCandidate;
  relatedCandidate: SectionSimilarityCandidate;
  overlap: number;
  sharedTokens: string[];
}

interface ScoredRelatedDocument {
  document: DocumentRecord;
  score: number;
  reason: string;
  currentSnippet: string;
  matchedSnippet: string;
  matchedSnippets: string[];
  previewMatches: SidebarRelatedDocumentPreviewMatch[];
  matchCount: number;
}

const buildCandidateLabel = (preferredLabel: string, text: string, fallbackLabel: string): string => {
  const normalizedPreferred = preferredLabel.trim();
  if (normalizedPreferred.length > 0) {
    return normalizedPreferred;
  }

  const normalizedText = text.trim();
  if (normalizedText.length > 0) {
    return normalizedText.slice(0, 24);
  }

  return fallbackLabel;
};

const getLegacySimilarityCandidates = (document: DocumentRecord): SectionSimilarityCandidate[] =>
  getDocumentSections(document)
    .flatMap((section, index) => {
      const fallbackId = section.id || `${document.id}-section-${index}`;

      if (section.type === 'bullet-list') {
        return (section.items ?? []).map((item, itemIndex) => ({
          id: `${fallbackId}-item-${itemIndex}`,
          label: buildCandidateLabel('', item, document.title),
          kind: 'body' as const,
          text: item.trim(),
          tokens: tokenizeText(item),
        }));
      }

      if (section.type === 'gallery') {
        return (section.items ?? []).map((item, itemIndex) => ({
          id: `${fallbackId}-gallery-${itemIndex}`,
          label: buildCandidateLabel('', item, document.title),
          kind: 'body' as const,
          text: item.trim(),
          tokens: tokenizeText(item),
        }));
      }

      const text = getTextFromSection(section);
      const kind: SectionSimilarityCandidate['kind'] = section.type === 'heading' ? 'heading' : 'body';
      return [
        {
          id: fallbackId,
          label: buildCandidateLabel(section.title?.trim() ?? '', text, document.title),
          kind,
          text,
          tokens: tokenizeText(text),
        },
      ];
    })
    .filter((candidate) => candidate.text.length > 0 && candidate.tokens.length > 0);

const getBlockSimilarityCandidates = (
  blocks: unknown[],
  documentTitle: string,
  pathPrefix = 'block',
  options: { includeShortListItems?: boolean } = {},
): SectionSimilarityCandidate[] =>
  blocks.flatMap((block, index) => {
    const record = asRecord(block);
    if (!record || typeof record.type !== 'string') {
      return [];
    }

    const blockId = typeof record.id === 'string' ? record.id : `${pathPrefix}-${index}`;
    const text = getBlockCandidateText(record);
    const childCandidates = Array.isArray(record.children)
      ? getBlockSimilarityCandidates(record.children, documentTitle, `${blockId}-child`, options)
      : [];

    if (text.length === 0) {
      return childCandidates;
    }

    const candidateTypes = new Set([
      'heading',
      'paragraph',
      'quote',
      'alert',
      'bulletListItem',
      'numberedListItem',
      'checkListItem',
      'toggleListItem',
      'codeBlock',
      'table',
      'richTable',
      'image',
      'video',
      'file',
      'kbAttachment',
    ]);
    if (!candidateTypes.has(record.type)) {
      return childCandidates;
    }
    if (
      !options.includeShortListItems &&
      ['bulletListItem', 'numberedListItem', 'checkListItem'].includes(record.type) &&
      getVisibleTextLength(text) < MIN_MEANINGFUL_BODY_LENGTH
    ) {
      return childCandidates;
    }

    const props = asRecord(record.props);
    const preferredLabel =
      (typeof props?.title === 'string' ? props.title : '') ||
      (typeof props?.name === 'string' ? props.name : '') ||
      (typeof props?.caption === 'string' ? props.caption : '') ||
      (typeof props?.label === 'string' ? props.label : '') ||
      (record.type === 'heading' ? text : '');
    const kind: SectionSimilarityCandidate['kind'] = record.type === 'heading' ? 'heading' : 'body';

    return [
      {
        id: blockId,
        label: buildCandidateLabel(preferredLabel, text, documentTitle),
        kind,
        text,
        tokens: tokenizeText(text),
      },
      ...childCandidates,
    ].filter((candidate) => candidate.text.length > 0 && candidate.tokens.length > 0);
  });

const getDocumentSimilarityCandidates = (document: DocumentRecord): SectionSimilarityCandidate[] => {
  const selectBestCandidates = (candidates: SectionSimilarityCandidate[]) => {
    const bodyCandidates = candidates.filter((candidate) => candidate.kind === 'body');
    const meaningfulBodyCandidates = bodyCandidates.filter(
      (candidate) => getVisibleTextLength(candidate.text) >= MIN_MEANINGFUL_BODY_LENGTH,
    );

    if (meaningfulBodyCandidates.length > 0) {
      return meaningfulBodyCandidates;
    }

    if (bodyCandidates.length > 0) {
      return bodyCandidates;
    }

    return candidates;
  };

  const persistedBlocks = parseContentBlocks(document.contentJson);
  const blockCandidates =
    persistedBlocks.length > 0 && !persistedBlocks.every((block) => isLegacySectionLike(block))
      ? getBlockSimilarityCandidates(persistedBlocks, document.title)
      : [];

  if (blockCandidates.length > 0) {
    return selectBestCandidates(blockCandidates);
  }

  const sectionCandidates = getLegacySimilarityCandidates(document);

  if (sectionCandidates.length > 0) {
    return selectBestCandidates(sectionCandidates);
  }

  const fallbackText = document.title.trim();
  if (!fallbackText) {
    return [];
  }

  return [
    {
      id: document.id,
      label: document.title,
      kind: 'body',
      text: fallbackText,
      tokens: tokenizeText(fallbackText),
    },
  ];
};

const getAllDocumentSimilarityCandidates = (document: DocumentRecord): SectionSimilarityCandidate[] => {
  const persistedBlocks = parseContentBlocks(document.contentJson);
  const blockCandidates =
    persistedBlocks.length > 0 && !persistedBlocks.every((block) => isLegacySectionLike(block))
      ? getBlockSimilarityCandidates(persistedBlocks, document.title, 'block', { includeShortListItems: true })
      : [];

  if (blockCandidates.length > 0) {
    return blockCandidates;
  }

  const sectionCandidates = getLegacySimilarityCandidates(document);
  if (sectionCandidates.length > 0) {
    return sectionCandidates;
  }

  const fallbackText = document.title.trim();
  if (!fallbackText) {
    return [];
  }

  return [
    {
      id: document.id,
      label: document.title,
      kind: 'body',
      text: fallbackText,
      tokens: tokenizeText(fallbackText),
    },
  ];
};

const createPreviewSnippet = (text: string, sharedTokens: string[]): string => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText) {
    return '';
  }

  const loweredText = normalizedText.toLowerCase();
  const anchorToken = [...sharedTokens]
    .sort((left, right) => right.length - left.length)
    .find((token) => loweredText.includes(token.toLowerCase()));

  if (!anchorToken) {
    return normalizedText.length > MAX_PREVIEW_SNIPPET_LENGTH
      ? `${normalizedText.slice(0, MAX_PREVIEW_SNIPPET_LENGTH - 1)}…`
      : normalizedText;
  }

  const anchorIndex = loweredText.indexOf(anchorToken.toLowerCase());
  const start = Math.max(0, anchorIndex - 18);
  const end = Math.min(normalizedText.length, start + MAX_PREVIEW_SNIPPET_LENGTH);

  return `${start > 0 ? '…' : ''}${normalizedText.slice(start, end).trim()}${end < normalizedText.length ? '…' : ''}`;
};

const buildDocumentSimilarityMatches = (
  activeCandidates: SectionSimilarityCandidate[],
  relatedCandidates: SectionSimilarityCandidate[],
): DocumentSimilarityMatch[] => {
  const matches: DocumentSimilarityMatch[] = [];

  relatedCandidates.forEach((relatedCandidate) => {
    let bestMatch: DocumentSimilarityMatch | null = null;

    activeCandidates.forEach((activeCandidate) => {
      const sharedTokens = getSharedTokens(activeCandidate.tokens, relatedCandidate.tokens);
      const overlapRatio = sharedTokens.length / Math.min(activeCandidate.tokens.length, relatedCandidate.tokens.length);
      const coverageRatio = sharedTokens.length / Math.max(activeCandidate.tokens.length, relatedCandidate.tokens.length);
      if (
        sharedTokens.length < MIN_DOCUMENT_TEXT_OVERLAP ||
        overlapRatio < MIN_DOCUMENT_SIMILARITY_RATIO ||
        coverageRatio < MIN_DOCUMENT_COVERAGE_RATIO
      ) {
        return;
      }

      if (!bestMatch || sharedTokens.length > bestMatch.overlap) {
        bestMatch = {
          activeCandidate,
          relatedCandidate,
          overlap: sharedTokens.length,
          sharedTokens,
        };
      }
    });

    if (bestMatch) {
      matches.push(bestMatch);
    }
  });

  return matches.sort(
    (left, right) => right.overlap - left.overlap || left.relatedCandidate.label.localeCompare(right.relatedCandidate.label),
  );
};

const buildRelatedDocumentReason = (matchCount: number): string =>
  matchCount > 1 ? `${matchCount} 处内容相似` : '内容相似';

const normalizeEvidenceText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const createTextEvidenceSnippet = (text: string, matchedText: string): string => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const normalizedMatch = matchedText.replace(/\s+/g, ' ').trim();
  if (!normalizedText || !normalizedMatch) {
    return '';
  }

  const index = normalizedText.toLowerCase().indexOf(normalizedMatch.toLowerCase());
  if (index === -1) {
    return normalizedText.length > MAX_PREVIEW_SNIPPET_LENGTH
      ? `${normalizedText.slice(0, MAX_PREVIEW_SNIPPET_LENGTH - 1)}…`
      : normalizedText;
  }

  const start = Math.max(0, index - 18);
  const end = Math.min(normalizedText.length, start + MAX_PREVIEW_SNIPPET_LENGTH);

  return `${start > 0 ? '…' : ''}${normalizedText.slice(start, end).trim()}${end < normalizedText.length ? '…' : ''}`;
};

const getTextEvidenceReason = (candidate: SectionSimilarityCandidate): string => {
  if (candidate.kind === 'heading') {
    return '命中标题式表达';
  }

  return getVisibleTextLength(candidate.text) >= MIN_MEANINGFUL_BODY_LENGTH ? '命中关键句' : '命中短语';
};

const getTextEvidenceCandidates = (document: DocumentRecord): SectionSimilarityCandidate[] =>
  getAllDocumentSimilarityCandidates(document)
    .filter((candidate) => {
      const length = getVisibleTextLength(candidate.text);
      return length >= MIN_TEXT_EVIDENCE_LENGTH && length <= MAX_TEXT_EVIDENCE_LENGTH;
    });

const deriveTextEvidence = ({
  activeDocument,
  documents,
}: {
  activeDocument: DocumentRecord;
  documents: DocumentRecord[];
}): SidebarTextEvidence[] => {
  const activeCandidates = getTextEvidenceCandidates(activeDocument);
  if (activeCandidates.length === 0) {
    return [];
  }

  const evidence = documents
    .filter((document) => document.id !== activeDocument.id && document.spaceId === activeDocument.spaceId)
    .flatMap((document) => {
      const relatedCandidates = getAllDocumentSimilarityCandidates(document);

      return activeCandidates.flatMap((activeCandidate) => {
        const matchedText = activeCandidate.text.trim();
        const normalizedMatchedText = normalizeEvidenceText(matchedText);
        if (!normalizedMatchedText) {
          return [];
        }

        return relatedCandidates
          .filter((relatedCandidate) =>
            normalizeEvidenceText(relatedCandidate.text).includes(normalizedMatchedText),
          )
          .map((relatedCandidate) => ({
            documentId: document.id,
            documentTitle: document.title,
            blockId: relatedCandidate.id,
            label: relatedCandidate.label,
            matchedText,
            snippet: createTextEvidenceSnippet(relatedCandidate.text, matchedText),
            reason: getTextEvidenceReason(activeCandidate),
            score: Math.min(16, getVisibleTextLength(matchedText)),
          }));
      });
    });

  return Array.from(
    new Map(
      evidence
        .sort((left, right) => right.score - left.score || left.documentTitle.localeCompare(right.documentTitle))
        .map((item) => [`${item.documentId}:${item.blockId}:${item.matchedText}`, item] as const),
    ).values(),
  ).slice(0, MAX_TEXT_EVIDENCE);
};

const addAssociatedDocumentBadge = (
  badges: SidebarAssociatedDocumentBadge[],
  badge: SidebarAssociatedDocumentBadge,
) => {
  if (!badges.includes(badge)) {
    badges.push(badge);
  }
};

const getAssociatedDocumentRecommendationReason = (document: SidebarAssociatedDocument): string => {
  if (document.textEvidence.length > 0) {
    const hasKeySentence = document.textEvidence.some((evidence) => evidence.reason.includes('关键句'));
    if (hasKeySentence) {
      return '命中关键句';
    }

    return `${document.textEvidence.length} 条原文线索`;
  }

  if (document.badges.includes('局部相似')) {
    return '局部内容相似';
  }

  if (document.badges.includes('主题相似')) {
    return '主题相似';
  }

  return '相关文档';
};

const getAssociatedDocumentEvidenceStrength = (
  document: SidebarAssociatedDocument,
): SidebarAssociatedDocument['evidenceStrength'] => {
  if (document.textEvidence.length > 0) {
    return 'high';
  }

  if (document.badges.includes('局部相似')) {
    return 'medium';
  }

  return 'low';
};

const deriveAssociatedDocuments = ({
  relatedDocumentScores,
  similarBlocks,
  textEvidence,
  documents,
  folders,
}: {
  relatedDocumentScores: ScoredRelatedDocument[];
  similarBlocks: SidebarSimilarBlock[];
  textEvidence: SidebarTextEvidence[];
  documents: DocumentRecord[];
  folders: FolderNode[];
}): SidebarAssociatedDocument[] => {
  const documentLookup = new Map(documents.map((document) => [document.id, document]));
  const associatedDocumentMap = new Map<string, SidebarAssociatedDocument>();

  const getOrCreateAssociatedDocument = ({
    documentId,
    title,
    score,
  }: {
    documentId: string;
    title: string;
    score: number;
  }) => {
    const current = associatedDocumentMap.get(documentId);
    if (current) {
      current.score = Math.max(current.score, score);
      return current;
    }

    const document = documentLookup.get(documentId);
    const associatedDocument: SidebarAssociatedDocument = {
      documentId,
      title: document?.title ?? title,
      folderPath: document ? getFolderPathLabel(folders, document.folderId) : '',
      score,
      badges: [],
      recommendationReason: '相关文档',
      evidenceStrength: 'low',
      similarityEvidence: [],
      textEvidence: [],
    };
    associatedDocumentMap.set(documentId, associatedDocument);
    return associatedDocument;
  };

  relatedDocumentScores.forEach(({ document, score, reason, previewMatches }) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: document.id,
      title: document.title,
      score,
    });
    addAssociatedDocumentBadge(associatedDocument.badges, '主题相似');
    associatedDocument.similarityEvidence.push(
      ...previewMatches.map((match) => ({
        blockId: match.blockId,
        label: match.label,
        snippet: match.snippet,
        searchText: match.searchText,
        reason,
        score,
      })),
    );
  });

  similarBlocks.forEach((block) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: block.documentId,
      title: block.documentTitle,
      score: block.score,
    });
    addAssociatedDocumentBadge(associatedDocument.badges, '局部相似');
    associatedDocument.similarityEvidence.push({
      blockId: block.blockId,
      label: block.label,
      snippet: createPreviewSnippet(block.text, []),
      searchText: block.text,
      reason: '局部相似',
      score: block.score,
    });
  });

  textEvidence.forEach((evidence) => {
    const associatedDocument = getOrCreateAssociatedDocument({
      documentId: evidence.documentId,
      title: evidence.documentTitle,
      score: evidence.score,
    });
    addAssociatedDocumentBadge(associatedDocument.badges, '原文命中');
    associatedDocument.textEvidence.push(evidence);
  });

  const associatedDocuments = Array.from(associatedDocumentMap.values()).map((document) => ({
    ...document,
    recommendationReason: getAssociatedDocumentRecommendationReason(document),
    evidenceStrength: getAssociatedDocumentEvidenceStrength(document),
  }));

  return associatedDocuments.sort((left, right) => {
    const leftEvidenceCount = left.similarityEvidence.length + left.textEvidence.length;
    const rightEvidenceCount = right.similarityEvidence.length + right.textEvidence.length;
    const leftHasTextEvidence = left.textEvidence.length > 0 ? 1 : 0;
    const rightHasTextEvidence = right.textEvidence.length > 0 ? 1 : 0;

    return (
      right.score - left.score ||
      rightHasTextEvidence - leftHasTextEvidence ||
      rightEvidenceCount - leftEvidenceCount ||
      left.title.localeCompare(right.title)
    );
  });
};

export const deriveSidebarAssociations = ({
  activeDocument,
  documents,
  folders,
  focusedOutlineItem = null,
}: DeriveSidebarAssociationsInput): SidebarAssociationResult => {
  if (!activeDocument) {
    return {
      relatedDocuments: [],
      relatedTags: [],
      similarBlocks: [],
      suggestedLinks: [],
      textEvidence: [],
      associatedDocuments: [],
      summary: {
        wikiAssociationCount: 0,
      },
    };
  }

  const activeTagIds = new Set(getDocumentTags(activeDocument).map((tag) => tag.id));
  const activeOutgoingMentions = extractOutgoingMentions(activeDocument.contentJson, activeDocument.id);
  const activeOutgoingMentionIds = new Set(activeOutgoingMentions.map((mention) => mention.targetDocumentId));
  const activeDocumentCandidates = getDocumentSimilarityCandidates(activeDocument);
  const focusedSectionText = getSectionText(activeDocument, focusedOutlineItem);
  const focusedSectionTokens = tokenizeText(focusedSectionText);

  const relatedDocumentScores = documents
    .filter((document) => document.id !== activeDocument.id && document.spaceId === activeDocument.spaceId)
    .map((document) => {
      const similarityMatches = buildDocumentSimilarityMatches(
        activeDocumentCandidates,
        getDocumentSimilarityCandidates(document),
      );

      if (similarityMatches.length === 0) {
        return null;
      }

      const bestMatch = similarityMatches[0];
      const previewMatches = Array.from(
        new Map(
          similarityMatches
            .map((match) => {
              const snippet = createPreviewSnippet(match.relatedCandidate.text, match.sharedTokens);
              if (!snippet) {
                return null;
              }

              return [
                snippet,
                {
                  blockId: match.relatedCandidate.id,
                  label: match.relatedCandidate.label,
                  snippet,
                  searchText: match.relatedCandidate.text,
                } satisfies SidebarRelatedDocumentPreviewMatch,
              ] as const;
            })
            .filter(
              (entry): entry is readonly [string, SidebarRelatedDocumentPreviewMatch] => entry !== null,
            ),
        ).values(),
      ).slice(0, MAX_PREVIEW_MATCHES);
      const matchedSnippets = previewMatches.map((match) => match.snippet);

      return {
        document,
        score: Math.min(16, similarityMatches.reduce((sum, match) => sum + match.overlap, 0)),
        reason: buildRelatedDocumentReason(similarityMatches.length),
        currentSnippet: createPreviewSnippet(bestMatch.activeCandidate.text, bestMatch.sharedTokens),
        matchedSnippet: createPreviewSnippet(bestMatch.relatedCandidate.text, bestMatch.sharedTokens),
        matchedSnippets,
        previewMatches,
        matchCount: similarityMatches.length,
      };
    })
    .filter((item): item is ScoredRelatedDocument => item !== null)
    .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title))
    .slice(0, MAX_RELATED_DOCUMENTS);

  const relatedTagMap = relatedDocumentScores.reduce<Map<string, SidebarRelatedTag>>((map, { document, score }) => {
    getDocumentTags(document)
      .filter((tag) => !activeTagIds.has(tag.id))
      .forEach((tag) => {
        const current = map.get(tag.id);
        if (current) {
          current.score += score;
          current.sourceDocumentCount += 1;
          return;
        }

        map.set(tag.id, {
          id: tag.id,
          label: tag.label,
          score,
          sourceDocumentCount: 1,
        });
      });
    return map;
  }, new Map());

  const relatedTags = Array.from(relatedTagMap.values())
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, MAX_RELATED_TAGS);

  const similarBlocks = focusedSectionTokens.length === 0
    ? []
    : documents
        .filter((document) => document.id !== activeDocument.id && document.spaceId === activeDocument.spaceId)
        .flatMap((document) =>
          getDocumentSimilarityCandidates(document)
            .map((candidate) => {
              const text = candidate.text;
              const candidateTokens = tokenizeText(text);
              const overlap = countTokenOverlap(focusedSectionTokens, candidateTokens);
              const overlapRatio = overlap / Math.min(focusedSectionTokens.length, candidateTokens.length);
              const coverageRatio = overlap / Math.max(focusedSectionTokens.length, candidateTokens.length);
              return {
                documentId: document.id,
                documentTitle: document.title,
                blockId: candidate.id,
                label: candidate.label,
                text,
                score: overlap,
                overlapRatio,
                coverageRatio,
              };
            })
            .filter(
              (candidate) =>
                candidate.text.length > 0 &&
                candidate.score >= MIN_TEXT_OVERLAP &&
                candidate.overlapRatio >= MIN_BLOCK_SIMILARITY_RATIO &&
                candidate.coverageRatio >= MIN_BLOCK_COVERAGE_RATIO,
            ),
        )
        .sort((left, right) => right.score - left.score || left.documentTitle.localeCompare(right.documentTitle))
        .slice(0, MAX_SIMILAR_BLOCKS);

  const suggestedLinks = similarBlocks
    .filter((block) => !activeOutgoingMentionIds.has(block.documentId))
    .slice(0, MAX_SUGGESTED_LINKS)
    .map((block) => ({
      documentId: block.documentId,
      documentTitle: block.documentTitle,
      blockId: block.blockId,
      text: block.text,
      score: block.score,
    }));

  const fallbackSuggestedLinks = relatedDocumentScores
    .filter(({ document }) => !activeOutgoingMentionIds.has(document.id))
    .slice(0, MAX_SUGGESTED_LINKS)
    .map(({ document, reason, score }) => ({
      documentId: document.id,
      documentTitle: document.title,
      blockId: getDocumentSimilarityCandidates(document)[0]?.id ?? document.id,
      text: reason,
      score,
    }));
  const textEvidence = deriveTextEvidence({
    activeDocument,
    documents,
  });
  const associatedDocuments = deriveAssociatedDocuments({
    relatedDocumentScores,
    similarBlocks,
    textEvidence,
    documents,
    folders,
  });
  const wikiAssociationDocumentIds = new Set([
    ...relatedDocumentScores.map(({ document }) => document.id),
    ...similarBlocks.map((block) => block.documentId),
    ...textEvidence.map((item) => item.documentId),
  ]);

  return {
    relatedDocuments: relatedDocumentScores.map(
      ({ document, score, reason, currentSnippet, matchedSnippet, matchedSnippets, previewMatches, matchCount }) => ({
        documentId: document.id,
        title: document.title,
        folderPath: getFolderPathLabel(folders, document.folderId),
        score,
        reason,
        currentSnippet,
        matchedSnippet,
        matchedSnippets,
        previewMatches,
        matchCount,
      }),
    ),
    relatedTags,
    similarBlocks,
    suggestedLinks: suggestedLinks.length > 0 ? suggestedLinks : fallbackSuggestedLinks,
    textEvidence,
    associatedDocuments,
    summary: {
      wikiAssociationCount: wikiAssociationDocumentIds.size,
    },
  };
};
