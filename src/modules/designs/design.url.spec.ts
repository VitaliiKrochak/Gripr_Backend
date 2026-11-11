import { parseDesignUrl, readPageMetadata } from './design.url';

describe('parseDesignUrl', () => {
  const uid = '0123456789abcdef0123456789abcdef';

  it.each([
    [
      `https://sketchfab.com/3d-models/knight-bust-${uid}`,
      'sketchfab',
      uid,
      `https://sketchfab.com/3d-models/${uid}`,
    ],
    [
      `https://sketchfab.com/models/${uid.toUpperCase()}/embed`,
      'sketchfab',
      uid,
      `https://sketchfab.com/3d-models/${uid}`,
    ],
    [
      'https://www.thingiverse.com/thing:4567/files',
      'thingiverse',
      '4567',
      'https://www.thingiverse.com/thing:4567',
    ],
    [
      'https://www.printables.com/en/model/12345-dwarf-warrior',
      'printables',
      '12345',
      'https://www.printables.com/en/model/12345-dwarf-warrior',
    ],
    [
      'https://www.myminifactory.com/object/3d-print-bust-of-zeus-98765',
      'myminifactory',
      '98765',
      'https://www.myminifactory.com/object/3d-print-bust-of-zeus-98765',
    ],
  ])('recognizes %s', (url, source, sourceId, canonical) => {
    expect(parseDesignUrl(url)).toEqual({ source, sourceId, url: canonical });
  });

  it.each([
    'https://example.com/model/1',
    'https://sketchfab.com/jane',
    'https://www.printables.com/@maker',
    'ftp://www.thingiverse.com/thing:1',
    'not a url',
    'https://printables.com.evil.test/model/1',
  ])('refuses %s', (url) => {
    expect(parseDesignUrl(url)).toBeNull();
  });
});

describe('readPageMetadata', () => {
  it('reads Open Graph tags in either attribute order', () => {
    expect(
      readPageMetadata(`
        <meta property="og:title" content="Dwarf &amp; Axe">
        <meta content='Presupported &#8211; 32mm' property='og:description'>
        <meta property="og:image" content="https://media.test/dwarf.jpg" />
        <meta name="author" content="Forge Minis">
      `),
    ).toEqual({
      title: 'Dwarf & Axe',
      description: 'Presupported – 32mm',
      image: 'https://media.test/dwarf.jpg',
      author: 'Forge Minis',
    });
  });

  it('returns nulls for a page without metadata', () => {
    expect(readPageMetadata('<html><title>x</title></html>')).toEqual({
      title: null,
      description: null,
      image: null,
      author: null,
    });
  });
});
