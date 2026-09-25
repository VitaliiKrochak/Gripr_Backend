export interface RecommendationCandidate {
  id: string;
  collectionId: string | null;
  type: string;
  isHot: boolean;
  tagIds: string[];
}

/**
 * Ranks related products: same collection first, then the number of shared
 * tags, then the same product type, then hot items. Ties keep input order.
 */
export function rankRecommendations(
  target: RecommendationCandidate,
  candidates: RecommendationCandidate[],
  limit: number,
): string[] {
  const targetTags = new Set(target.tagIds);

  return candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate, index) => ({
      id: candidate.id,
      index,
      score: [
        target.collectionId && candidate.collectionId === target.collectionId
          ? 1
          : 0,
        candidate.tagIds.filter((tagId) => targetTags.has(tagId)).length,
        candidate.type === target.type ? 1 : 0,
        candidate.isHot ? 1 : 0,
      ],
    }))
    .sort((a, b) => {
      for (let i = 0; i < a.score.length; i += 1) {
        if (a.score[i] !== b.score[i]) {
          return b.score[i] - a.score[i];
        }
      }

      return a.index - b.index;
    })
    .slice(0, limit)
    .map((candidate) => candidate.id);
}
