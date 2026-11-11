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

  it('blocks game, film, and anime franchises in Lab miniatures', () => {
    expect(
      assessIpRisk(subject('Space Marine captain', ['40k']), 'lab'),
    ).toEqual({ risk: 'blocked', matches: ['space marine'] });
    expect(assessIpRisk(subject('Beholder miniature'), 'lab').risk).toBe(
      'blocked',
    );
    expect(assessIpRisk(subject('Pokémon trainer figure'), 'lab').risk).toBe(
      'blocked',
    );
  });

  it('reviews tabletop fan signals but not generic game words for Lab', () => {
    expect(
      assessIpRisk(subject('Orc warrior', ['dnd', 'tabletop game']), 'lab'),
    ).toEqual({ risk: 'review', matches: ['dnd'] });
    expect(
      assessIpRisk(subject('Goblin archer', ['tabletop game']), 'lab'),
    ).toEqual({ risk: 'low', matches: [] });
    expect(assessIpRisk(subject('Goblin archer', ['tabletop game'])).risk).toBe(
      'review',
    );
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
