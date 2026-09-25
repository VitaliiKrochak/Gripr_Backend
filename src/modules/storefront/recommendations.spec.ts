import {
  rankRecommendations,
  RecommendationCandidate,
} from './recommendations';

function candidate(
  id: string,
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
  return {
    id,
    collectionId: null,
    type: 'pendant',
    isHot: false,
    tagIds: [],
    ...overrides,
  };
}

describe('rankRecommendations', () => {
  const target = candidate('target', {
    collectionId: 'aurora',
    type: 'ring',
    tagIds: ['minimal', 'wedding'],
  });

  it('orders by collection, shared tags, type, and hotness', () => {
    const ranked = rankRecommendations(
      target,
      [
        candidate('hot', { isHot: true }),
        candidate('same-type', { type: 'ring' }),
        candidate('two-tags', { tagIds: ['minimal', 'wedding'] }),
        candidate('one-tag', { tagIds: ['wedding'] }),
        candidate('same-collection', { collectionId: 'aurora' }),
        target,
      ],
      10,
    );

    expect(ranked).toEqual([
      'same-collection',
      'two-tags',
      'one-tag',
      'same-type',
      'hot',
    ]);
  });

  it('never matches products without a collection to each other', () => {
    const ranked = rankRecommendations(
      candidate('target'),
      [candidate('a'), candidate('b', { isHot: true })],
      10,
    );

    expect(ranked).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    expect(
      rankRecommendations(target, [candidate('a'), candidate('b')], 1),
    ).toHaveLength(1);
  });
});
