import type { Database } from '../../integrations/database/database.client';
import type { SketchfabConfig } from '../../integrations/sketchfab/sketchfab.config';
import type {
  SketchfabModel,
  SketchfabService,
} from '../../integrations/sketchfab/sketchfab.service';
import {
  DesignImportInProgressError,
  DesignImportService,
  toDesignCandidate,
} from './design.import.service';

const now = new Date('2026-01-01T00:00:00Z');

function model(overrides: Partial<SketchfabModel> = {}): SketchfabModel {
  return {
    sourceId: 'abc123',
    title: 'Dragon Ring',
    description: 'Printable ring for casting',
    tags: ['ring', 'jewelry'],
    likes: 10,
    views: 100,
    publishedAt: null,
    isDownloadable: true,
    isAgeRestricted: false,
    licenseLabel: 'CC Attribution',
    author: 'Maker',
    authorUrl: null,
    previewUrl: null,
    embedUrl: null,
    sourceUrl: 'https://sketchfab.com/3d-models/abc123',
    ...overrides,
  };
}

describe('toDesignCandidate', () => {
  it('maps a licensed jewelry model without review fields', () => {
    const row = toDesignCandidate(model(), now);

    expect(row).toMatchObject({
      source: 'sketchfab',
      sourceId: 'abc123',
      license: 'cc_by',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      suggestedType: 'ring',
      ipRisk: 'low',
      lastSyncedAt: now,
    });
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('productId');
    expect(row).not.toHaveProperty('reviewedBy');
  });

  it('returns the skip reason for unusable models', () => {
    expect(
      toDesignCandidate(
        model({ licenseLabel: 'CC Attribution-NonCommercial' }),
        now,
      ),
    ).toBe('license');
    expect(toDesignCandidate(model({ isDownloadable: false }), now)).toBe(
      'not_downloadable',
    );
    expect(toDesignCandidate(model({ isAgeRestricted: true }), now)).toBe(
      'age_restricted',
    );
    expect(
      toDesignCandidate(
        model({ title: 'Chair', tags: ['furniture'], description: null }),
        now,
      ),
    ).toBe('irrelevant');
  });
});

describe('DesignImportService', () => {
  const config: SketchfabConfig = {
    baseUrl: 'https://api.sketchfab.com/v3',
    importEnabled: true,
  };

  it('allows only one run at a time', async () => {
    let finish: () => void = () => undefined;
    const sketchfab = {
      searchModels: jest.fn(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ models: [], cursor: null });
          }),
      ),
    } as unknown as SketchfabService;
    const db = {
      select: () => ({ from: () => Promise.resolve([]) }),
    } as unknown as Database;
    const service = new DesignImportService(db, config, sketchfab);
    service.requestDelayMs = 0;

    const running = service.start();

    expect(running.status).toBe('running');
    expect(service.isRunning).toBe(true);
    expect(() => service.start()).toThrow(DesignImportInProgressError);

    await new Promise((resolve) => setImmediate(resolve));
    sketchfab.searchModels = jest.fn(() =>
      Promise.resolve({ models: [], cursor: null }),
    );
    finish();

    while (service.isRunning) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(service.lastRun).toMatchObject({ status: 'completed', created: 0 });
  });

  it('skips the nightly run when the import is disabled', async () => {
    const sketchfab = { searchModels: jest.fn() };
    const service = new DesignImportService(
      {} as Database,
      { ...config, importEnabled: false },
      sketchfab as unknown as SketchfabService,
    );

    await service.runNightly();

    expect(sketchfab.searchModels).not.toHaveBeenCalled();
    expect(service.lastRun).toBeNull();
  });
});
