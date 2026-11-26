import { describe, it, expect } from 'vitest';
import * as schema from '../../shared/schema';
import { makeSqliteDb, insertRows } from '../test-utils/sqlite-db';
import { getAuditLogsImpl, getAuditLogByIdImpl } from './audit-logger';

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

describe('audit log list and detail', () => {
  function makeLogsWithValues() {
    const { db, raw } = makeSqliteDb(['auditLogs']);
    insertRows(raw, 'auditLogs', [
      {
        id: 1,
        staff_fullname: 'Staff A',
        action: 'update',
        entity_type: 'booking',
        entity_id: 55,
        old_values: '{"booking_code":"OLD12345"}',
        new_values: '{"booking_code":"ABCD2345","is_used":true}',
        user_agent: 'Mozilla/5.0',
        ip_address: '1.2.3.4',
        created_at: '2026-11-01T01:00:00.000Z'
      },
      { id: 2, action: 'delete', entity_type: 'movie', entity_id: 9, old_values: 'Xóa phim', created_at: '2026-11-02T01:00:00.000Z' },
      { id: 3, action: 'create', entity_type: 'staff', entity_id: 4, new_values: '{"fullname":"Lan"}', created_at: '2026-11-03T01:00:00.000Z' }
    ]);
    return db;
  }

  it('lists without the saved values or the browser, with the record name worked out on the server', async () => {
    const result: any = await getAuditLogsImpl(makeLogsWithValues(), tables, { page: 1, pageSize: 20 });
    const byId = Object.fromEntries(result.items.map((row: any) => [row.id, row]));

    expect(byId[1].entity_name).toBe('ABCD2345');
    expect(byId[2].entity_name).toBe('');
    expect(byId[3].entity_name).toBe('Lan');
    expect(byId[1].ipAddress).toBe('1.2.3.4');
    for (const dropped of ['oldValues', 'newValues', 'userAgent', 'entityId']) expect(byId[1]).not.toHaveProperty(dropped);
  });

  it('caps the page size at 100', async () => {
    const result: any = await getAuditLogsImpl(makeLogsWithValues(), tables, { page: 1, pageSize: 100000 });
    expect(result.pageSize).toBe(100);
  });

  it('gives the saved values and the browser of one line', async () => {
    const result: any = await getAuditLogByIdImpl(makeLogsWithValues(), tables, 1);
    expect(result).toEqual({
      status: 'success',
      log: {
        id: 1,
        oldValues: '{"booking_code":"OLD12345"}',
        newValues: '{"booking_code":"ABCD2345","is_used":true}',
        userAgent: 'Mozilla/5.0'
      }
    });
    expect(await getAuditLogByIdImpl(makeLogsWithValues(), tables, 99)).toBeNull();
    expect(await getAuditLogByIdImpl(makeLogsWithValues(), tables, Number('abc'))).toBeNull();
  });
});
