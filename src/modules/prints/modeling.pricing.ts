import type { RevisionTerms } from '../../integrations/database/database.schema';
import { roundUp } from '../pricing/pricing.engine';
import type { PrintSettings } from './print.settings';

/**
 * Price of 3D modeling: the hours at the modeling rate, grossed up for the
 * tax and the payment fee and rounded up like print prices. The modeling
 * rate is already the price of the work, so no markup is added.
 */
export function modelingPrice(hours: number, settings: PrintSettings): number {
  const keep = Math.max(
    0.01,
    1 - settings.price.taxRate - settings.price.paymentFeeRate,
  );

  return roundUp(
    (Math.max(0, hours) * settings.modeling.hourlyRate) / keep,
    settings.price.roundingStep,
  );
}

/** Revisions included in a model price, from the current settings. */
export function revisionTerms(settings: PrintSettings): RevisionTerms {
  return {
    freeBig: settings.modeling.freeBigRevisions,
    freeSmall: settings.modeling.freeSmallRevisions,
    bigPrice: settings.modeling.bigRevisionPrice,
    smallPrice: settings.modeling.smallRevisionPrice,
  };
}
