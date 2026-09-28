export interface PopularitySubject {
  id: string;
  group: string;
  likes: number;
  views: number;
  publishedAt: Date | null;
}

const WEIGHTS = { likes: 0.45, views: 0.25, velocity: 0.3 };
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
/** Age assumed for models without a publish date. */
const UNKNOWN_AGE_MONTHS = 12;

/** Mid-rank percentile (0-100) of each value within `values`. */
function percentiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);

  return values.map((value) => {
    if (values.length === 1) return 50;

    let below = 0;
    let equal = 0;

    for (const other of sorted) {
      if (other < value) below += 1;
      else if (other === value) equal += 1;
      else break;
    }

    return ((below + (equal - 1) / 2) / (values.length - 1)) * 100;
  });
}

function likesPerMonth(subject: PopularitySubject, now: Date): number {
  const months = subject.publishedAt
    ? Math.max(1, (now.getTime() - subject.publishedAt.getTime()) / MONTH_MS)
    : UNKNOWN_AGE_MONTHS;

  return subject.likes / months;
}

/**
 * 0-100 score from likes, views and like velocity, each ranked as a
 * percentile within the subject's group so old models don't dominate by
 * age alone and categories compete only with themselves.
 */
export function computePopularityScores(
  subjects: PopularitySubject[],
  now = new Date(),
): Map<string, number> {
  const groups = new Map<string, PopularitySubject[]>();

  for (const subject of subjects) {
    groups.set(subject.group, [...(groups.get(subject.group) ?? []), subject]);
  }

  const scores = new Map<string, number>();

  for (const members of groups.values()) {
    const likes = percentiles(members.map((member) => member.likes));
    const views = percentiles(members.map((member) => member.views));
    const velocity = percentiles(
      members.map((member) => likesPerMonth(member, now)),
    );

    members.forEach((member, index) => {
      scores.set(
        member.id,
        Math.round(
          likes[index] * WEIGHTS.likes +
            views[index] * WEIGHTS.views +
            velocity[index] * WEIGHTS.velocity,
        ),
      );
    });
  }

  return scores;
}
