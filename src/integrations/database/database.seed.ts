import type { Database } from './database.client';
import {
  finishingOptions,
  gemstones,
  metals,
  productionStages,
} from './database.schema';
import type { FinishingKind, MetalFamily } from './database.schema';

const METALS: Array<{
  code: string;
  name: string;
  family: MetalFamily;
  purity: string;
  color: string;
}> = [
  {
    code: 'gold-585-yellow',
    name: 'Жовте золото 585',
    family: 'gold',
    purity: '585',
    color: 'yellow',
  },
  {
    code: 'gold-585-white',
    name: 'Біле золото 585',
    family: 'gold',
    purity: '585',
    color: 'white',
  },
  {
    code: 'gold-585-red',
    name: 'Червоне золото 585',
    family: 'gold',
    purity: '585',
    color: 'red',
  },
  {
    code: 'gold-750-yellow',
    name: 'Жовте золото 750',
    family: 'gold',
    purity: '750',
    color: 'yellow',
  },
  {
    code: 'gold-750-white',
    name: 'Біле золото 750',
    family: 'gold',
    purity: '750',
    color: 'white',
  },
  {
    code: 'silver-925',
    name: 'Срібло 925',
    family: 'silver',
    purity: '925',
    color: 'white',
  },
  {
    code: 'platinum-950',
    name: 'Платина 950',
    family: 'platinum',
    purity: '950',
    color: 'white',
  },
];

const GEMSTONES = [
  { code: 'diamond', name: 'Діамант', color: 'colorless' },
  { code: 'lab-diamond', name: 'Лабораторний діамант', color: 'colorless' },
  { code: 'sapphire', name: 'Сапфір', color: 'blue' },
  { code: 'emerald', name: 'Смарагд', color: 'green' },
  { code: 'ruby', name: 'Рубін', color: 'red' },
  { code: 'topaz', name: 'Топаз', color: 'blue' },
  { code: 'amethyst', name: 'Аметист', color: 'purple' },
  { code: 'pearl', name: 'Перли', color: 'white' },
  { code: 'cubic-zirconia', name: 'Фіаніт', color: 'colorless' },
];

const FINISHING_OPTIONS: Array<{
  code: string;
  kind: FinishingKind;
  name: string;
  description: string;
}> = [
  {
    code: 'mechanical-engraving',
    kind: 'engraving',
    name: 'Механічне гравіювання',
    description: 'Класичне гравіювання різцем.',
  },
  {
    code: 'laser-engraving',
    kind: 'engraving',
    name: 'Лазерне гравіювання',
    description: 'Точне гравіювання тексту або малюнка лазером.',
  },
  {
    code: 'rhodium',
    kind: 'coating',
    name: 'Родіювання',
    description: 'Захисне покриття родієм.',
  },
  {
    code: 'white-rhodium',
    kind: 'coating',
    name: 'Біле родіювання',
    description: 'Білий блиск і захист від потемніння.',
  },
  {
    code: 'black-rhodium',
    kind: 'coating',
    name: 'Чорне родіювання',
    description: 'Глибокий чорний колір поверхні.',
  },
  {
    code: 'ruthenium',
    kind: 'coating',
    name: 'Рутенування (чорний рутеній)',
    description: 'Темно-сіре або чорне покриття рутенієм.',
  },
  {
    code: 'enamel',
    kind: 'coating',
    name: 'Емаль',
    description: 'Кольорова ювелірна емаль.',
  },
  {
    code: 'oxidation',
    kind: 'coating',
    name: 'Оксидування (чорніння)',
    description: 'Затемнення поглиблень для підкреслення рельєфу.',
  },
  {
    code: 'pre-processing',
    kind: 'processing',
    name: 'Попередня обробка',
    description: 'Обробка виливка перед закріпленням каменів.',
  },
];

/**
 * Sort orders are explicit so stages added later slot between the ones
 * that already exist in a database.
 */
const PRODUCTION_STAGES = [
  {
    code: 'proposal',
    name: 'Підготовка пропозиції',
    description: 'Готуємо специфікацію та вартість виробу.',
    sortOrder: 1,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'proposal-approval',
    name: 'Очікує погодження',
    description: 'Чекаємо на ваше погодження пропозиції.',
    sortOrder: 2,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'model-payment',
    name: 'Очікує оплату моделі',
    description: 'Чекаємо на передоплату 3D-моделі.',
    sortOrder: 3,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'modeling',
    name: '3D-моделювання',
    description: 'Створюємо цифрову 3D-модель вашої прикраси.',
    sortOrder: 10,
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'model-approval',
    name: 'Погодження моделі',
    description: 'Надсилаємо рендер моделі для вашого погодження.',
    sortOrder: 20,
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'fitting-print',
    name: 'Примірочна модель',
    description:
      'Друкуємо пластикову модель на 3D-принтері, щоб перевірити посадку.',
    sortOrder: 30,
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'wax-print',
    name: 'Друк воскової / полімерної моделі',
    description: 'Друкуємо модель для лиття.',
    sortOrder: 35,
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'casting',
    name: 'Лиття металу',
    description: 'Відливаємо прикрасу з обраного металу.',
    sortOrder: 40,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'pre-processing',
    name: 'Попередня обробка',
    description: 'Очищуємо та готуємо виливок до подальших робіт.',
    sortOrder: 45,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'stone-setting',
    name: 'Закріплення каменів',
    description: 'Ювелір закріплює камені.',
    sortOrder: 50,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'engraving',
    name: 'Гравіювання',
    description: 'Наносимо гравіювання.',
    sortOrder: 53,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'coating',
    name: 'Покриття',
    description: 'Наносимо покриття: родій, рутеній, емаль тощо.',
    sortOrder: 56,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'polishing',
    name: 'Фінішна обробка',
    description: 'Шліфування та полірування.',
    sortOrder: 60,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'quality-check',
    name: 'Контроль якості',
    description: 'Фінальна перевірка перед відправленням.',
    sortOrder: 70,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'final-payment',
    name: 'Очікує фінальну оплату',
    description: 'Чекаємо на остаточну оплату.',
    sortOrder: 75,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'ready',
    name: 'Готово до відправлення',
    description: 'Прикраса готова та чекає на відправлення.',
    sortOrder: 80,
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'shipped',
    name: 'Відправлено',
    description: 'Посилку передано службі доставки.',
    sortOrder: 90,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
  {
    code: 'completed',
    name: 'Завершено',
    description: 'Замовлення виконано.',
    sortOrder: 100,
    defaultForCatalog: false,
    defaultForCustom: false,
  },
];

/** Inserts reference data; existing rows (matched by `code`) are left untouched. */
export async function seedDatabase(db: Database): Promise<void> {
  await db
    .insert(metals)
    .values(METALS.map((metal, index) => ({ ...metal, sortOrder: index })))
    .onConflictDoNothing({ target: metals.code });
  await db
    .insert(gemstones)
    .values(GEMSTONES.map((stone, index) => ({ ...stone, sortOrder: index })))
    .onConflictDoNothing({ target: gemstones.code });
  await db
    .insert(finishingOptions)
    .values(
      FINISHING_OPTIONS.map((option, index) => ({
        ...option,
        sortOrder: (index + 1) * 10,
      })),
    )
    .onConflictDoNothing({ target: finishingOptions.code });
  await db
    .insert(productionStages)
    .values(PRODUCTION_STAGES)
    .onConflictDoNothing({ target: productionStages.code });
}
