import { nextPaymentStatus } from './payment.status';

describe('nextPaymentStatus', () => {
  it.each([
    ['pending', 'success', 'success'],
    ['failure', 'success', 'success'],
    ['success', 'success', null],
    ['pending', 'failure', 'failure'],
    ['success', 'failure', null],
    ['success', 'reversed', 'reversed'],
    ['pending', 'reversed', null],
    ['reversed', 'success', null],
    ['pending', 'pending', null],
  ] as const)('%s + %s -> %s', (current, outcome, expected) => {
    expect(nextPaymentStatus(current, outcome)).toBe(expected);
  });
});
