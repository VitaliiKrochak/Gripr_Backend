export interface RecommendationCandidate {
  id: string;
  collectionId: string | null;
  type: string;
  isHot: boolean;
  tagIds: string[];
  /** Products made from open-license designs always rank after our own. */
  isOpenModel?: boolean;
}

/**
 * Ranks related products: own products before open models, then same
 * collection, the number of shared tags, the same product type, and hot
 * items. Ties keep input order.
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
        candidate.isOpenModel ? 0 : 1,
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
