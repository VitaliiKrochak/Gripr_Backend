import type { MetalFamily } from '../../integrations/database/database.schema';
import type {
  LaborType,
  MetalPricingProfile,
  PricingScenario,
  PricingSettings,
  ScenarioRates,
  ServiceCategory,
  SettingType,
  StoneCut,
  Worker,
} from './pricing.settings';

/**
 * Pure price calculation of a jewelry item and its 3D model, following the
 * workshop pricing sheet. All money is in kopiykas, all rates are fractions.
 *
 * Every line has a protected cost, a customer price, and a discount base: a
 * discount reduces only the part the business controls (margins), never the
 * metal purchase, the metal buffer, casting, delivery, or the pay of the
 * people doing the work.
 */

export const TROY_OUNCE_GRAMS = 31.1034768;

export interface MetalQuote {
  family: MetalFamily;
  /** Parts per thousand, e.g. 585. */
  fineness: number;
  /** Market price of the pure metal, kopiykas per gram. */
  purePricePerGram: number;
  profile: MetalPricingProfile;
}

export interface ItemServiceInput {
  category: ServiceCategory;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  /** Outside contractors get the scenario markup on top of the price. */
  external: boolean;
}

export interface ItemStoneInput {
  quantity: number;
  /** Purchase price per stone. */
  purchasePrice: number;
  settingType: SettingType | null;
  cut: StoneCut | null;
  sizeMm: number | null;
  /** Customer-supplied stone: no stone sale, the setting stays paid. */
  clientOwned: boolean;
  /** Paid per stone to a hired or outside setter. */
  settingCost: number;
}

export interface ItemFittingInput {
  quantity: number;
  unitCost: number;
  /** Customer price per unit; `null` applies the fittings markup. */
  unitPrice: number | null;
  clientOwned: boolean;
}

/** Manual replacements of automatic values; `null` keeps the automatic one. */
export interface ItemOverrides {
  alloyPricePerGram?: number | null;
  marginPerGram?: number | null;
  lossRate?: number | null;
  metalBuffer?: number | null;
  externalMarkup?: number | null;
  overhead?: number | null;
  risk?: number | null;
  roundingStep?: number | null;
  minProfit?: number | null;
}

export interface ItemInput {
  metal: MetalQuote | null;
  /** The customer supplies the metal: no purchase and no metal margin. */
  clientMetal: boolean;
  /** Approved finished weight in grams. */
  weightGrams: number;
  laborType: LaborType;
  laborHours: number;
  jeweler: Worker;
  setter: Worker;
  scenario: PricingScenario;
  urgency: number;
  discount: number;
  extraProfit: number;
  delivery: number;
  packaging: number;
  consumables: number;
  services: ItemServiceInput[];
  stones: ItemStoneInput[];
  fittings: ItemFittingInput[];
  overrides: ItemOverrides;
}

export const ITEM_LINE_KEYS = [
  'metal',
  'metalBuffer',
  'metalMargin',
  'casting',
  'waxPrint',
  'rubber',
  'coating',
  'engraving',
  'otherServices',
  'stones',
  'setting',
  'fittings',
  'labor',
  'delivery',
  'packaging',
  'consumables',
  'overhead',
  'risk',
  'extraProfit',
  'minProfit',
] as const;
export type ItemLineKey = (typeof ITEM_LINE_KEYS)[number];

export interface PriceLine {
  key: ItemLineKey;
  /** Protected cost that a discount never reduces. */
  cost: number;
  /** Customer price before the discount. */
  price: number;
  /** Part of the price a discount may reduce. */
  discountBase: number;
  discount: number;
  /** Customer price after the discount. */
  final: number;
}

export const MARGIN_STATUSES = [
  'critical',
  'acceptable',
  'good',
  'strong',
] as const;
export type MarginStatus = (typeof MARGIN_STATUSES)[number];

