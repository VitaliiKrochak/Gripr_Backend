import { normalizeUkrainianPhone, toE164 } from './ukrainian.phone';

describe('normalizeUkrainianPhone', () => {
  it.each([
    ['380501234567', '380501234567'],
    ['+380 50 123 45 67', '380501234567'],
    ['0501234567', '380501234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeUkrainianPhone(input)).toBe(expected);
  });

  it.each(['48501234567', '38050123456', '+1 555 123 4567', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeUkrainianPhone(input)).toBeNull();
    },
  );

  it('formats E.164', () => {
    expect(toE164('380501234567')).toBe('+380501234567');
  });
});
