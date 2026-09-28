import { assessIpRisk } from './design.ip';

describe('assessIpRisk', () => {
  const subject = (title: string, tags: string[] = []) => ({
    title,
    tags,
    description: null,
  });

  it('blocks protected franchises and brands', () => {
    expect(assessIpRisk(subject('Geralt Witcher Wolf Medallion'))).toEqual({
      risk: 'blocked',
      matches: ['witcher', 'geralt'],
    });
    expect(assessIpRisk(subject('Ring', ['Pokémon', 'pikachu'])).risk).toBe(
      'blocked',
    );
    expect(assessIpRisk(subject('Tiffany & Co heart tag')).risk).toBe(
      'blocked',
    );
  });

  it('flags derivative signals for review', () => {
    expect(assessIpRisk(subject('Anime inspired ring'))).toEqual({
      risk: 'review',
      matches: ['inspired', 'anime'],
    });
  });

  it('keeps generic motifs and jewelry terms low risk', () => {
    expect(assessIpRisk(subject('Halo engagement ring'))).toEqual({
      risk: 'low',
      matches: [],
    });
    expect(assessIpRisk(subject('Medieval wolf ring', ['dragon'])).risk).toBe(
      'low',
    );
  });
});
