import type {
  ProductionStep,
  ProductionStepState,
} from '../../integrations/database/database.schema';

type StepDates = Pick<ProductionStep, 'startedAt' | 'completedAt'>;

/** Start/completion dates after moving a step to `state`. */
export function stepDates(
  current: StepDates,
  state: ProductionStepState,
  now = new Date(),
): StepDates {
  switch (state) {
    case 'pending':
      return { startedAt: null, completedAt: null };
    case 'in_progress':
      return { startedAt: current.startedAt ?? now, completedAt: null };
    case 'done':
      return {
        startedAt: current.startedAt ?? now,
        completedAt: current.completedAt ?? now,
      };
    case 'skipped':
      return { startedAt: current.startedAt, completedAt: null };
  }
}
