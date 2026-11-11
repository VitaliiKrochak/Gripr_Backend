import type {
  DesignIpRisk,
  Store,
} from '../../integrations/database/database.schema';

export interface IpSubject {
  title: string;
  tags: string[];
  description: string | null;
}

export interface IpAssessment {
  risk: DesignIpRisk;
  matches: string[];
}

/**
 * Franchises, characters and jewelry brands whose designs are protected
 * regardless of the license an uploader chose.
 */
const BLOCKED_TERMS = [
  'pokemon',
  'pikachu',
  'marvel',
  'avengers',
  'iron man',
  'spider-man',
  'spiderman',
  'batman',
  'superman',
  'wonder woman',
  'dc comics',
  'witcher',
  'geralt',
  'star wars',
  'jedi',
  'mandalorian',
  'disney',
  'mickey mouse',
  'pixar',
  'harry potter',
  'hogwarts',
  'deathly hallows',
  'lotr',
  'lord of the rings',
  'the one ring',
  'hobbit',
  'tolkien',
  'game of thrones',
  'targaryen',
  'cyberpunk',
  'zelda',
  'triforce',
  'nintendo',
  'super mario',
  'sonic the hedgehog',
  'minecraft',
  'fortnite',
  'overwatch',
  'league of legends',
  'naruto',
  'one piece',
  'dragon ball',
  'sailor moon',
  'hello kitty',
  'transformers',
  'warhammer',
  'games workshop',
  'space marine',
  'space marines',
  'age of sigmar',
  'adeptus',
  'dungeons and dragons',
  'dungeons dragons',
  'beholder',
  'mind flayer',
  'illithid',
  'displacer beast',
  'drizzt',
  'baldurs gate',
  'critical role',
  'magic the gathering',
  'yu-gi-oh',
  'yugioh',
  'star trek',
  'xenomorph',
  'godzilla',
  'gundam',
  'evangelion',
  'goku',
  'luffy',
  'demon slayer',
  'attack on titan',
  'jujutsu kaisen',
  'my hero academia',
  'genshin',
  'hollow knight',
  'halo master chief',
  'master chief',
  'world of warcraft',
  'warcraft',
  'stranger things',
  'lego',
  'hasbro',
  'gandalf',
  'frodo',
  'shrek',
  'simpsons',
  'frozen elsa',
  'groot',
  'deadpool',
  'wolverine',
  'darth vader',
  'yoda',
  'grogu',
  'baby yoda',
  'skyrim',
  'elder scrolls',
  'assassins creed',
  'dark souls',
  'elden ring',
  'cartier',
  'tiffany co',
  'bulgari',
  'bvlgari',
  'pandora charm',
  'chanel',
  'gucci',
  'dior',
  'louis vuitton',
  'rolex',
  'van cleef',
  'swarovski',
  'chrome hearts',
];

/** Signals that the design copies something else and needs a human look. */
const REVIEW_TERMS = [
  'logo',
  'fan art',
  'fanart',
  'replica',
  'inspired',
  'cosplay',
  'movie',
  'film',
  'anime',
  'manga',
  'game',
  'brand',
  'trademark',
  'emblem',
  'badge',
];

function normalize(value: string): string {
  return ` ${value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')} `;
}

/**
 * Generic tabletop words that are normal for printed miniatures but suggest a
 * fan copy elsewhere; Gripr Lab reviews franchise-adjacent terms instead.
 */
const LAB_REVIEW_IGNORED = new Set(['game', 'badge', 'emblem', 'logo']);
const LAB_REVIEW_TERMS = [
  'dnd',
  'd d',
  'pathfinder',
  '40k',
  'grimdark',
  'proxy',
  'fan made',
];

/** Flags protected franchise/brand terms in the model's metadata. */
export function assessIpRisk(
  subject: IpSubject,
  store: Store = 'gripr',
): IpAssessment {
  const text = normalize(
    [subject.title, subject.tags.join(' '), subject.description ?? ''].join(
      ' ',
    ),
  );
  const find = (terms: string[]) =>
    terms.filter((term) => text.includes(` ${term} `));

  const blocked = find(BLOCKED_TERMS);

  if (blocked.length > 0) return { risk: 'blocked', matches: blocked };

  const review = find(
    store === 'lab'
      ? [
          ...REVIEW_TERMS.filter((term) => !LAB_REVIEW_IGNORED.has(term)),
          ...LAB_REVIEW_TERMS,
        ]
      : REVIEW_TERMS,
  );

  return review.length > 0
    ? { risk: 'review', matches: review }
    : { risk: 'low', matches: [] };
}
