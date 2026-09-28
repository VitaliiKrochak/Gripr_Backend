import type { ProductType } from '../../integrations/database/database.schema';

export interface RelevanceSubject {
  title: string;
  tags: string[];
  description: string | null;
}

export interface RelevanceResult {
  /** 0-100; how likely the model is wearable jewelry. */
  score: number;
  suggestedType: ProductType | null;
}

/** Models scoring below this are not stored at all. */
export const MIN_RELEVANCE = 40;

const TYPE_TERMS: Record<Exclude<ProductType, 'other'>, string[]> = {
  ring: ['ring', 'rings', 'signet', 'engagement ring', 'wedding ring'],
  earrings: ['earring', 'earrings', 'ear stud', 'studs', 'hoop earrings'],
  pendant: ['pendant', 'charm', 'amulet', 'medallion', 'locket', 'talisman'],
  necklace: ['necklace', 'choker', 'chain necklace'],
  bracelet: ['bracelet', 'bangle', 'cuff bracelet'],
  brooch: ['brooch'],
};

const GENERAL_TERMS = [
  'jewelry',
  'jewellery',
  'jewel',
  'gemstone',
  'gem',
  'diamond',
  'gold',
  'silver',
];

const NEGATIVE_TERMS = [
  'game asset',
  'game ready',
  'low poly',
  'lowpoly',
  'character',
  'figurine',
  'miniature',
  'animation',
  'animated',
  'rigged',
  'environment',
  'vehicle',
  'weapon',
  'building',
  'scene',
  'boxing ring',
  'onion ring',
  'key ring',
  'keyring',
  'piston ring',
  'ring light',
  'o-ring',
];

const WEIGHTS = {
  type: { title: 40, tags: 25, description: 10 },
  general: { title: 15, tags: 10, description: 5 },
  negative: { title: 30, tags: 30, description: 10 },
};

type Field = 'title' | 'tags' | 'description';

function normalize(value: string): string {
  return ` ${value.toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ')} `;
}

function contains(text: string, term: string): boolean {
  return text.includes(` ${term} `);
}

/** Keyword scoring over title, tags and description. */
export function scoreRelevance(subject: RelevanceSubject): RelevanceResult {
  const fields: Record<Field, string> = {
    title: normalize(subject.title),
    tags: normalize(subject.tags.join(' , ')),
    description: normalize(subject.description ?? ''),
  };
  const fieldNames = Object.keys(fields) as Field[];
  const hits = (terms: string[], field: Field) =>
    terms.some((term) => contains(fields[field], term));

  let score = 0;
  let bestType: ProductType | null = null;
  let bestTypeScore = 0;

  for (const [type, terms] of Object.entries(TYPE_TERMS)) {
    const typeScore = fieldNames.reduce(
      (sum, field) => sum + (hits(terms, field) ? WEIGHTS.type[field] : 0),
      0,
    );

    if (typeScore > bestTypeScore) {
      bestTypeScore = typeScore;
      bestType = type as ProductType;
    }
  }

  score += bestTypeScore;

  for (const field of fieldNames) {
    if (hits(GENERAL_TERMS, field)) score += WEIGHTS.general[field];
    if (hits(NEGATIVE_TERMS, field)) score -= WEIGHTS.negative[field];
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    suggestedType: bestType,
  };
}
