import type {
  SidebarAssociatedDocument,
  SidebarAssociatedDocumentEvidence,
  SidebarTextEvidence,
} from './sidebarAssociations';
import type { DocumentRecord } from '../types/workspace';

export const wikiRelationTypes = [
  'reference',
  'supplement',
  'same-topic',
  'problem-solution',
  'requirement-defect',
] as const;

export type WikiRelationType = (typeof wikiRelationTypes)[number];

export type WikiRelationJudgementStatus = 'pending' | 'accepted' | 'rejected' | 'unavailable';

export type WikiRelationJudgementEvidenceKind =
  | 'text-evidence'
  | 'semantic-similarity'
  | 'topic-similarity'
  | 'explicit-reference';

export interface WikiRelationJudgementEvidence {
  evidenceId: string;
  kind: WikiRelationJudgementEvidenceKind;
  label: string;
  snippet: string;
  blockId?: string;
  matchedText?: string;
  score?: number;
}

export interface WikiRelationJudgementRequest {
  sourceDocumentId: string;
  sourceTitle: string;
  targetDocumentId: string;
  targetTitle: string;
  sourceSnippets: string[];
  evidence: WikiRelationJudgementEvidence[];
  allowedRelationTypes: WikiRelationType[];
}

export interface WikiRelationJudgementModelOutput {
  isRelated: boolean;
  relationType?: string;
  confidence?: number;
  rationale?: string;
  evidenceIds?: string[];
}

export interface NormalizeWikiRelationJudgementInput {
  sourceDocumentId: string;
  targetDocumentId: string;
  output: WikiRelationJudgementModelOutput;
  modelProvider?: string;
  modelName?: string;
  minimumAcceptedConfidence?: number;
}

export interface WikiRelationJudgementResult {
  status: WikiRelationJudgementStatus;
  sourceDocumentId: string;
  targetDocumentId: string;
  confidence: number;
  rationale: string;
  evidenceIds: string[];
  relationType?: WikiRelationType;
  modelProvider?: string;
  modelName?: string;
}

export interface BuildWikiRelationJudgementRequestInput {
  sourceDocument: DocumentRecord;
  associatedDocument: SidebarAssociatedDocument;
  maxEvidenceItems?: number;
  maxSnippetLength?: number;
}

const DEFAULT_MAX_EVIDENCE_ITEMS = 6;
const DEFAULT_MAX_SNIPPET_LENGTH = 240;
const DEFAULT_PROMOTION_CONFIDENCE = 0.72;

const normalizeText = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

const truncateText = (value: string | undefined, maxLength: number): string => {
  const normalized = normalizeText(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
};

const clampConfidence = (value: number | undefined): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
};

const isWikiRelationType = (value: string | undefined): value is WikiRelationType =>
  wikiRelationTypes.includes(value as WikiRelationType);

const toTextEvidence = (
  evidence: SidebarTextEvidence,
  index: number,
  maxSnippetLength: number,
): WikiRelationJudgementEvidence => ({
  evidenceId: `text:${evidence.blockId}:${index}`,
  kind: 'text-evidence',
  label: evidence.reason || evidence.label || '原文命中',
  snippet: truncateText(evidence.snippet || evidence.matchedText, maxSnippetLength),
  blockId: evidence.blockId,
  matchedText: evidence.matchedText,
  score: evidence.score,
});

const toSimilarityEvidence = (
  evidence: SidebarAssociatedDocumentEvidence,
  index: number,
  maxSnippetLength: number,
): WikiRelationJudgementEvidence => ({
  evidenceId: `similarity:${evidence.blockId}:${index}`,
  kind: evidence.reason.includes('主题') ? 'topic-similarity' : 'semantic-similarity',
  label: evidence.reason || evidence.label || '相似证据',
  snippet: truncateText(evidence.snippet || evidence.searchText, maxSnippetLength),
  blockId: evidence.blockId,
  matchedText: evidence.searchText,
  score: evidence.score,
});

export const buildWikiRelationJudgementRequest = ({
  sourceDocument,
  associatedDocument,
  maxEvidenceItems = DEFAULT_MAX_EVIDENCE_ITEMS,
  maxSnippetLength = DEFAULT_MAX_SNIPPET_LENGTH,
}: BuildWikiRelationJudgementRequestInput): WikiRelationJudgementRequest => {
  const sourceSnippets = sourceDocument.sections
    .map((section) => truncateText(section.content, maxSnippetLength))
    .filter(Boolean)
    .slice(0, 2);

  const evidence = [
    ...associatedDocument.textEvidence.map((item, index) => toTextEvidence(item, index, maxSnippetLength)),
    ...associatedDocument.similarityEvidence.map((item, index) =>
      toSimilarityEvidence(item, index, maxSnippetLength),
    ),
  ].slice(0, maxEvidenceItems);

  if (evidence.length === 0 && associatedDocument.badges.includes('主题相似')) {
    evidence.push({
      evidenceId: `topic:${associatedDocument.documentId}:0`,
      kind: 'topic-similarity',
      label: '主题相似',
      snippet: truncateText(associatedDocument.recommendationReason, maxSnippetLength),
      score: associatedDocument.score,
    });
  }

  return {
    sourceDocumentId: sourceDocument.id,
    sourceTitle: sourceDocument.title,
    targetDocumentId: associatedDocument.documentId,
    targetTitle: associatedDocument.title,
    sourceSnippets,
    evidence,
    allowedRelationTypes: [...wikiRelationTypes],
  };
};

export const normalizeWikiRelationJudgementResult = ({
  sourceDocumentId,
  targetDocumentId,
  output,
  modelProvider,
  modelName,
  minimumAcceptedConfidence = DEFAULT_PROMOTION_CONFIDENCE,
}: NormalizeWikiRelationJudgementInput): WikiRelationJudgementResult => {
  const confidence = clampConfidence(output.confidence);
  const status: WikiRelationJudgementStatus =
    output.isRelated && confidence >= minimumAcceptedConfidence ? 'accepted' : 'rejected';
  const relationType = isWikiRelationType(output.relationType) ? output.relationType : undefined;

  return {
    status,
    sourceDocumentId,
    targetDocumentId,
    relationType,
    confidence,
    rationale: normalizeText(output.rationale) || '模型未提供理由',
    evidenceIds: output.evidenceIds ?? [],
    modelProvider,
    modelName,
  };
};

export const createUnavailableWikiRelationJudgement = (
  sourceDocumentId: string,
  targetDocumentId: string,
  rationale: string,
): WikiRelationJudgementResult => ({
  status: 'unavailable',
  sourceDocumentId,
  targetDocumentId,
  confidence: 0,
  rationale,
  evidenceIds: [],
});

export const shouldPromoteWikiRelationToGraphCandidate = (
  result: WikiRelationJudgementResult,
  minimumAcceptedConfidence = DEFAULT_PROMOTION_CONFIDENCE,
): boolean => result.status === 'accepted' && result.confidence >= minimumAcceptedConfidence;
