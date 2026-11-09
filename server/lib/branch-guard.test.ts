import { describe, it, expect } from 'vitest';
import { canManageStaffTarget } from './branch-guard';

const manager = (branchIds: number[]) => ({ isSuperAdmin: false, branchIds });
const staffMember = { isSuperAdmin: false };

describe('canManageStaffTarget', () => {
  it('lets the Super Admin do anything', () => {
    expect(canManageStaffTarget({ isSuperAdmin: true }, staffMember, [], 'modify')).toBe(true);
    expect(canManageStaffTarget({ isSuperAdmin: true }, staffMember, [9], 'view')).toBe(true);
  });

  it('never lets anyone but the Super Admin act on a Super Admin', () => {
    expect(canManageStaffTarget(manager([1]), { isSuperAdmin: true }, [1], 'view')).toBe(false);
    expect(canManageStaffTarget(manager([1]), { isSuperAdmin: true }, [1], 'modify')).toBe(false);
  });

  it('refuses a caller with no branch', () => {
    expect(canManageStaffTarget(manager([]), staffMember, [1], 'view')).toBe(false);
    expect(canManageStaffTarget({ isSuperAdmin: false }, staffMember, [1], 'modify')).toBe(false);
  });

  it('refuses a target with no branch, because nobody shares scope with it', () => {
    expect(canManageStaffTarget(manager([1]), staffMember, [], 'view')).toBe(false);
    expect(canManageStaffTarget(manager([1]), staffMember, [], 'modify')).toBe(false);
  });

  it('modify: allows a target that works only inside the caller branches', () => {
    expect(canManageStaffTarget(manager([1, 2]), staffMember, [1], 'modify')).toBe(true);
    expect(canManageStaffTarget(manager([1, 2]), staffMember, [1, 2], 'modify')).toBe(true);
  });

  it('modify: refuses a target that also works at a branch the caller does not manage', () => {
    expect(canManageStaffTarget(manager([1]), staffMember, [1, 2], 'modify')).toBe(false);
  });

  it('modify: refuses a target at another branch', () => {
    expect(canManageStaffTarget(manager([1]), staffMember, [2], 'modify')).toBe(false);
  });

  it('view: allows a target that shares at least one branch', () => {
    expect(canManageStaffTarget(manager([1]), staffMember, [1, 2], 'view')).toBe(true);
  });

  it('view: refuses a target with no shared branch', () => {
    expect(canManageStaffTarget(manager([1]), staffMember, [2, 3], 'view')).toBe(false);
  });
});
