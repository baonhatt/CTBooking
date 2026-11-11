import { describe, it, expect, vi, beforeEach } from 'vitest';
import staffRouter from './staff.router';
import {
  createStaffImpl,
  deleteStaffImpl,
  getStaffByIdImpl,
  listStaffImpl,
  resetStaffPasswordImpl,
  restoreStaffImpl,
  updateStaffImpl
} from '../../../../server/routes/admin/staff-management';
import { queueStaffCredentialsEmail } from '../../../../server/lib/staff-credentials-mail';

// The guards are tested elsewhere. Here they just copy the signed-in staff from test headers into the context,
// so the test can check what the router passes on to the Impl functions.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', Number(c.req.header('x-test-id') || 0));
    c.set('staffEmail', 'caller@example.com');
    c.set('staffFullname', 'Caller');
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set('staffBranchIds', (c.req.header('x-test-branches') || '').split(',').filter(Boolean).map(Number));
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/staff-management', () => ({
  listStaffImpl: vi.fn(async () => ({ items: [], total: 0 })),
  getStaffByIdImpl: vi.fn(async () => ({ status: 'success', staff: {} })),
  createStaffImpl: vi.fn(async () => ({
    status: 'success',
    staff: { id: 55, email: 'new@staff.test', fullname: 'New Staff' },
    generated_password: 'Gen-Pass-1234'
  })),
  updateStaffImpl: vi.fn(async () => ({ status: 'success' })),
  deleteStaffImpl: vi.fn(async () => ({ status: 'success' })),
  restoreStaffImpl: vi.fn(async () => ({ status: 'success' })),
  listDeletedStaffImpl: vi.fn(async () => ({ items: [] })),
  resetStaffPasswordImpl: vi.fn(async () => ({ status: 'success', generated_password: 'Gen-Pass-1234' }))
}));

// The mail itself is tested in staff-credentials-mail.test.ts; here only what the router hands to it matters
vi.mock('../../../../server/lib/staff-credentials-mail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../server/lib/staff-credentials-mail')>()),
  queueStaffCredentialsEmail: vi.fn()
}));

const env = { cinema_db: {} };
const SUPER = { 'x-test-super': '1', 'x-test-id': '1' };
const MANAGER = { 'x-test-super': '0', 'x-test-id': '20', 'x-test-branches': '1,2' };