export interface ItemResult {
  lines: PriceLine[];
  /** Effective parameters after overrides and the scenario. */
  parameters: {
    alloyPricePerGram: number;
    marginPerGram: number;
    lossRate: number;
    rates: ScenarioRates;
    roundingStep: number;
    minProfit: number;
    castingCostPerGram: number;
    castingPricePerGram: number;
    laborRatePerHour: number;
  };
  purchaseWeightGrams: number;
  lossGrams: number;
  costTotal: number;
  /** Sum of the line prices before tax and payment fee. */
  subtotal: number;
  priceBeforeDiscount: number;
  discount: number;
  finalPrice: number;
  tax: number;
  paymentFee: number;
  ownerPay: number;
  hiredWages: number;
  businessProfit: number;
  margin: number;
  marginStatus: MarginStatus;
  /** The business profit is below the configured minimum. */
  belowMinProfit: boolean;
  prepayment: number;
  remainder: number;
}

export interface ModelInput {
  hours: number;
  designer: Worker;
  freeRevisions: number;
  usedRevisions: number;
  /** Price of one paid revision; `null` uses the settings. */
  revisionPrice: number | null;
  discount: number;
  minPrice: number | null;
  roundingStep: number | null;
}

export interface ModelResult {
  designerPay: number;
  ownerPay: number;
  hiredWage: number;
  businessFixed: number;
  businessMarkup: number;
  minimumTopUp: number;
  paidRevisions: number;
  revisionsPrice: number;
  discountBase: number;
  priceBeforeDiscount: number;
  discount: number;
  finalPrice: number;
  tax: number;
  paymentFee: number;
  businessProfit: number;
  margin: number;
  marginStatus: MarginStatus;
  prepayment: number;
  remainder: number;
}

export interface ProjectResult {
  totalPrice: number;
  discount: number;
  tax: number;
  paymentFee: number;
  netRevenue: number;
  hiredWages: number;
  ownerPay: number;
  businessProfit: number;
  ownersIncome: number;
  margin: number;
  marginStatus: MarginStatus;
  payments: Array<{
    key:
      'modelPrepayment' | 'modelRemainder' | 'itemPrepayment' | 'itemRemainder';
    amount: number;
  }>;
}

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
const positive = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const pick = (override: number | null | undefined, fallback: number) =>
  override == null ? fallback : override;

/** Rounds kopiykas up to the step, ignoring sub-kopiyka noise first. */
export function roundUp(amount: number, step: number): number {
  const kopiykas = Math.round(amount);

  if (kopiykas <= 0) {
    return 0;
  }

  return step > 0 ? Math.ceil(kopiykas / step) * step : kopiykas;
}

/** Splits a final price that already includes tax and the payment fee. */
function grossUp(net: number, settings: PricingSettings, step: number) {
  const share = 1 - settings.taxRate - settings.paymentFeeRate;
  return share <= 0 ? 0 : roundUp(net / share, step);
}

export function marginStatus(margin: number): MarginStatus {
  if (margin < 0.2) return 'critical';
  if (margin < 0.3) return 'acceptable';
  if (margin < 0.4) return 'good';
  return 'strong';
}

/** Alloy price per gram: pure metal by fineness, plus ligature and supplier markup. */
export function alloyPricePerGram(metal: MetalQuote): number {
  const pureShare = metal.fineness / 1000;
  const cost =
    metal.purePricePerGram * pureShare +
    metal.profile.ligaturePerGram * (1 - pureShare);
  return cost * (1 + metal.profile.purchaseMarkup);
}

/** Casting tariff of the workshop and the price passed to the customer, per gram. */
export function castingTariff(
  metal: MetalQuote,
  settings: PricingSettings,
): { cost: number; price: number } {
  const cost =
    metal.purePricePerGram * metal.profile.castingSpotShare +
    metal.profile.castingFixedPerGram;
  // Customer tariffs are whole 5 UAH steps.
  return { cost, price: roundUp(cost * (1 + settings.castingMarkup), 500) };
}

