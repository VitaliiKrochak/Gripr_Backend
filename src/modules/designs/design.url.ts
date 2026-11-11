import type { DesignSource } from '../../integrations/database/database.schema';

export interface DesignUrlReference {
  source: DesignSource;
  sourceId: string;
  /** Canonical page of the model. */
  url: string;
}

/** Sources read from their public page; the others have an API. */
export const PAGE_SOURCES: DesignSource[] = ['printables', 'myminifactory'];

const PAGE_HOSTS: Record<string, DesignSource> = {
  'printables.com': 'printables',
  'myminifactory.com': 'myminifactory',
};

/**
 * Recognizes a model link of a supported source: Sketchfab, Thingiverse,
 * Printables, or MyMiniFactory. Other hosts give `null`, so staff imports
 * never fetch arbitrary URLs.
 */
export function parseDesignUrl(value: string): DesignUrlReference | null {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname;

  if (host === 'sketchfab.com') {
    const uid = /(?:^|[/-])([0-9a-f]{32})(?:\/|$)/i.exec(path)?.[1];
    return uid
      ? {
          source: 'sketchfab',
          sourceId: uid.toLowerCase(),
          url: `https://sketchfab.com/3d-models/${uid.toLowerCase()}`,
        }
      : null;
  }

  if (host === 'thingiverse.com') {
    const id = /\/thing:(\d+)/.exec(path)?.[1];
    return id
      ? {
          source: 'thingiverse',
          sourceId: id,
          url: `https://www.thingiverse.com/thing:${id}`,
        }
      : null;
  }

  const source = PAGE_HOSTS[host];
  const id =
    source === 'printables'
      ? /\/model\/(\d+)/.exec(path)?.[1]
      : source === 'myminifactory'
        ? /\/object\/(?:[^/]*-)?(\d+)(?:\/|$)/.exec(path)?.[1]
        : undefined;

  return source && id
    ? { source, sourceId: id, url: `https://www.${host}${path}` }
    : null;
}

export interface PageMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  author: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith('#')) {
        return String.fromCodePoint(parseInt(entity.slice(1), 10));
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/** Open Graph and author meta tags of a model page. */
export function readPageMetadata(html: string): PageMetadata {
  const meta = new Map<string, string>();

  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(
      tag,
    );
    const value = content?.[1] ?? content?.[2];

    if (key && value && !meta.has(key.toLowerCase())) {
      meta.set(key.toLowerCase(), decodeEntities(value).trim());
    }
  }

  const pick = (...keys: string[]) =>
    keys.map((key) => meta.get(key)).find((value) => value) ?? null;

  return {
    title: pick('og:title', 'twitter:title'),
    description: pick('og:description', 'description', 'twitter:description'),
    image: pick('og:image', 'og:image:url', 'twitter:image'),
    author: pick('author', 'article:author', 'twitter:creator'),
  };
}
