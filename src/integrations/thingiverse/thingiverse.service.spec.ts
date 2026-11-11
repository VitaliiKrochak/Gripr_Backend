import { ThingiverseError, ThingiverseService } from './thingiverse.service';

describe('ThingiverseService', () => {
  const service = new ThingiverseService({
    apiToken: 'secret',
    baseUrl: 'https://thingiverse.test',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('searches things of one license without AI designs', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        total: 2,
        hits: [
          { id: 101, name: 'Knight', like_count: 40 },
          { id: 102, name: 'Orc' },
        ],
      }),
    );

    const hits = await service.search({
      q: 'fantasy miniature',
      license: 'cc-sa',
      sort: 'popular',
      page: 2,
    });

    expect(hits).toEqual([
      { id: '101', likes: 40 },
      { id: '102', likes: 0 },
    ]);
    const [url, init] = fetchSpy.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.pathname).toBe('/search/fantasy%20miniature');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      type: 'things',
      license: 'cc-sa',
      sort: 'popular',
      page: '2',
      per_page: '30',
      show_ai: 'false',
    });
    expect(init?.headers).toEqual({ Authorization: 'Bearer secret' });
  });

  it('normalizes a thing with its license', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        id: 101,
        name: ' Knight bust ',
        description: 'Presupported',
        public_url: 'https://www.thingiverse.com/thing:101',
        license: 'Creative Commons - Attribution - Share Alike',
        like_count: 40,
        view_count: 900,
        added: '2024-05-01T10:00:00+00:00',
        is_nsfw: false,
        creator: {
          name: 'sculptor',
          public_url: 'https://www.thingiverse.com/sculptor',
        },
        tags: [{ name: 'bust' }],
        thumbnail: 'thumb',
        default_image: {
          url: 'original',
          sizes: [
            { type: 'thumb', size: 'large', url: 'thumb-large' },
            { type: 'display', size: 'large', url: 'display-large' },
          ],
        },
      }),
    );

    expect(await service.getThing('101')).toEqual({
      sourceId: '101',
      title: 'Knight bust',
      description: 'Presupported',
      tags: ['bust'],
      likes: 40,
      views: 900,
      publishedAt: new Date('2024-05-01T10:00:00+00:00'),
      isDownloadable: true,
      isAgeRestricted: false,
      licenseLabel: 'Creative Commons - Attribution - Share Alike',
      author: 'sculptor',
      authorUrl: 'https://www.thingiverse.com/sculptor',
      previewUrl: 'display-large',
      embedUrl: null,
      sourceUrl: 'https://www.thingiverse.com/thing:101',
    });
  });

  it('needs a token and reports HTTP errors', async () => {
    const off = new ThingiverseService({ baseUrl: 'https://thingiverse.test' });

    expect(off.isConfigured()).toBe(false);
    await expect(off.getThing('1')).rejects.toThrow(ThingiverseError);

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('slow down', { status: 429 }));
    await expect(service.getThing('1')).rejects.toThrow(ThingiverseError);
  });
});
