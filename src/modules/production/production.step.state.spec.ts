import { stepDates } from './production.step.state';

describe('stepDates', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const earlier = new Date('2026-09-20T10:00:00Z');
  const empty = { startedAt: null, completedAt: null };

  it('starts a step once', () => {
    expect(stepDates(empty, 'in_progress', now)).toEqual({
      startedAt: now,
      completedAt: null,
    });
    expect(
      stepDates({ startedAt: earlier, completedAt: null }, 'in_progress', now),
    ).toEqual({ startedAt: earlier, completedAt: null });
  });

  it('completes a step and fills a missing start date', () => {
    expect(stepDates(empty, 'done', now)).toEqual({
      startedAt: now,
      completedAt: now,
    });
    expect(
      stepDates({ startedAt: earlier, completedAt: earlier }, 'done', now),
    ).toEqual({ startedAt: earlier, completedAt: earlier });
  });

  it('reopens a completed step', () => {
    expect(
      stepDates({ startedAt: earlier, completedAt: now }, 'in_progress', now),
    ).toEqual({ startedAt: earlier, completedAt: null });
  });

  it('resets dates for pending steps', () => {
    expect(
      stepDates({ startedAt: earlier, completedAt: now }, 'pending', now),
    ).toEqual(empty);
  });
});
