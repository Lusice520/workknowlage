import { describe, expect, test } from 'vitest';
import type { SidebarAssociatedDocument } from './sidebarAssociations';
import {
  buildWikiRelationJudgementRequest,
  createUnavailableWikiRelationJudgement,
  normalizeWikiRelationJudgementResult,
  shouldPromoteWikiRelationToGraphCandidate,
} from './wikiRelationJudgement';
import type { DocumentRecord } from '../types/workspace';

const sourceDocument: DocumentRecord = {
  id: 'doc-source',
  spaceId: 'space-1',
  folderId: null,
  title: '测试文档',
  contentJson: JSON.stringify([]),
  updatedAtLabel: 'today',
  wordCountLabel: '0 字',
  badgeLabel: '',
  outline: [],
  tags: [],
  backlinks: [],
  sections: [
    {
      id: 'source-section',
      type: 'paragraph',
      content: '我们正在整理 buglist 和需求清单，并复盘产品化路线。',
    },
  ],
};

const associatedDocument: SidebarAssociatedDocument = {
  documentId: 'doc-target',
  title: '问题清单宣贯稿内容',
  folderPath: '产品策略',
  score: 12,
  badges: ['主题相似', '原文命中'],
  recommendationReason: '命中关键句',
  evidenceStrength: 'high',
  similarityEvidence: [
    {
      blockId: 'semantic-match',
      label: '相似段落',
      snippet: '知识库语义面板应该展示被引用和被提及的内容。',
      searchText: '知识库语义面板应该展示被引用和被提及的内容。',
      reason: '内容相似',
      score: 8,
    },
  ],
  textEvidence: [
    {
      documentId: 'doc-target',
      documentTitle: '问题清单宣贯稿内容',
      blockId: 'long-context',
      label: '问题清单宣贯稿内容',
      matchedText: '公司坚定不移践行产品化路线',
      snippet: '公司坚定不移践行产品化路线，致力于打造标准化、可复用的产品体系。',
      reason: '命中关键句',
      score: 12,
    },
  ],
};

describe('wiki relation judgement boundary', () => {
  test('builds a compact and explainable judgement request from deterministic evidence', () => {
    const request = buildWikiRelationJudgementRequest({
      sourceDocument,
      associatedDocument,
      maxEvidenceItems: 2,
      maxSnippetLength: 18,
    });

    expect(request).toMatchObject({
      sourceDocumentId: 'doc-source',
      sourceTitle: '测试文档',
      targetDocumentId: 'doc-target',
      targetTitle: '问题清单宣贯稿内容',
      allowedRelationTypes: ['reference', 'supplement', 'same-topic', 'problem-solution', 'requirement-defect'],
    });
    expect(request.sourceSnippets).toEqual(['我们正在整理 buglist 和需求...']);
    expect(request.evidence).toHaveLength(2);
    expect(request.evidence[0]).toMatchObject({
      evidenceId: 'text:long-context:0',
      kind: 'text-evidence',
      label: '命中关键句',
      snippet: '公司坚定不移践行产品化路线，致力于打...',
    });
    expect(request.evidence[1]).toMatchObject({
      evidenceId: 'similarity:semantic-match:0',
      kind: 'semantic-similarity',
      label: '内容相似',
    });
  });

  test('normalizes model output without promoting low-confidence relations', () => {
    const result = normalizeWikiRelationJudgementResult({
      sourceDocumentId: 'doc-source',
      targetDocumentId: 'doc-target',
      modelProvider: 'local-test-model',
      minimumAcceptedConfidence: 0.72,
      output: {
        isRelated: true,
        relationType: 'problem-solution',
        confidence: 0.61,
        rationale: '命中内容相关，但证据不足以形成图谱关系。',
        evidenceIds: ['text:long-context:0'],
      },
    });

    expect(result).toMatchObject({
      status: 'rejected',
      relationType: 'problem-solution',
      confidence: 0.61,
      modelProvider: 'local-test-model',
    });
    expect(shouldPromoteWikiRelationToGraphCandidate(result)).toBe(false);
  });

  test('returns unavailable when model judgement is not enabled', () => {
    expect(createUnavailableWikiRelationJudgement('doc-source', 'doc-target', '模型未启用')).toEqual({
      status: 'unavailable',
      sourceDocumentId: 'doc-source',
      targetDocumentId: 'doc-target',
      confidence: 0,
      rationale: '模型未启用',
      evidenceIds: [],
    });
  });
});
