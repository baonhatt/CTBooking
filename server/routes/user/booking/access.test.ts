import { describe, it, expect, vi } from 'vitest';
import { bookingStatusPayload, findBookingForOwner } from './access';
import { makeOrderToken } from '../../../lib/order-token';

const SECRET = 'test-secret';
const tables = { bookings: { id: 'bookings.id' } as any, accounts: { id: 'accounts.id' } as any };

function booking(overrides: Record<string, any> = {}) {
  return {
    id: 55,
    pay_txt_code: 'CS482913057741',
    user_id: null,
    email: 'guest@example.com',
    payment_status: 'pending',
    payment_expires_at: '2026-11-09T10:10:00.000Z',
    ...overrides
  };
}

function makeDb(bookingRow: any, accountRow?: any) {
  return {
    query: {
      bookings: { findFirst: vi.fn(async () => bookingRow) },
      accounts: { findFirst: vi.fn(async () => accountRow) }
    }
  };
}

async function tokenFor(row = booking()) {
  return makeOrderToken(SECRET, row.id, row.pay_txt_code);
}

describe('findBookingForOwner: the order token', () => {
  it('returns the booking for the right token', async () => {
    const row = booking();
    const found = await findBookingForOwner(makeDb(row), tables, {
      bookingId: 55,
      orderToken: await tokenFor(row),
      secret: SECRET
    });
    expect(found).toBe(row);
  });

  it('returns null for no token, a wrong token, or another order\'s token', async () => {
    const row = booking();
    const other = booking({ id: 56, pay_txt_code: 'CS000000000001' });
    const db = makeDb(row);

    expect(await findBookingForOwner(db, tables, { bookingId: 55, secret: SECRET })).toBeNull();
    expect(await findBookingForOwner(db, tables, { bookingId: 55, orderToken: 'x'.repeat(64), secret: SECRET })).toBeNull();
    expect(
      await findBookingForOwner(db, tables, { bookingId: 55, orderToken: await tokenFor(other), secret: SECRET })
    ).toBeNull();
  });

  it('returns null for a token made with another secret', async () => {
    const row = booking();
    const foreignToken = await makeOrderToken('other-secret', row.id, row.pay_txt_code);
    expect(
      await findBookingForOwner(makeDb(row), tables, { bookingId: 55, orderToken: foreignToken, secret: SECRET })
    ).toBeNull();
  });

  it('returns null, and reads nothing, for an invalid booking id', async () => {
    const db = makeDb(booking());
    for (const bookingId of [0, -1, 1.5, NaN, Number.POSITIVE_INFINITY]) {
      expect(await findBookingForOwner(db, tables, { bookingId, orderToken: 'x', secret: SECRET })).toBeNull();
    }
    expect(db.query.bookings.findFirst).not.toHaveBeenCalled();
  });

  it('answers the same for a booking that does not exist', async () => {
    const result = await findBookingForOwner(makeDb(undefined), tables, {
      bookingId: 55,
      orderToken: 'whatever',
      secret: SECRET
    });
    expect(result).toBeNull();
  });
});

describe('findBookingForOwner: a signed-in owner', () => {
  it('accepts an account whose user id matches the booking', async () => {
    const row = booking({ user_id: 9, email: 'someone-else@example.com' });
    const found = await findBookingForOwner(makeDb(row, { id: 3, user_id: 9, email: 'me@example.com' }), tables, {
      bookingId: 55,
      secret: SECRET,
      accountId: 3
    });
    expect(found).toBe(row);
  });

  it('accepts an account whose email matches the booking email, ignoring case', async () => {
    const row = booking({ user_id: null, email: 'Me@Example.com' });
    const found = await findBookingForOwner(makeDb(row, { id: 3, user_id: 9, email: 'me@example.COM' }), tables, {
      bookingId: 55,
      secret: SECRET,
      accountId: 3
    });
    expect(found).toBe(row);
  });

  it('refuses an account that owns neither by user id nor by email', async () => {
    const row = booking({ user_id: 10, email: 'owner@example.com' });
    const found = await findBookingForOwner(makeDb(row, { id: 3, user_id: 9, email: 'me@example.com' }), tables, {
      bookingId: 55,
      secret: SECRET,
      accountId: 3
    });
    expect(found).toBeNull();
  });

  it('does not match two missing user ids as "the same user"', async () => {
    const row = booking({ user_id: null, email: 'guest@example.com' });
    const found = await findBookingForOwner(makeDb(row, { id: 3, user_id: null, email: 'other@example.com' }), tables, {
      bookingId: 55,
      secret: SECRET,
      accountId: 3
    });
    expect(found).toBeNull();
  });

  it('refuses when the account does not exist or there is no account', async () => {
    const row = booking({ user_id: 9 });
    expect(await findBookingForOwner(makeDb(row, undefined), tables, { bookingId: 55, secret: SECRET, accountId: 3 })).toBeNull();
    expect(await findBookingForOwner(makeDb(row), tables, { bookingId: 55, secret: SECRET, accountId: null })).toBeNull();
  });
});

describe('bookingStatusPayload', () => {
  it('holds only the payment state, the deadline and the server clock while the order is not paid', () => {
    const payload = bookingStatusPayload(booking({ name: 'Nguyen Van A', phone: '0900000000', booking_code: 'ABCD2345' }) as any);

    expect(Object.keys(payload).sort()).toEqual(['id', 'payment_expires_at', 'payment_status', 'server_now', 'status']);
    expect(JSON.stringify(payload)).not.toMatch(/Nguyen|0900000000|guest@example|ABCD2345|CS482913057741/);
  });

  it('adds the ticket code once the order is paid, and still no personal data', () => {
    const payload = bookingStatusPayload(
      booking({ payment_status: 'paid', name: 'Nguyen Van A', phone: '0900000000', booking_code: 'ABCD2345' }) as any
    );

    expect(payload.booking_code).toBe('ABCD2345');
    expect(Object.keys(payload).sort()).toEqual([
      'booking_code',
      'id',
      'payment_expires_at',
      'payment_status',
      'server_now',
      'status'
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/Nguyen|0900000000|guest@example|CS482913057741/);
  });

  it('gives no ticket code for a paid order that has none yet', () => {
    const payload = bookingStatusPayload(booking({ payment_status: 'paid', booking_code: null }) as any);
    expect('booking_code' in payload).toBe(false);
  });

  it('lower-cases the status and defaults a missing one to pending', () => {
    expect(bookingStatusPayload(booking({ payment_status: 'PAID' }) as any).payment_status).toBe('paid');
    expect(bookingStatusPayload(booking({ payment_status: null }) as any).payment_status).toBe('pending');
  });

  it('gives the server clock as an ISO time with Z, so a browser reads it as UTC', () => {
    expect(bookingStatusPayload(booking() as any).server_now).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('gives null when there is no deadline', () => {
    expect(bookingStatusPayload(booking({ payment_expires_at: null }) as any).payment_expires_at).toBeNull();
  });
});
