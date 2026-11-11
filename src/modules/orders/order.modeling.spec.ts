import {
  deliversFile,
  deliversPrint,
  freeRevisionsLeft,
  modelDownloadBlocker,
  newOrderModeling,
  PERSONAL_USE_LICENSE,
  recordRevision,
} from './order.modeling';

const TERMS = {
  freeBig: 1,
  freeSmall: 2,
  bigPrice: 100_000,
  smallPrice: 25_000,
};

describe('order modeling', () => {
  it('licenses delivered files only', () => {
    expect(newOrderModeling('file', TERMS).license).toBe(PERSONAL_USE_LICENSE);
    expect(newOrderModeling('print_and_file', TERMS).license).toBe(
      PERSONAL_USE_LICENSE,
    );
    expect(newOrderModeling('print', TERMS).license).toBeNull();
    expect(deliversFile('print')).toBe(false);
    expect(deliversPrint('file')).toBe(false);
    expect(deliversPrint('print_and_file')).toBe(true);
  });

  it('charges revisions beyond the free ones', () => {
    let modeling = {
      ...newOrderModeling('file', TERMS),
      pendingRevision: true,
    };
    const charges: number[] = [];

    for (const kind of ['small', 'big', 'small', 'small', 'big'] as const) {
      const result = recordRevision(modeling, kind);
      modeling = result.modeling;
      charges.push(result.charge);
    }

    expect(charges).toEqual([0, 0, 0, 25_000, 100_000]);
    expect(modeling).toMatchObject({
      bigRevisions: 2,
      smallRevisions: 3,
      pendingRevision: false,
    });
    expect(freeRevisionsLeft(modeling)).toEqual({ big: 0, small: 0 });
  });

  it('allows downloads of approved, fully paid model files', () => {
    const order = {
      status: 'completed' as const,
      paidAmount: 50_000,
      total: 50_000,
      modeling: newOrderModeling('file', TERMS),
    };

    expect(modelDownloadBlocker(order)).toBeNull();
    expect(modelDownloadBlocker({ ...order, status: 'model_review' })).toMatch(
      /approved/,
    );
    expect(modelDownloadBlocker({ ...order, status: 'refunded' })).toMatch(
      /approved/,
    );
    expect(
      modelDownloadBlocker({
        ...order,
        status: 'in_production',
        paidAmount: 1,
      }),
    ).toMatch(/fully paid/);
    expect(
      modelDownloadBlocker({
        ...order,
        modeling: newOrderModeling('print', TERMS),
      }),
    ).toMatch(/does not deliver/);
    expect(modelDownloadBlocker({ ...order, modeling: null })).toMatch(
      /does not deliver/,
    );
  });
});
