import { defaultGroupName, valueLabel } from './product.labels';

describe('product labels', () => {
  it('names size groups by the product sizing', () => {
    expect(defaultGroupName('size', 'ring')).toBe('Розмір');
    expect(defaultGroupName('size', 'chain')).toBe('Довжина');
    expect(defaultGroupName('coating', 'cufflinks')).toBe('Покриття');
  });

  it('derives value labels from referenced data', () => {
    expect(
      valueLabel('metal', 'ring', {}, { metal: { name: 'Срібло 925' } }),
    ).toBe('Срібло 925');
    expect(valueLabel('size', 'ring', { sizeValue: 17.5 }, {})).toBe('17.5');
    expect(valueLabel('size', 'chain', { sizeValue: 45 }, {})).toBe('45 см');
    expect(
      valueLabel(
        'stone',
        'ring',
        { stoneSizeMm: 1.5, stoneCarat: 0.02 },
        { gemstone: { name: 'Діамант' } },
      ),
    ).toBe('Діамант, 1.5 мм, 0.02 ct');
    expect(
      valueLabel('coating', 'ring', {}, { finishing: { name: 'Родіювання' } }),
    ).toBe('Родіювання');
  });

  it('prefers an explicit label and requires one for custom options', () => {
    expect(
      valueLabel(
        'metal',
        'ring',
        { label: ' Золото ' },
        { metal: { name: 'x' } },
      ),
    ).toBe('Золото');
    expect(valueLabel('custom', 'ring', {}, {})).toBeNull();
  });
});
