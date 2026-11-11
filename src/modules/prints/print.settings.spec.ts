import {
  consumablesPerPlate,
  DEFAULT_PRINT_SETTINGS,
  mergePrintSettings,
} from './print.settings';

describe('print settings', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(mergePrintSettings(undefined)).toEqual(DEFAULT_PRINT_SETTINGS);
  });

  it('keeps defaults for settings missing from the stored row', () => {
    const settings = mergePrintSettings({
      work: { hourlyRate: 7000 },
      consumables: [],
    });

    expect(settings.work.hourlyRate).toBe(7000);
    expect(settings.work.postProcessingMinutes).toEqual(
      DEFAULT_PRINT_SETTINGS.work.postProcessingMinutes,
    );
    expect(settings.consumables).toEqual([]);
    expect(settings.price).toEqual(DEFAULT_PRINT_SETTINGS.price);
  });

  it('costs consumables per plate from their packs', () => {
    expect(consumablesPerPlate(DEFAULT_PRINT_SETTINGS.consumables)).toBe(2000);
    expect(
      consumablesPerPlate([
        { name: 'x', packPrice: 1000, packSize: 0, perPlate: 1, unit: 'шт' },
      ]),
    ).toBe(0);
  });
});