/** Cost of printing wax by volume, or `null` when the volume needs a manual price. */
export function waxPrintCost(
  volumeCm3: number,
  settings: PricingSettings,
  usdRate: number,
): number | null {
  if (volumeCm3 < 0.01) {
    return null;
  }

  const tier = settings.waxPrintTiers.find((t) => volumeCm3 <= t.upToCm3);
  return tier ? tier.usdPerCm3 * usdRate * 100 : null;
}

function sizeFactor(sizeMm: number | null, settings: PricingSettings): number {
  if (sizeMm == null) {
    return 1;
  }

  const tier = settings.sizeFactors.find(
    (t) => t.upToMm == null || sizeMm <= t.upToMm,
  );
  return tier?.factor ?? 1;
}

/** Customer price of setting one stone. */
export function settingPrice(
  stone: Pick<ItemStoneInput, 'settingType' | 'cut' | 'sizeMm' | 'clientOwned'>,
  family: MetalFamily,
  settings: PricingSettings,
): number {
  if (!stone.settingType) {
    return 0;
  }

  const base = settings.settingRates[stone.settingType]?.[family] ?? 0;
  const cut = stone.cut ? (settings.cutFactors[stone.cut] ?? 1) : 1;
  const risk = stone.clientOwned ? 1 + settings.clientStoneRisk : 1;
  return base * cut * sizeFactor(stone.sizeMm, settings) * risk;
}

