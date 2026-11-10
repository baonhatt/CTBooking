import { describe, it, expect } from 'vitest';
import { addRequiredPermissions, removePermissionWithDependents } from './permission-rules';

const ALL_KEYS = [
  'movies:view',
  'movies:create',
  'movies:edit',
  'movies:view_deleted',
  'movies:restore',
  'dashboard:view',
  'dashboard:view_revenue',
  'ticket_check:scan',
  'ticket_check:validate',
  'ticket_check:history'
];

describe('addRequiredPermissions', () => {
  it('brings "view" along with another action of the module', () => {
    expect(addRequiredPermissions(['movies:edit'], ALL_KEYS).sort()).toEqual(['movies:edit', 'movies:view']);
  });

  it('follows the chain: restore needs the deleted list, which needs view', () => {
    expect(addRequiredPermissions(['movies:restore'], ALL_KEYS).sort()).toEqual([
      'movies:restore',
      'movies:view',
      'movies:view_deleted'
    ]);
  });

  it('revenue needs the dashboard', () => {
    expect(addRequiredPermissions(['dashboard:view_revenue'], ALL_KEYS).sort()).toEqual([
      'dashboard:view',
      'dashboard:view_revenue'
    ]);
  });

  it('marking a ticket used needs the lookup (ticket_check has no view)', () => {
    expect(addRequiredPermissions(['ticket_check:validate'], ALL_KEYS).sort()).toEqual([
      'ticket_check:scan',
      'ticket_check:validate'
    ]);
  });

  it('ignores a permission that does not exist in the system', () => {
    expect(addRequiredPermissions(['toys:edit'], ALL_KEYS)).toEqual(['toys:edit']);
  });
});

describe('removePermissionWithDependents', () => {
  it('removing "view" removes the other actions of the module only', () => {
    const selected = ['movies:view', 'movies:edit', 'movies:restore', 'movies:view_deleted', 'dashboard:view'];
    expect(removePermissionWithDependents('movies:view', selected, ALL_KEYS)).toEqual(['dashboard:view']);
  });

  it('removing a leaf keeps the rest', () => {
    const selected = ['movies:view', 'movies:edit'];
    expect(removePermissionWithDependents('movies:edit', selected, ALL_KEYS)).toEqual(['movies:view']);
  });

  it('removing the deleted list removes restore too', () => {
    const selected = ['movies:view', 'movies:view_deleted', 'movies:restore'];
    expect(removePermissionWithDependents('movies:view_deleted', selected, ALL_KEYS)).toEqual(['movies:view']);
  });
});
