export type WikiRecommendationFeedbackValue = 'useful' | 'less-like-this';

export type WikiRecommendationFeedbackStore = Record<string, WikiRecommendationFeedbackValue>;

export type ActiveWikiRecommendationFeedback = Record<string, WikiRecommendationFeedbackValue>;

export const getWikiRecommendationFeedbackKey = (sourceDocumentId: string, targetDocumentId: string): string =>
  `${sourceDocumentId}::${targetDocumentId}`;

export const setWikiRecommendationFeedback = (
  feedback: WikiRecommendationFeedbackStore,
  sourceDocumentId: string,
  targetDocumentId: string,
  value: WikiRecommendationFeedbackValue,
): WikiRecommendationFeedbackStore => ({
  ...feedback,
  [getWikiRecommendationFeedbackKey(sourceDocumentId, targetDocumentId)]: value,
});

export const getActiveWikiRecommendationFeedback = (
  feedback: WikiRecommendationFeedbackStore,
  sourceDocumentId: string | null | undefined,
): ActiveWikiRecommendationFeedback => {
  if (!sourceDocumentId) {
    return {};
  }

  const prefix = `${sourceDocumentId}::`;

  return Object.fromEntries(
    Object.entries(feedback)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
};