export function calculateItem(
  input: ItemInput,
  settings: PricingSettings,
): ItemResult {
  const scenario = settings.scenarios[input.scenario];
  const rates: ScenarioRates = {
    metalBuffer: pick(input.overrides.metalBuffer, scenario.metalBuffer),
    externalMarkup: pick(
      input.overrides.externalMarkup,
      scenario.externalMarkup,
    ),
    overhead: pick(input.overrides.overhead, scenario.overhead),
    risk: pick(input.overrides.risk, scenario.risk),
  };
  const lossRate = pick(input.overrides.lossRate, settings.lossRate);
  const roundingStep = pick(
    input.overrides.roundingStep,
    settings.roundingStep,
  );
  const minProfit = pick(input.overrides.minProfit, settings.minProfit);
  const metal = input.metal;
  const family: MetalFamily = metal?.family ?? 'other';
  const profile = metal?.profile;

  const weight = positive(input.weightGrams);
  const purchaseWeight = lossRate < 1 ? weight / (1 - lossRate) : weight;
  const alloy = pick(
    input.overrides.alloyPricePerGram,
    metal ? alloyPricePerGram(metal) : 0,
  );
  const marginPerGram = pick(
    input.overrides.marginPerGram,
    profile?.marginPerGram ?? 0,
  );
  const casting = metal
    ? castingTariff(metal, settings)
    : { cost: 0, price: 0 };

  const lines = new Map<
    ItemLineKey,
    Omit<PriceLine, 'key' | 'discount' | 'final'>
  >();
  const line = (key: ItemLineKey, cost: number, price: number, base = 0) =>
    lines.set(key, { cost, price, discountBase: positive(base) });

  const metalCost = input.clientMetal ? 0 : purchaseWeight * alloy;
  line('metal', metalCost, metalCost);
  line(
    'metalBuffer',
    metalCost * rates.metalBuffer,
    metalCost * rates.metalBuffer,
  );
  const margin = input.clientMetal ? 0 : weight * marginPerGram;
  line('metalMargin', 0, margin, margin);
  line(
    'casting',
    casting.cost * purchaseWeight,
    casting.price * purchaseWeight * (1 + rates.externalMarkup),
  );

  const serviceLine = (key: ItemLineKey, category: ServiceCategory) => {
    const rows = input.services.filter((s) => s.category === category);
    const cost = sum(
      rows.map((s) => positive(s.quantity) * positive(s.unitCost)),
    );
    const price = sum(
      rows.map(
        (s) =>
          positive(s.quantity) *
          positive(s.unitPrice) *
          (s.external ? 1 + rates.externalMarkup : 1),
      ),
    );
    line(key, cost, price, price - cost);
  };
  serviceLine('waxPrint', 'wax_print');
  serviceLine('rubber', 'rubber');
  serviceLine('coating', 'coating');
  serviceLine('engraving', 'engraving');
  serviceLine('otherServices', 'other');

  const stoneCost = sum(
    input.stones.map((s) =>
      s.clientOwned ? 0 : positive(s.quantity) * positive(s.purchasePrice),
    ),
  );
  line(
    'stones',
    stoneCost,
    stoneCost * (1 + settings.stoneMarkup),
    stoneCost * settings.stoneMarkup,
  );

  let settingCost = 0;
  let settingMargin = 0;

  for (const stone of input.stones) {
    const quantity = positive(stone.quantity);
    const cost = quantity * positive(stone.settingCost);
    const price = quantity * settingPrice(stone, family, settings);
    settingCost += cost;
    settingMargin += Math.max(0, price - cost);
  }

  const ownerSetting = input.setter === 'owner' ? settingMargin : 0;
  line(
    'setting',
    settingCost,
    settingCost + settingMargin,
    settingMargin - ownerSetting,
  );

  const fittingCost = sum(
    input.fittings.map((f) =>
      f.clientOwned ? 0 : positive(f.quantity) * positive(f.unitCost),
    ),
  );
  const fittingPrice = sum(
    input.fittings.map((f) => {
      if (f.clientOwned) return 0;
      const quantity = positive(f.quantity);
      return f.unitPrice == null
        ? quantity * positive(f.unitCost) * (1 + settings.fittingsMarkup)
        : quantity * positive(f.unitPrice);
    }),
  );
  line('fittings', fittingCost, fittingPrice, fittingPrice - fittingCost);

  const hours = input.laborType === 'none' ? 0 : positive(input.laborHours);
  const hired = input.jeweler === 'hired';
  const laborRate =
    hours === 0
      ? 0
      : hired
        ? settings.jeweler.hired.ratePerHour
        : input.laborType === 'complex'
          ? (profile?.laborRateComplex ?? 0)
          : (profile?.laborRateBasic ?? 0);
  const businessPerHour =
    hours > 0 && hired ? settings.jeweler.hired.businessPerHour : 0;
  const laborMarkup = hired
    ? settings.jeweler.hired.markup
    : settings.jeweler.ownerMarkup;
  const minLabor =
    hours === 0
      ? 0
      : input.laborType === 'complex'
        ? (profile?.minLaborComplex ?? 0)
        : (profile?.minLaborBasic ?? 0);
  const laborPay = hours * laborRate;
  const laborPrice =
    hours === 0
      ? 0
      : Math.max(
          (laborPay + hours * businessPerHour) * (1 + laborMarkup),
          minLabor,
        );
  const hiredLabor = hired ? laborPay : 0;
  const ownerLabor = hired ? 0 : laborPay;
  line('labor', hiredLabor, laborPrice, laborPrice - hiredLabor - ownerLabor);

  line('delivery', positive(input.delivery), positive(input.delivery));
  line('packaging', positive(input.packaging), positive(input.packaging));
  line('consumables', positive(input.consumables), positive(input.consumables));

  const costOf = (keys: ItemLineKey[]) =>
    sum(keys.map((k) => lines.get(k)?.cost ?? 0));
  const overhead =
    rates.overhead *
    costOf([
      'casting',
      'waxPrint',
      'rubber',
      'coating',
      'engraving',
      'otherServices',
      'stones',
      'setting',
      'fittings',
      'labor',
      'delivery',
      'packaging',
      'consumables',
    ]);
  line('overhead', overhead, overhead);
  const risk =
    rates.risk *
    costOf([
      'metal',
      'metalBuffer',
      'metalMargin',
      'casting',
      'waxPrint',
      'rubber',
      'coating',
      'engraving',
      'otherServices',
      'stones',
      'setting',
      'fittings',
    ]);
  line('risk', risk, risk);
  line(
    'extraProfit',
    0,
    positive(input.extraProfit),
    positive(input.extraProfit),
  );

  const discountRate = Math.min(1, positive(input.discount));
  const priced = [...lines.entries()].map(([key, value]) => {
    const discount = value.discountBase * discountRate;
    return { key, ...value, discount, final: value.price - discount };
  });
  const ownerPay = ownerLabor + ownerSetting;
  const marginBeforeMinimum =
    sum(priced.map((l) => l.final)) - sum(priced.map((l) => l.cost)) - ownerPay;
  const topUp = Math.max(0, minProfit - marginBeforeMinimum);
  priced.push({
    key: 'minProfit',
    cost: 0,
    price: topUp,
    discountBase: 0,
    discount: 0,
    final: topUp,
  });

  const costTotal = sum(priced.map((l) => l.cost));
  const subtotal = sum(priced.map((l) => l.price));
  const urgency = positive(input.urgency);
  const priceBeforeDiscount =
    subtotal === 0
      ? 0
      : grossUp(subtotal * (1 + urgency), settings, roundingStep);
  const afterDiscount = sum(priced.map((l) => l.final));
  const finalPrice =
    afterDiscount === 0
      ? 0
      : grossUp(afterDiscount * (1 + urgency), settings, roundingStep);
  const tax = finalPrice * settings.taxRate;
  const paymentFee = finalPrice * settings.paymentFeeRate;
  const businessProfit = Math.max(
    0,
    finalPrice - tax - paymentFee - costTotal - ownerPay,
  );
  const itemMargin = finalPrice === 0 ? 0 : businessProfit / finalPrice;
  const prepayment =
    finalPrice === 0
      ? 0
      : Math.round((finalPrice * settings.itemPrepayment) / 100) * 100;

  return {
    lines: priced,
    parameters: {
      alloyPricePerGram: alloy,
      marginPerGram,
      lossRate,
      rates,
      roundingStep,
      minProfit,
      castingCostPerGram: casting.cost,
      castingPricePerGram: casting.price,
      laborRatePerHour: laborRate,
    },
    purchaseWeightGrams: purchaseWeight,
    lossGrams: purchaseWeight - weight,
    costTotal,
    subtotal,
    priceBeforeDiscount,
    discount: Math.max(0, priceBeforeDiscount - finalPrice),
    finalPrice,
    tax,
    paymentFee,
    ownerPay,
    hiredWages: hiredLabor,
    businessProfit,
    margin: itemMargin,
    marginStatus: marginStatus(itemMargin),
    belowMinProfit: finalPrice > 0 && businessProfit + 1 < minProfit,
    prepayment,
    remainder: Math.max(0, finalPrice - prepayment),
  };
}