function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  return staffRouter.request(
    path,
    {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    },
    env
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('staff router: what is passed to the Impl functions', () => {
  it('passes the signed-in staff member and their branches, not anything from the request body', async () => {
    await call('PUT', '/api/admin/staff/30', MANAGER, { fullname: 'X', isSuperAdmin: true });

    const callerArgument = (updateStaffImpl as any).mock.calls[0][5];
    expect(callerArgument).toEqual({
      isSuperAdmin: false,
      branchIds: [1, 2],
      id: 20,
      email: 'caller@example.com',
      fullname: 'Caller'
    });
  });

  it('lists with no limit for the Super Admin and with the staff branches for everyone else', async () => {
    await call('GET', '/api/admin/staff', SUPER);
    await call('GET', '/api/admin/staff', MANAGER);
    await call('GET', '/api/admin/staff', { 'x-test-super': '0', 'x-test-id': '21' });

    expect((listStaffImpl as any).mock.calls[0][2].restrictToBranchIds).toBeNull();
    expect((listStaffImpl as any).mock.calls[1][2].restrictToBranchIds).toEqual([1, 2]);
    expect((listStaffImpl as any).mock.calls[2][2].restrictToBranchIds).toEqual([]);
  });

  it('passes the caller to get, delete and restore too', async () => {
    await call('GET', '/api/admin/staff/30', MANAGER);
    await call('DELETE', '/api/admin/staff/30', MANAGER);
    await call('POST', '/api/admin/staff/30/restore', MANAGER);

    expect((getStaffByIdImpl as any).mock.calls[0][3]).toMatchObject({ id: 20, branchIds: [1, 2] });
    expect((deleteStaffImpl as any).mock.calls[0][3]).toMatchObject({ id: 20, branchIds: [1, 2], isSuperAdmin: false });
    expect((restoreStaffImpl as any).mock.calls[0][3]).toMatchObject({ id: 20, branchIds: [1, 2], isSuperAdmin: false });
  });

  it('hands the delete and restore Impl the branch table it needs for the scope check', async () => {
    await call('DELETE', '/api/admin/staff/30', MANAGER);
    await call('POST', '/api/admin/staff/30/restore', MANAGER);

    expect((deleteStaffImpl as any).mock.calls[0][1]).toHaveProperty('staffBranches');
    expect((restoreStaffImpl as any).mock.calls[0][1]).toHaveProperty('staffBranches');
  });

  it('create shows the generated password to the Super Admin and emails it to the new staff member', async () => {
    const response = await call('POST', '/api/admin/staff', SUPER, { email: 'a@b.c', fullname: 'A' });

    expect(response.status).toBe(200);
    expect(((await response.json()) as any).generated_password).toBe('Gen-Pass-1234');
    expect((createStaffImpl as any).mock.calls[0]).toHaveLength(5);

    expect(queueStaffCredentialsEmail).toHaveBeenCalledTimes(1);
    expect((queueStaffCredentialsEmail as any).mock.calls[0][0]).toMatchObject({
      kind: 'created',
      staff: { id: 55, email: 'new@staff.test' },
      password: 'Gen-Pass-1234'
    });
  });

  it('create emails the password but does not show it on screen when the caller is not the Super Admin', async () => {
    const response = await call('POST', '/api/admin/staff', MANAGER, { email: 'a@b.c', fullname: 'A' });

    expect(response.status).toBe(200);
    expect(((await response.json()) as any).generated_password).toBeUndefined();
    expect((queueStaffCredentialsEmail as any).mock.calls[0][0].password).toBe('Gen-Pass-1234');
  });
});

describe('staff router: error codes', () => {
  it('answers 403 when the Impl refuses by scope or permission, and 400 for other errors', async () => {
    (updateStaffImpl as any).mockResolvedValueOnce({ status: 'error', code: 'forbidden', message: 'scope' });
    (updateStaffImpl as any).mockResolvedValueOnce({ status: 'error', message: 'other' });

    expect((await call('PUT', '/api/admin/staff/30', MANAGER, {})).status).toBe(403);
    expect((await call('PUT', '/api/admin/staff/30', MANAGER, {})).status).toBe(400);
  });

  it('delete and restore refusals are no longer reported as success (restore used to always answer 200)', async () => {
    (restoreStaffImpl as any).mockResolvedValueOnce({ status: 'error', code: 'forbidden', message: 'scope' });
    (restoreStaffImpl as any).mockResolvedValueOnce({ status: 'error', message: 'not deleted' });
    (deleteStaffImpl as any).mockResolvedValueOnce({ status: 'error', code: 'forbidden', message: 'scope' });

    expect((await call('POST', '/api/admin/staff/30/restore', MANAGER)).status).toBe(403);
    expect((await call('POST', '/api/admin/staff/30/restore', MANAGER)).status).toBe(400);
    expect((await call('DELETE', '/api/admin/staff/30', MANAGER)).status).toBe(403);
  });

  it('get answers 404 for a staff member that is missing or out of scope', async () => {
    (getStaffByIdImpl as any).mockResolvedValueOnce({ status: 'error', message: 'Staff not found' });
    expect((await call('GET', '/api/admin/staff/30', MANAGER)).status).toBe(404);
  });
});

describe('staff router: reset password', () => {
  it('answers 403 to a non-Super Admin and passes the caller to the Impl', async () => {
    (resetStaffPasswordImpl as any).mockResolvedValueOnce({ status: 'error', code: 'forbidden', message: 'no' });

    const response = await call('POST', '/api/admin/staff/30/reset-password', MANAGER);

    expect(response.status).toBe(403);
    expect((resetStaffPasswordImpl as any).mock.calls[0][4]).toMatchObject({ id: 20, isSuperAdmin: false });
  });

  it('returns the generated password to the Super Admin and ignores a password in the body', async () => {
    const response = await call('POST', '/api/admin/staff/30/reset-password', SUPER, { newPassword: 'chosen-by-caller' });

    expect(response.status).toBe(200);
    expect(((await response.json()) as any).generated_password).toBe('Gen-Pass-1234');
    const args = (resetStaffPasswordImpl as any).mock.calls[0];
    expect(args).toHaveLength(5);
    expect(JSON.stringify(args.slice(2))).not.toContain('chosen-by-caller');
  });
});
