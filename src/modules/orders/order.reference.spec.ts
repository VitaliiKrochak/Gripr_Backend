import { orderReference, parseOrderReference } from './order.reference';

describe('order references', () => {
  it('prefixes the shared number with the store', () => {
    expect(orderReference('gripr', 1042)).toBe('GR-1042');
    expect(orderReference('lab', 1043)).toBe('LAB-1043');
  });

  it('reads plain numbers and prefixed references', () => {
    expect(parseOrderReference('1043')).toEqual({ store: null, number: 1043 });
    expect(parseOrderReference(' LAB-1043 ')).toEqual({
      store: 'lab',
      number: 1043,
    });
    expect(parseOrderReference('gr1042')).toEqual({
      store: 'gripr',
      number: 1042,
    });
  });

  it('rejects unknown prefixes and other text', () => {
    expect(parseOrderReference('XX-1043')).toBeNull();
    expect(parseOrderReference('Олена')).toBeNull();
    expect(parseOrderReference('+380501234567')).toBeNull();
  });
});