export function calculateModel(
  input: ModelInput,
  settings: PricingSettings,
): ModelResult {
  const rates =
    input.designer === 'hired'
      ? settings.modeling.hired
      : settings.modeling.owner;
  const hours = positive(input.hours);
  const step = pick(input.roundingStep, settings.roundingStep);
  const designerPay = hours * rates.ratePerHour;
  const businessFixed =
    input.designer === 'hired' ? hours * rates.businessPerHour : 0;
  const businessMarkup = (designerPay + businessFixed) * rates.markup;
  const minPrice = pick(input.minPrice, settings.modeling.minPrice);
  const minimumTopUp =
    hours === 0
      ? 0
      : Math.max(0, minPrice - (designerPay + businessFixed + businessMarkup));
  const paidRevisions = Math.max(
    0,
    positive(input.usedRevisions) - positive(input.freeRevisions),
  );
  const revisionsPrice =
    paidRevisions * pick(input.revisionPrice, settings.modeling.revisionPrice);
  const discountBase =
    businessFixed + businessMarkup + minimumTopUp + revisionsPrice;
  const discount = discountBase * Math.min(1, positive(input.discount));
  const beforeDiscount = designerPay + discountBase;
  const afterDiscount = beforeDiscount - discount;
  const initialModel = afterDiscount - revisionsPrice;

  const finalPrice =
    afterDiscount === 0 ? 0 : grossUp(afterDiscount, settings, step);
  const priceBeforeDiscount =
    beforeDiscount === 0 ? 0 : grossUp(beforeDiscount, settings, step);
  const tax = finalPrice * settings.taxRate;
  const paymentFee = finalPrice * settings.paymentFeeRate;
  const businessProfit = Math.max(
    0,
    finalPrice - tax - paymentFee - designerPay,
  );
  const margin = finalPrice === 0 ? 0 : businessProfit / finalPrice;
  const prepayment =
    initialModel === 0
      ? 0
      : Math.round(
          (grossUp(initialModel, settings, step) *
            settings.modeling.prepayment) /
            100,
        ) * 100;

  return {
    designerPay,
    ownerPay: input.designer === 'owner' ? designerPay : 0,
    hiredWage: input.designer === 'hired' ? designerPay : 0,
    businessFixed,
    businessMarkup,
    minimumTopUp,
    paidRevisions,
    revisionsPrice,
    discountBase,
    priceBeforeDiscount,
    discount: Math.max(0, priceBeforeDiscount - finalPrice),
    finalPrice,
    tax,
    paymentFee,
    businessProfit,
    margin,
    marginStatus: marginStatus(margin),
    prepayment,
    remainder: Math.max(0, finalPrice - prepayment),
  };
}

