import { canTransitionCustomRequest } from './custom.request.status';

describe('canTransitionCustomRequest', () => {
  it.each([
    ['new', 'quoted', true],
    ['quoted', 'quoted', true],
    ['quoted', 'accepted', true],
    ['new', 'accepted', false],
    ['in_review', 'declined', true],
    ['accepted', 'declined', false],
    ['rejected', 'quoted', false],
    ['declined', 'in_review', false],
    ['quoted', 'changes_requested', true],
    ['changes_requested', 'quoted', true],
    ['changes_requested', 'accepted', false],
    ['new', 'changes_requested', false],
  ] as const)('%s -> %s is %s', (from, to, allowed) => {
    expect(canTransitionCustomRequest(from, to)).toBe(allowed);
  });
});
