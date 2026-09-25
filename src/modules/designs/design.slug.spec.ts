import { designSlug } from './design.slug';

describe('designSlug', () => {
  it('builds a latin slug with a short source id', () => {
    expect(designSlug('Dragon Ring (v2)!', 'AbC123def')).toBe(
      'dragon-ring-v2-abc123',
    );
  });

  it('transliterates cyrillic and strips accents', () => {
    expect(designSlug('Каблучка з їжаком', 'x1')).toBe(
      'kabluchka-z-yizhakom-x1',
    );
    expect(designSlug('Crème brûlée pendant', 'x1')).toBe(
      'creme-brulee-pendant-x1',
    );
  });

  it('falls back when the title has no usable characters', () => {
    expect(designSlug('★★★', 'abcdef99')).toBe('design-abcdef');
  });

  it('limits the length', () => {
    expect(designSlug('a '.repeat(100), 'abcdef').length).toBeLessThanOrEqual(
      87,
    );
  });
});
