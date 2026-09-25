import { MIN_RELEVANCE, scoreRelevance } from './design.relevance';

describe('scoreRelevance', () => {
  it('scores jewelry highly and suggests the product type', () => {
    const result = scoreRelevance({
      title: 'Dragon Ring',
      tags: ['ring', 'jewelry', 'silver'],
      description: 'Printable ring for casting',
    });

    expect(result.suggestedType).toBe('ring');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('picks the strongest type match', () => {
    expect(
      scoreRelevance({
        title: 'Moon pendant',
        tags: ['necklace'],
        description: null,
      }).suggestedType,
    ).toBe('pendant');
  });

  it('penalizes game assets and look-alike rings', () => {
    expect(
      scoreRelevance({
        title: 'Boxing ring',
        tags: ['sport', 'environment'],
        description: null,
      }).score,
    ).toBeLessThan(MIN_RELEVANCE);
    expect(
      scoreRelevance({
        title: 'Corset',
        tags: ['clothing', 'ornament'],
        description: 'Folk costume ring pattern',
      }).score,
    ).toBeLessThan(MIN_RELEVANCE);
  });

  it('returns no type when nothing matches', () => {
    expect(
      scoreRelevance({ title: 'Chair', tags: [], description: null }),
    ).toEqual({ score: 0, suggestedType: null });
  });
});
