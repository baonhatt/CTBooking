import { describe, it, expect } from 'vitest';
import * as schema from '../../shared/schema';
import { makeSqliteDb, insertRows } from '../test-utils/sqlite-db';
import { getAuditLogsImpl } from './audit-logger';

function makeLogs() {
  const { db, raw } = makeSqliteDb(['auditLogs']);
  insertRows(raw, 'auditLogs', [
    { id: 1, staff_id: 1, staff_email: 'a@x.test', staff_fullname: 'Staff A', action: 'create', entity_type: 'movie', entity_id: 1, created_at: '2026-11-01T01:00:00.000Z' },
    { id: 2, staff_id: 1, staff_email: 'a@x.test', staff_fullname: 'Staff A', action: 'delete', entity_type: 'movie', entity_id: 2, created_at: '2026-11-02T01:00:00.000Z' },
    { id: 3, staff_id: 2, staff_email: 'b@x.test', staff_fullname: 'Staff B', action: 'delete', entity_type: 'movie', entity_id: 3, created_at: '2026-11-03T01:00:00.000Z' },
    { id: 4, staff_id: 2, staff_email: 'b@x.test', staff_fullname: 'Staff B', action: 'delete', entity_type: 'voucher', entity_id: 4, created_at: '2026-11-04T01:00:00.000Z' }
  ]);
  return db;
}

const tables = { auditLogs: schema.auditLogs };
const idsOf = (result: any) => result.items.map((row: any) => row.id).sort();

describe('getAuditLogsImpl: filters combine with AND', () => {
  it('returns everything without filters', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, { page: 1, pageSize: 20 });
    expect(idsOf(result)).toEqual([1, 2, 3, 4]);
    expect(result.total).toBe(4);
  });

  it('staff AND action: only that staff member\'s deletes (not every delete, not every action of that staff)', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, { page: 1, pageSize: 20, staffId: 1, action: 'delete' });
    expect(idsOf(result)).toEqual([2]);
    expect(result.total).toBe(1);
  });

  it('module AND action AND staff all apply', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, { page: 1, pageSize: 20, module: 'movie', action: 'delete', staffId: 2 });
    expect(idsOf(result)).toEqual([3]);
  });

  it('date range AND action', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, {
      page: 1,
      pageSize: 20,
      action: 'delete',
      from: '2026-11-02T12:00:00.000Z',
      to: '2026-11-03T12:00:00.000Z'
    });
    expect(idsOf(result)).toEqual([3]);
    expect(result.total).toBe(1);
  });

  it('search AND staff', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, { page: 1, pageSize: 20, staffId: 2, search: 'Staff B' });
    expect(idsOf(result)).toEqual([3, 4]);
  });

  it('the total counts all matches, not just one page', async () => {
    const result = await getAuditLogsImpl(makeLogs(), tables, { page: 1, pageSize: 1, action: 'delete' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(3);
  });
});
