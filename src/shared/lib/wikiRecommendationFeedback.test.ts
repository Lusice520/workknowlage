import { describe, expect, test } from 'vitest';
import {
  getActiveWikiRecommendationFeedback,
  getWikiRecommendationFeedbackKey,
  setWikiRecommendationFeedback,
} from './wikiRecommendationFeedback';

describe('wiki recommendation feedback', () => {
  test('scopes lightweight feedback to the active source document', () => {
    let feedback = {};

    feedback = setWikiRecommendationFeedback(feedback, 'doc-current', 'doc-shared', 'less-like-this');
    feedback = setWikiRecommendationFeedback(feedback, 'doc-other', 'doc-shared', 'useful');

    expect(getWikiRecommendationFeedbackKey('doc-current', 'doc-shared')).toBe('doc-current::doc-shared');
    expect(getActiveWikiRecommendationFeedback(feedback, 'doc-current')).toEqual({
      'doc-shared': 'less-like-this',
    });
    expect(getActiveWikiRecommendationFeedback(feedback, 'doc-other')).toEqual({
      'doc-shared': 'useful',
    });
  });
});
