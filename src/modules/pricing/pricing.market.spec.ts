import { metalQuote, mergeSettings, purePricePerGram } from './pricing.market';
import { DEFAULT_PRICING_SETTINGS } from './pricing.settings';

describe('pricing market helpers', () => {
  const rates = new Map([
    ['XAU', 31103.4768],
    ['USD', 41.5],
  ]);

  it('converts ounce rates to kopiykas per gram', () => {
    expect(purePricePerGram('gold', rates)).toBeCloseTo(100_000);
    expect(purePricePerGram('silver', rates)).toBe(0);
    expect(purePricePerGram('other', rates)).toBe(0);
  });

  it('quotes a metal with its saved profile over the family defaults', () => {
    const quote = metalQuote(
      {
        code: 'gold-585-yellow',
        family: 'gold',
        purity: '585',
        pricingProfile: { marginPerGram: 1 } as never,
      },
      rates,
    );

    expect(quote.fineness).toBe(585);
    expect(quote.profile.marginPerGram).toBe(1);
    expect(quote.profile.laborRateBasic).toBe(70_000);
  });

  it('fills missing settings from the defaults and keeps saved arrays', () => {
    const settings = mergeSettings({
      taxRate: 0.05,
      scenarios: { safe: { risk: 0.07 } },
      waxPrintTiers: [{ upToCm3: 2, usdPerCm3: 20 }],
    });

    expect(settings.taxRate).toBe(0.05);
    expect(settings.scenarios.safe).toEqual({
      ...DEFAULT_PRICING_SETTINGS.scenarios.safe,
      risk: 0.07,
    });
    expect(settings.scenarios.minimal).toEqual(
      DEFAULT_PRICING_SETTINGS.scenarios.minimal,
    );
    expect(settings.waxPrintTiers).toEqual([{ upToCm3: 2, usdPerCm3: 20 }]);
    expect(mergeSettings(null)).toEqual(DEFAULT_PRICING_SETTINGS);
  });
});
