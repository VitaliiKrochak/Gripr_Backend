import { modelingPrice, revisionTerms } from './modeling.pricing';
import { DEFAULT_PRINT_SETTINGS } from './print.settings';

describe('modeling pricing', () => {
  it('grosses the modeling hours up for the tax and the fee', () => {
    // 4 h × 500 UAH = 2 000 UAH; / (1 − 0.06 − 0.015) = 2 162.16 → 2 170 UAH.
    expect(modelingPrice(4, DEFAULT_PRINT_SETTINGS)).toBe(217_000);
    expect(modelingPrice(0, DEFAULT_PRINT_SETTINGS)).toBe(0);
  });

  it('takes the revision terms from the settings', () => {
    expect(revisionTerms(DEFAULT_PRINT_SETTINGS)).toEqual({
      freeBig: 1,
      freeSmall: 2,
      bigPrice: 100_000,
      smallPrice: 25_000,
    });
  });
});