/** Combines the 3D model and the item into one project with four payments. */
export function combineProject(
  item: ItemResult,
  model: ModelResult | null,
): ProjectResult {
  const totalPrice = item.finalPrice + (model?.finalPrice ?? 0);
  const tax = item.tax + (model?.tax ?? 0);
  const paymentFee = item.paymentFee + (model?.paymentFee ?? 0);
  const ownerPay = item.ownerPay + (model?.ownerPay ?? 0);
  const businessProfit = item.businessProfit + (model?.businessProfit ?? 0);
  const margin = totalPrice === 0 ? 0 : businessProfit / totalPrice;

  return {
    totalPrice,
    discount: item.discount + (model?.discount ?? 0),
    tax,
    paymentFee,
    netRevenue: totalPrice - tax - paymentFee,
    hiredWages: item.hiredWages + (model?.hiredWage ?? 0),
    ownerPay,
    businessProfit,
    ownersIncome: ownerPay + businessProfit,
    margin,
    marginStatus: marginStatus(margin),
    payments: [
      ...(model
        ? [
            { key: 'modelPrepayment' as const, amount: model.prepayment },
            { key: 'modelRemainder' as const, amount: model.remainder },
          ]
        : []),
      { key: 'itemPrepayment' as const, amount: item.prepayment },
      { key: 'itemRemainder' as const, amount: item.remainder },
    ],
  };
}

/**
 * Customer price of one extra gram of finished metal in the default scenario.
 * Used as the metal price per gram, so size and weight changes are priced
 * with the same rules as the whole item.
 */
export function marginalPricePerGram(
  metal: MetalQuote,
  settings: PricingSettings,
): number {
  const rates = settings.scenarios[settings.defaultScenario];
  const share = 1 - settings.taxRate - settings.paymentFeeRate;

  if (share <= 0 || settings.lossRate >= 1) {
    return 0;
  }

  const perFinishedGram = 1 / (1 - settings.lossRate);
  const alloy = alloyPricePerGram(metal) * perFinishedGram;
  const casting = castingTariff(metal, settings);
  const metalWithBuffer = alloy * (1 + rates.metalBuffer);
  const castingCost = casting.cost * perFinishedGram;
  const net =
    metalWithBuffer +
    metal.profile.marginPerGram +
    casting.price * perFinishedGram * (1 + rates.externalMarkup) +
    castingCost * rates.overhead +
    (metalWithBuffer + castingCost) * rates.risk;

  return Math.round(net / share);
}
