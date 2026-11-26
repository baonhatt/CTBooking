import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { countActionItemsImpl, listEmailIssuesImpl, listOrderIssuesImpl } from './action-items';

// The real SQL on an in-memory SQLite database, so the chunked IN lists and the branch rules are really run.

const tables: any = {
  auditLogs: (schema as any).auditLogs,
  bookings: (schema as any).bookings,
  email_logs: (schema as any).email_logs
};

let db: any;
let raw: any;

const recent = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

function orderLine(id: number, bookingId: number, action = 'sepay_late_payment') {
  return {
    id,
    action,
    entity_type: 'booking',
    entity_id: bookingId,
    old_values: 'Tiền về sau hạn',
    new_values: JSON.stringify({ amount_received: 100000, bank_ref: 'FT' + id }),
    created_at: recent()
  };
}

function failedEmail(id: number, bookingId: number | null, emailType = 'booking_confirmation') {
  return {
    id,
    recipient: 'khach' + id + '@example.com',
    subject: 'Vé',
    email_type: emailType,
    status: 'failed',
    error_message: 'timeout',
    booking_id: bookingId,
    created_at: recent(),
    updated_at: recent()
  };
}

/** D1 refuses a query with more than 100 bound values; SQLite does not, so the test checks it. */
const D1_MAX_BOUND_VALUES = 100;
let largestBinding = 0;

beforeEach(() => {
  ({ db, raw } = makeSqliteDb(['auditLogs', 'bookings', 'email_logs']));
  largestBinding = 0;
  const prepare = raw.prepare.bind(raw);
  raw.prepare = (sqlText: string) => {
    const statement = prepare(sqlText);
    largestBinding = Math.max(largestBinding, (sqlText.match(/\?/g) || []).length);
    return statement;
  };
});

describe('action items count', () => {
  it('counts 250 open orders and their resolutions without a too-many-values error', async () => {
    const bookings = Array.from({ length: 250 }, (_, index) => ({
      id: index + 1,
      branch_id: 1,
      payment_status: 'expired',
      total_price: 100000,
      pay_txt_code: 'CS' + String(index).padStart(12, '0')
    }));
    insertRows(raw, 'bookings', bookings);
    insertRows(raw, 'auditLogs', bookings.map((booking) => orderLine(1000 + booking.id, booking.id)));
    // Two of them were marked handled, one order became paid since
    insertRows(raw, 'auditLogs', [
      { id: 5001, action: 'action_item_resolved', entity_type: 'audit_log', entity_id: 1001, new_values: '{}', created_at: recent() },
      { id: 5002, action: 'action_item_resolved', entity_type: 'audit_log', entity_id: 1002, new_values: '{}', created_at: recent() }
    ]);
    raw.prepare('UPDATE bookings SET payment_status = ? WHERE id = ?').run('paid', 3);

    const result = await countActionItemsImpl(db, tables, null);

    expect(result.orders).toBe(247);
    expect(largestBinding).toBeLessThanOrEqual(D1_MAX_BOUND_VALUES);
  });

  it('matches the open list', async () => {
    insertRows(raw, 'bookings', [
      { id: 1, branch_id: 1, payment_status: 'expired', total_price: 100000 },
      { id: 2, branch_id: 2, payment_status: 'expired', total_price: 100000 }
    ]);
    insertRows(raw, 'auditLogs', [orderLine(11, 1), orderLine(12, 2)]);
    insertRows(raw, 'email_logs', [failedEmail(21, 1), failedEmail(22, null, 'staff_credentials')]);

    const count = await countActionItemsImpl(db, tables, [1]);
    const orders = await listOrderIssuesImpl(db, tables, { status: 'open' }, [1]);
    const emails = await listEmailIssuesImpl(db, tables, { status: 'open' }, [1]);

    expect(count).toMatchObject({ orders: 1, emails: 1, total: 2 });
    expect(orders.total).toBe(1);
    expect(emails.total).toBe(1);
  });
});

describe('failed emails and branches', () => {
  beforeEach(() => {
    insertRows(raw, 'bookings', [{ id: 1, branch_id: 1, payment_status: 'paid', total_price: 100000 }]);
    insertRows(raw, 'email_logs', [failedEmail(21, 1), failedEmail(22, null, 'staff_credentials'), failedEmail(23, null, 'otp')]);
  });

  it('hides emails tied to no order from branch-limited staff', async () => {
    const emails = await listEmailIssuesImpl(db, tables, { status: 'open' }, [1]);
    expect(emails.items.map((item: any) => item.id)).toEqual([21]);
  });

  it('shows them to the Super Admin', async () => {
    const emails = await listEmailIssuesImpl(db, tables, { status: 'open' }, null);
    expect(emails.items.map((item: any) => item.id).sort()).toEqual([21, 22, 23]);
  });

  it('sends only the fields the screen reads', async () => {
    const [item]: any[] = (await listEmailIssuesImpl(db, tables, { status: 'open' }, null)).items;
    expect(Object.keys(item).sort()).toEqual(['can_resend', 'created_at', 'email_type', 'error_message', 'id', 'recipient', 'resolved']);
  });
});

describe('order issue rows', () => {
  it('send only the fields the screen reads', async () => {
    insertRows(raw, 'bookings', [{ id: 1, branch_id: 1, payment_status: 'expired', total_price: 100000, booking_code: 'ABCD2345' }]);
    insertRows(raw, 'auditLogs', [orderLine(11, 1)]);

    const [item]: any[] = (await listOrderIssuesImpl(db, tables, { status: 'open' }, null)).items;

    expect(item).toMatchObject({ id: 11, amount_received: 100000, bank_ref: 'FT11', details: 'Tiền về sau hạn' });
    for (const dropped of ['booking_id', 'booking_code', 'branch_id']) expect(item).not.toHaveProperty(dropped);
  });

  it('caps the page size', async () => {
    const result = await listOrderIssuesImpl(db, tables, { status: 'open', pageSize: 100000 }, null);
    expect(result.pageSize).toBe(50);
  });
});
