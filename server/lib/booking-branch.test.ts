import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../shared/schema';
import { resolveOrderBranchId } from './booking-branch';

const branchesTable = (schema as any).branches;

function makeDb(defaultBranch: any) {
  return { query: { branches: { findFirst: vi.fn(async () => defaultBranch) } } };
}

describe('resolveOrderBranchId', () => {
  it('uses the branch that was asked for, without looking up the default', async () => {
    const db = makeDb({ id: 1 });
    expect(await resolveOrderBranchId(db, branchesTable, 7)).toBe(7);
    expect(db.query.branches.findFirst).not.toHaveBeenCalled();
  });

  it('accepts a branch id sent as text', async () => {
    expect(await resolveOrderBranchId(makeDb(undefined), branchesTable, '3' as any)).toBe(3);
  });

  it.each([undefined, null, 0, -1, 1.5, 'abc', NaN])('falls back to the default branch for %p', async (requested) => {
    const db = makeDb({ id: 4 });
    expect(await resolveOrderBranchId(db, branchesTable, requested as any)).toBe(4);
    expect(db.query.branches.findFirst).toHaveBeenCalledTimes(1);
  });

  it('refuses the order when no branch is named and there is no default branch', async () => {
    await expect(resolveOrderBranchId(makeDb(undefined), branchesTable, undefined)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/chi nhánh/)
    });
  });
});
