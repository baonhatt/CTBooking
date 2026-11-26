import { describe, it, expect, vi, beforeEach } from 'vitest';
import logsRouter from './logs.router';
import { getUsersImpl } from '../../../../server/routes/admin/users';
import { getAuditLogByIdImpl } from '../../../../server/lib/audit-logger';
import { sendTestEmailImpl, takeTestMailSlot } from '../../../../server/routes/admin/email-preview';

/** A KV in memory, as SETTINGS_KV */
function memoryKv() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => void store.set(key, value),
    delete: async (key: string) => void store.delete(key)
  };
}

// The guards are tested elsewhere. Here they let every request through.
// The guards are replaced: the test headers say who is signed in
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set('staffId', Number(c.req.header('x-test-staff') || 1));
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/email-preview', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  sendTestEmailImpl: vi.fn(async () => ({ status: 'success', message: 'Đã gửi thư thử' }))
}));

vi.mock('../../../../server/routes/admin/users', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getUsersImpl: vi.fn(async () => ({ items: [], total: 0 }))
}));

vi.mock('../../../../server/lib/audit-logger', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getAuditLogByIdImpl: vi.fn()
}));

const env = { cinema_db: {} };
const get = (path: string) => logsRouter.request(path, { method: 'GET' }, env);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users: page size is capped', () => {
  it('caps 100000 at 100 and turns a bad page into 1', async () => {
    await get('/api/admin/users?page=-1&pageSize=100000');
    expect((getUsersImpl as any).mock.calls[0][2]).toMatchObject({ page: 1, pageSize: 100 });
  });

  it('defaults to 20', async () => {
    await get('/api/admin/users?pageSize=abc');
    expect((getUsersImpl as any).mock.calls[0][2]).toMatchObject({ pageSize: 20 });
  });
});

describe('GET /api/admin/audit-logs/:id', () => {
  it('answers 404 for a line that does not exist', async () => {
    (getAuditLogByIdImpl as any).mockResolvedValue(null);
    const response = await get('/api/admin/audit-logs/99');
    expect(response.status).toBe(404);
  });

  it('returns the line with its saved values', async () => {
    (getAuditLogByIdImpl as any).mockResolvedValue({ status: 'success', log: { id: 5, oldValues: null, newValues: '{}', userAgent: 'UA' } });
    const response = await get('/api/admin/audit-logs/5');
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).log.userAgent).toBe('UA');
    expect((getAuditLogByIdImpl as any).mock.calls[0][2]).toBe(5);
  });
});

describe('POST /api/admin/email-preview/send-test', () => {
  const send = (headers: Record<string, string>, kv: any) =>
    logsRouter.request(
      '/api/admin/email-preview/send-test',
      { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ templateId: 'x', toEmail: 'a@b.vn' }) },
      { ...env, SETTINGS_KV: kv }
    );

  it('only the Super Admin may send', async () => {
    const response = await send({ 'x-test-super': '0' }, memoryKv());
    expect(response.status).toBe(403);
    expect(sendTestEmailImpl).not.toHaveBeenCalled();
  });

  it('at most 10 test mails in 10 minutes, then a wait message', async () => {
    const kv = memoryKv();
    for (let sent = 0; sent < 10; sent++) {
      expect((await send({ 'x-test-super': '1' }, kv)).status).toBe(200);
    }
    const eleventh = await send({ 'x-test-super': '1' }, kv);
    expect(eleventh.status).toBe(429);
    expect(((await eleventh.json()) as any).message).toMatch(/Vui lòng đợi \d+ giây/);
    expect(sendTestEmailImpl).toHaveBeenCalledTimes(10);
  });

  it('the window slides: after 10 minutes a new mail is allowed again', async () => {
    const kv = memoryKv();
    const start = Date.parse('2026-11-26T03:00:00Z');
    for (let sent = 0; sent < 10; sent++) expect((await takeTestMailSlot(kv, 7, start + sent * 1000)).allowed).toBe(true);
    expect(await takeTestMailSlot(kv, 7, start + 60_000)).toEqual({ allowed: false, waitSeconds: 540 });
    expect((await takeTestMailSlot(kv, 7, start + 10 * 60_000 + 1)).allowed).toBe(true);
    // Another Super Admin has their own count
    expect((await takeTestMailSlot(kv, 8, start + 60_000)).allowed).toBe(true);
  });
});
