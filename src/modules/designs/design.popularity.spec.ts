import { computePopularityScores } from './design.popularity';

describe('computePopularityScores', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const monthsAgo = (months: number) =>
    new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);

  it('ranks by likes, views and like velocity within a group', () => {
    const scores = computePopularityScores(
      [
        {
          id: 'top',
          group: 'ring',
          likes: 900,
          views: 9000,
          publishedAt: monthsAgo(3),
        },
        {
          id: 'mid',
          group: 'ring',
          likes: 100,
          views: 3000,
          publishedAt: monthsAgo(24),
        },
        {
          id: 'low',
          group: 'ring',
          likes: 1,
          views: 10,
          publishedAt: monthsAgo(48),
        },
      ],
      now,
    );

    expect(scores.get('top')).toBe(100);
    expect(scores.get('mid')).toBe(50);
    expect(scores.get('low')).toBe(0);
  });

  it('ranks a recent model above an equally liked older one', () => {
    const scores = computePopularityScores(
      [
        {
          id: 'old',
          group: 'ring',
          likes: 200,
          views: 5000,
          publishedAt: monthsAgo(60),
        },
        {
          id: 'new',
          group: 'ring',
          likes: 200,
          views: 5000,
          publishedAt: monthsAgo(2),
        },
      ],
      now,
    );

    expect(scores.get('new')).toBeGreaterThan(scores.get('old') ?? 0);
  });

  it('scores each group independently and handles singletons', () => {
    const scores = computePopularityScores(
      [
        { id: 'ring', group: 'ring', likes: 5, views: 5, publishedAt: null },
        {
          id: 'pendant',
          group: 'pendant',
          likes: 5000,
          views: 1,
          publishedAt: null,
        },
      ],
      now,
    );

    expect(scores.get('ring')).toBe(50);
    expect(scores.get('pendant')).toBe(50);
  });
});
