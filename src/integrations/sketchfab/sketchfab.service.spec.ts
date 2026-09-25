import { SketchfabError, SketchfabService } from './sketchfab.service';

describe('SketchfabService', () => {
  const service = new SketchfabService({
    baseUrl: 'https://sketchfab.test/v3',
    importEnabled: true,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('searches downloadable models and normalizes them', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        next: 'https://sketchfab.test/v3/search?cursor=24&q=ring',
        results: [
          {
            uid: 'abc',
            name: ' Dragon Ring ',
            description: 'A ring',
            tags: [{ name: 'ring' }, { name: 'dragon' }],
            likeCount: 12,
            viewCount: 340,
            publishedAt: '2024-01-02T03:04:05.000',
            isDownloadable: true,
            isAgeRestricted: false,
            viewerUrl: 'https://sketchfab.com/3d-models/dragon-ring-abc',
            embedUrl: 'https://sketchfab.com/models/abc/embed',
            license: { label: 'CC Attribution' },
            user: {
              displayName: 'Jane',
              profileUrl: 'https://sketchfab.com/jane',
            },
            thumbnails: {
              images: [
                { url: 'big', width: 1920, height: 1080 },
                { url: 'mid', width: 1024, height: 576 },
                { url: 'small', width: 256, height: 144 },
              ],
            },
          },
        ],
      }),
    );

    const page = await service.searchModels({
      q: 'ring',
      license: 'by',
      sortBy: '-likeCount',
    });

    expect(page.cursor).toBe('24');
    expect(page.models).toEqual([
      {
        sourceId: 'abc',
        title: 'Dragon Ring',
        description: 'A ring',
        tags: ['ring', 'dragon'],
        likes: 12,
        views: 340,
        publishedAt: new Date('2024-01-02T03:04:05.000'),
        isDownloadable: true,
        isAgeRestricted: false,
        licenseLabel: 'CC Attribution',
        author: 'Jane',
        authorUrl: 'https://sketchfab.com/jane',
        previewUrl: 'mid',
        embedUrl: 'https://sketchfab.com/models/abc/embed',
        sourceUrl: 'https://sketchfab.com/3d-models/dragon-ring-abc',
      },
    ]);

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: 'models',
      q: 'ring',
      license: 'by',
      downloadable: 'true',
      sort_by: '-likeCount',
      count: '24',
    });
  });

  it('sends the API token when configured', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({ next: null, results: [] }));
    const withToken = new SketchfabService({
      apiToken: 'secret',
      baseUrl: 'https://sketchfab.test/v3',
      importEnabled: true,
    });

    const page = await withToken.searchModels({
      q: 'ring',
      license: 'cc0',
      sortBy: '-publishedAt',
      cursor: '48',
    });

    expect(page.cursor).toBeNull();
    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({
      Authorization: 'Token secret',
    });
    expect(fetchSpy.mock.calls[0][0]).toContain('cursor=48');
  });

  it('throws on HTTP errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('busy', { status: 429 }));

    await expect(
      service.searchModels({ q: 'ring', license: 'cc0', sortBy: '-likeCount' }),
    ).rejects.toThrow(SketchfabError);
  });
});
