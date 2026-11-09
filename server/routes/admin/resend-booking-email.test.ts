import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { resendBookingEmailImpl } from './resend-booking-email';
import { mailQueue } from '../../lib/mail-queue';

vi.mock('../../lib/mail-queue', () => ({ mailQueue: { add: vi.fn() } }));

const tables: any = {
  bookings: (schema as any).bookings,
  ticket_packages: (schema as any).ticket_packages,
  branches: (schema as any).branches,
  email_logs: (schema as any).email_logs,
  auditLogs: (schema as any).auditLogs
};

const staff = { id: 20, email: 'staff@example.com', fullname: 'Staff' };

function bookingRow(overrides: Record<string, any> = {}) {
  return {
    id: 55,
    branch_id: 2,
    payment_status: 'paid',
    email: 'guest@example.com',
    name: 'Guest',
    booking_code: 'ABCD2345',
    user_id: null,
    total_price: 100000,
    ticket_count: 1,
    ...overrides
  };
}

function makeDb(row: any) {
  const audits: any[] = [];
  const lookup: any = {
    leftJoin: () => lookup,
    where: () => lookup,
    limit: async () => (row ? [{ booking: row, branch_name: 'Q1', package_name: 'Vé thường' }] : [])
  };
  const db: any = {
    query: { bookings: { findFirst: vi.fn(async () => row) } },
    select: () => ({ from: () => lookup }),
    insert: (table: any) => ({
      values: async (values: any) => {
        if (table === tables.auditLogs) audits.push(values);
      }
    })
  };
  return { db, audits };
}

const send = (db: any, body: any, scope: number[] | null) =>
  resendBookingEmailImpl(db, tables, body, staff, scope, async () => ({ ok: true }), () => '<p>mail</p>');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resendBookingEmailImpl', () => {
  it('queues the confirmation email to the address on the order, and writes an audit line', async () => {
    const { db, audits } = makeDb(bookingRow());

    const result: any = await send(db, { booking_id: 55 }, [2]);

    expect(result.status).toBe(200);
    expect(mailQueue.add).toHaveBeenCalledTimes(1);
    const metadata = (mailQueue.add as any).mock.calls[0][1];
    expect(metadata).toMatchObject({
      recipient: 'guest@example.com',
      emailType: 'booking_confirmation',
      bookingId: 55
    });
    expect(metadata.emailLogsTable).toBe(tables.email_logs);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'resend_booking_email', staffId: 20, entityId: '55' });
  });

  it('takes the recipient from the order, not from the request', async () => {
    const { db } = makeDb(bookingRow());

    await send(db, { booking_id: 55, email: 'attacker@example.com', recipient: 'attacker@example.com' }, null);

    expect((mailQueue.add as any).mock.calls[0][1].recipient).toBe('guest@example.com');
  });

  it('lets the Super Admin (no limit) send for any branch, even an order with no branch', async () => {
    const { db } = makeDb(bookingRow({ branch_id: null }));
    expect(((await send(db, { booking_id: 55 }, null)) as any).status).toBe(200);
  });

  it('refuses an order of another branch', async () => {
    const { db, audits } = makeDb(bookingRow({ branch_id: 3 }));

    const result: any = await send(db, { booking_id: 55 }, [2]);

    expect(result.status).toBe(403);
    expect(mailQueue.add).not.toHaveBeenCalled();
    expect(audits).toHaveLength(0);
  });

  it('refuses an order with no branch, and a staff member with no branch at all', async () => {
    const noBranch = makeDb(bookingRow({ branch_id: null }));
    expect(((await send(noBranch.db, { booking_id: 55 }, [2])) as any).status).toBe(403);

    const noScope = makeDb(bookingRow());
    expect(((await send(noScope.db, { booking_id: 55 }, [])) as any).status).toBe(403);
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it.each(['pending', 'failed', 'expired', null])('refuses an order that is %p (only paid orders have a confirmation)', async (status) => {
    const { db } = makeDb(bookingRow({ payment_status: status }));

    const result: any = await send(db, { booking_id: 55 }, null);

    expect(result.status).toBe(409);
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('accepts the status in any letter case', async () => {
    const { db } = makeDb(bookingRow({ payment_status: 'PAID' }));
    expect(((await send(db, { booking_id: 55 }, null)) as any).status).toBe(200);
  });

  it('refuses a missing or invalid booking id, an unknown order, and an order with no email', async () => {
    const { db } = makeDb(bookingRow());
    for (const bad of [undefined, 0, -1, 1.5, 'abc', null]) {
      expect(((await send(db, { booking_id: bad }, null)) as any).status).toBe(400);
    }
    expect(((await send(makeDb(undefined).db, { booking_id: 55 }, null)) as any).status).toBe(404);
    expect(((await send(makeDb(bookingRow({ email: '' })).db, { booking_id: 55 }, null)) as any).status).toBe(409);
    expect(mailQueue.add).not.toHaveBeenCalled();
  });
});
