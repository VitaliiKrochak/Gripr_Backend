import type { Database } from './database.client';
import { gemstones, metals, productionStages } from './database.schema';

const METALS = [
  {
    code: 'gold-585-yellow',
    name: 'Жовте золото 585',
    purity: '585',
    color: 'yellow',
  },
  {
    code: 'gold-585-white',
    name: 'Біле золото 585',
    purity: '585',
    color: 'white',
  },
  {
    code: 'gold-585-red',
    name: 'Червоне золото 585',
    purity: '585',
    color: 'red',
  },
  {
    code: 'gold-750-yellow',
    name: 'Жовте золото 750',
    purity: '750',
    color: 'yellow',
  },
  {
    code: 'gold-750-white',
    name: 'Біле золото 750',
    purity: '750',
    color: 'white',
  },
  { code: 'silver-925', name: 'Срібло 925', purity: '925', color: 'white' },
  { code: 'platinum-950', name: 'Платина 950', purity: '950', color: 'white' },
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

const PRODUCTION_STAGES = [
  {
    code: 'modeling',
    name: '3D-моделювання',
    description: 'Створюємо цифрову 3D-модель вашої прикраси.',
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'model-approval',
    name: 'Погодження моделі',
    description: 'Надсилаємо рендер моделі для вашого погодження.',
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'fitting-print',
    name: 'Примірочна модель',
    description:
      'Друкуємо пластикову модель на 3D-принтері, щоб перевірити посадку.',
    defaultForCatalog: false,
    defaultForCustom: true,
  },
  {
    code: 'casting',
    name: 'Лиття металу',
    description: 'Відливаємо прикрасу з обраного металу.',
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'stone-setting',
    name: 'Закріплення каменів',
    description: 'Ювелір закріплює камені.',
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'polishing',
    name: 'Фінішна обробка',
    description: 'Шліфування, полірування та покриття.',
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'quality-check',
    name: 'Контроль якості',
    description: 'Фінальна перевірка перед відправленням.',
    defaultForCatalog: true,
    defaultForCustom: true,
  },
  {
    code: 'ready',
    name: 'Готово',
    description: 'Прикраса готова та чекає на відправлення.',
    defaultForCatalog: true,
    defaultForCustom: true,
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
    .insert(productionStages)
    .values(
      PRODUCTION_STAGES.map((stage, index) => ({
        ...stage,
        sortOrder: (index + 1) * 10,
      })),
    )
    .onConflictDoNothing({ target: productionStages.code });
}
