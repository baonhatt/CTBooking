import { describe, it, expect, vi, beforeEach } from 'vitest';
import paymentsRouter from './payments.router';
import { listTransactionsImpl } from '../../../../server/routes/admin/payments';

// The guards are tested elsewhere. Here they copy the signed-in staff from test headers into the context.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 1);
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set('staffBranchIds', (c.req.header('x-test-branches') || '').split(',').filter(Boolean).map(Number));
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/payments', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listTransactionsImpl: vi.fn()
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function get(path: string, headers: Record<string, string> = { 'x-test-super': '1' }) {
  return paymentsRouter.request(path, { method: 'GET', headers }, env, executionContext);
}

/** A fake list that has `total` rows and answers by page. */
function fakeList(total: number) {
  (listTransactionsImpl as any).mockImplementation(async (_db: any, _tables: any, args: any) => {
    const start = (args.page - 1) * args.pageSize;
    const count = Math.max(0, Math.min(args.pageSize, total - start));
    return { items: Array.from({ length: count }, (_, i) => ({ id: start + i + 1 })), page: args.page, pageSize: args.pageSize, total };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/transactions: paging is capped', () => {
  it('a page size of 100000 becomes 100', async () => {
    fakeList(10);
    await get('/api/admin/transactions?page=1&pageSize=100000');
    expect((listTransactionsImpl as any).mock.calls[0][2]).toMatchObject({ page: 1, pageSize: 100 });
  });

  it.each([
    ['pageSize=-5', 20],
    ['pageSize=abc', 20],
    ['pageSize=0', 20],
    ['pageSize=1.5', 20]
  ])('%s falls back to the default %i', async (query, expected) => {
    fakeList(10);
    await get('/api/admin/transactions?' + query);
    expect((listTransactionsImpl as any).mock.calls[0][2].pageSize).toBe(expected);
  });

  it('a bad page number becomes 1', async () => {
    fakeList(10);
    await get('/api/admin/transactions?page=-3');
    expect((listTransactionsImpl as any).mock.calls[0][2].page).toBe(1);
  });
});

describe('GET /api/admin/transactions/export', () => {
  it('reads the list in pages of 100 and returns all rows when there are fewer than 5000', async () => {
    fakeList(250);

    const response = await get('/api/admin/transactions/export');
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(250);
    expect(body.truncated).toBe(false);
    expect(body.total).toBe(250);
    for (const call of (listTransactionsImpl as any).mock.calls) expect(call[2].pageSize).toBe(100);
  });

  it('stops at 5000 rows and says it cut the list', async () => {
    fakeList(7300);

    const body: any = await (await get('/api/admin/transactions/export')).json();

    expect(body.items).toHaveLength(5000);
    expect(body.truncated).toBe(true);
    expect(body.total).toBe(7300);
    expect(body.limit).toBe(5000);
    expect((listTransactionsImpl as any).mock.calls.length).toBe(50);
  });

  it('passes the filters on and applies the staff member\'s branch scope', async () => {
    fakeList(1);

    await get('/api/admin/transactions/export?status=paid&from=2026-11-01&to=2026-11-30&booking_type=vr&branch_id=2', {
      'x-test-super': '0',
      'x-test-branches': '2,3'
    });

    expect((listTransactionsImpl as any).mock.calls[0][2]).toMatchObject({
      status: 'paid',
      from: '2026-11-01',
      to: '2026-11-30',
      booking_type: 'vr',
      branch_id: 2,
      restrictToBranchIds: [2, 3]
    });
  });

  it('gives the Super Admin no branch limit', async () => {
    fakeList(1);
    await get('/api/admin/transactions/export');
    expect((listTransactionsImpl as any).mock.calls[0][2].restrictToBranchIds).toBeNull();
  });

  it('answers 500 with a plain message when the read fails', async () => {
    (listTransactionsImpl as any).mockRejectedValue(new Error('D1_ERROR: boom'));

    const response = await get('/api/admin/transactions/export');

    expect(response.status).toBe(500);
  });
});
