import { describe, it, expect, vi, beforeEach } from 'vitest';
import publicRouter from './publicRouter';
import { makeOrderToken } from '../../../server/lib/order-token';
import { createPaymentImpl } from '../../../server/routes/user/booking/create';
import { createVRBookingImpl } from '../../../server/routes/user/vr-bookings';
import { updatePaymentImpl } from '../../../server/routes/user/booking/update';
import { validateSessionTokenImpl } from '../../../server/routes/user/auth';
import { payFreeOrderNow } from '../../../server/routes/user/booking/free-order';

const fakeDb: any = {
  query: {
    bookings: { findFirst: vi.fn() },
    accounts: { findFirst: vi.fn() }
  }
};

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => fakeDb }));
vi.mock('../../../server/routes/user/booking/create', () => ({ createPaymentImpl: vi.fn() }));
vi.mock('../../../server/routes/user/booking/update', () => ({ updatePaymentImpl: vi.fn() }));
vi.mock('../../../server/routes/user/vr-bookings', () => ({
  listActiveVRPackagesImpl: vi.fn(),
  validateVRBookingImpl: vi.fn(),
  createVRBookingImpl: vi.fn()
}));
vi.mock('../../../server/routes/user/auth', () => ({ validateSessionTokenImpl: vi.fn() }));
vi.mock('../../../server/routes/user/booking/free-order', () => ({ payFreeOrderNow: vi.fn() }));

const SECRET = 'router-test-secret';
const REAL_HOST = 'https://api.example.com';
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };
const env = { cinema_db: {}, ORDER_TOKEN_SECRET: SECRET };

const BOOKING = {
  id: 55,
  pay_txt_code: 'CS482913057741',
  user_id: null,
  email: 'guest@example.com',
  name: 'Nguyen Van A',
  phone: '0900000000',
  payment_status: 'pending',
  // Still inside its 10 minutes, so the routes do not expire it (see the "overdue" tests below)
  payment_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
};

function call(path: string, init: RequestInit = {}, environment: any = env, host = REAL_HOST) {
  return publicRouter.request(`${host}${path}`, init, environment, executionContext);
}

function post(path: string, body: unknown, headers: Record<string, string> = {}, environment: any = env, host = REAL_HOST) {
  return call(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) },
    environment,
    host
  );
}

const tokenFor = (booking = BOOKING) => makeOrderToken(SECRET, booking.id, booking.pay_txt_code);

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.query.bookings.findFirst.mockResolvedValue(BOOKING);
  fakeDb.query.accounts.findFirst.mockResolvedValue(undefined);
  (validateSessionTokenImpl as any).mockResolvedValue({ valid: false });
  (updatePaymentImpl as any).mockResolvedValue({ status: 200, message: 'ok' });
  (payFreeOrderNow as any).mockResolvedValue(null);
});

/** A new order row as the create functions return it: more than the booking page may see. */
const CREATED_ROW = {
  id: 55,
  pay_txt_code: 'CS482913057741',
  payment_expires_at: '2026-11-09T10:10:00.000Z',
  payment_status: 'pending',
  user_id: 9,
  name: 'Nguyen Van A',
  phone: '0900000000',
  email: 'guest@example.com',
  total_price: 90000,
  vr_items: [{ id: 1, booking_id: 55, voucher_id: 3 }]
};

const CUSTOMER_BOOKING_KEYS = [
  'booking_code',
  'id',
  'order_token',
  'pay_txt_code',
  'payment_expires_at',
  'payment_status',
  'server_now'
];

describe('GET /api/bookings/:id (payment status)', () => {
  it('answers 404 without a token, the same as for an order that does not exist', async () => {
    const withoutToken = await call('/api/bookings/55');
    fakeDb.query.bookings.findFirst.mockResolvedValue(undefined);
    const missing = await call('/api/bookings/9999', { headers: { 'X-Order-Token': 'x'.repeat(64) } });

    expect(withoutToken.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await withoutToken.json()).toEqual(await missing.json());
  });

  it('answers 404 for a wrong token', async () => {
    const response = await call('/api/bookings/55', { headers: { 'X-Order-Token': 'f'.repeat(64) } });
    expect(response.status).toBe(404);
  });

  it('answers 404 for the token of another order', async () => {
    const other = await makeOrderToken(SECRET, 56, 'CS000000000001');
    const response = await call('/api/bookings/55', { headers: { 'X-Order-Token': other } });
    expect(response.status).toBe(404);
  });

  it('returns only the payment state with the right token', async () => {
    const response = await call('/api/bookings/55', { headers: { 'X-Order-Token': await tokenFor() } });
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['id', 'payment_expires_at', 'payment_status', 'server_now', 'status']);
    expect(JSON.stringify(body)).not.toMatch(/Nguyen|0900000000|guest@example|CS482913057741/);
  });

  it('works the same on the VR path', async () => {
    const denied = await call('/api/vr/bookings/55');
    const allowed = await call('/api/vr/bookings/55', { headers: { 'X-Order-Token': await tokenFor() } });

    expect(denied.status).toBe(404);
    expect(allowed.status).toBe(200);
  });

  it('lets a signed-in owner read it without a token', async () => {
    fakeDb.query.bookings.findFirst.mockResolvedValue({ ...BOOKING, user_id: 9 });
    fakeDb.query.accounts.findFirst.mockResolvedValue({ id: 3, user_id: 9, email: 'me@example.com' });
    (validateSessionTokenImpl as any).mockResolvedValue({ valid: true, accountId: 3 });

    const response = await call('/api/bookings/55', { headers: { Authorization: 'Bearer session-abc' } });

    expect(response.status).toBe(200);
  });

  it('does not let a signed-in stranger read it', async () => {
    fakeDb.query.bookings.findFirst.mockResolvedValue({ ...BOOKING, user_id: 10, email: 'owner@example.com' });
    fakeDb.query.accounts.findFirst.mockResolvedValue({ id: 3, user_id: 9, email: 'me@example.com' });
    (validateSessionTokenImpl as any).mockResolvedValue({ valid: true, accountId: 3 });

    const response = await call('/api/bookings/55', { headers: { Authorization: 'Bearer session-abc' } });

    expect(response.status).toBe(404);
  });

  it('answers 500 "not ready" on a real host without the secret, and reads no booking', async () => {
    const response = await call('/api/bookings/55', {}, { cinema_db: {} });

    expect(response.status).toBe(500);
    expect(fakeDb.query.bookings.findFirst).not.toHaveBeenCalled();
  });
});

describe('GET /api/bookings/:id on an overdue order', () => {
  it('expires it at once instead of waiting for the cron', async () => {
    const overdue = { ...BOOKING, payment_expires_at: new Date(Date.now() - 60 * 1000).toISOString() };
    fakeDb.query.bookings.findFirst.mockResolvedValue(overdue);
    const updated: any[] = [];
    fakeDb.update = () => ({
      set: (values: any) => ({
        where: () => ({
          returning: async () => {
            updated.push(values);
            return [{ id: 55 }];
          }
        })
      })
    });

    const response = await call('/api/bookings/55', { headers: { 'X-Order-Token': await tokenFor() } });
    const body: any = await response.json();

    expect(body.payment_status).toBe('expired');
    expect(updated[0].payment_status).toBe('expired');
    delete fakeDb.update;
  });
});

describe('POST /api/cancel-booking', () => {
  it('refuses without proof of ownership and cancels nothing', async () => {
    const response = await post('/api/cancel-booking', { payment_id: 55, payment_status: 'failed' });

    expect(response.status).toBe(404);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('cancels with the right token, and sends only the booking id and "cancelled"', async () => {
    const response = await post(
      '/api/cancel-booking',
      { payment_id: 55, payment_status: 'paid', transaction_id: 'FAKE', amount: 1 },
      { 'X-Order-Token': await tokenFor() }
    );

    expect(response.status).toBe(200);
    const sent = (updatePaymentImpl as any).mock.calls[0][1];
    expect(sent).toEqual({ payment_id: 55, payment_status: 'cancelled' });
  });

  it('cannot be used to mark an order paid', async () => {
    await post('/api/cancel-booking', { payment_id: 55, payment_status: 'paid' }, { 'X-Order-Token': await tokenFor() });

    expect((updatePaymentImpl as any).mock.calls[0][1].payment_status).toBe('cancelled');
  });

  it('an order past its 10 minutes (the countdown ran out) is closed as "expired"', async () => {
    const overdue = { ...BOOKING, payment_expires_at: new Date(Date.now() - 60 * 1000).toISOString() };
    fakeDb.query.bookings.findFirst.mockResolvedValue(overdue);

    await post('/api/cancel-booking', { payment_id: 55 }, { 'X-Order-Token': await tokenFor() });

    expect((updatePaymentImpl as any).mock.calls[0][1].payment_status).toBe('expired');
  });

  it('refuses another order\'s token', async () => {
    const other = await makeOrderToken(SECRET, 56, 'CS000000000001');
    const response = await post('/api/cancel-booking', { payment_id: 55 }, { 'X-Order-Token': other });

    expect(response.status).toBe(404);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('sends back only the status and the message, never the booking row', async () => {
    (updatePaymentImpl as any).mockResolvedValue({
      status: 200,
      message: 'Đã hủy',
      booking: { id: 55, confirmed_by_staff_id: 4, transaction_id: 'TX1', email: 'guest@example.com' }
    });

    const response = await post('/api/cancel-booking', { payment_id: 55 }, { 'X-Order-Token': await tokenFor() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'success', message: 'Đã hủy' });
  });

  it('passes on a conflict from the update (for example an order that was already paid)', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 409, message: 'Đơn đã thanh toán' });

    const response = await post('/api/cancel-booking', { payment_id: 55 }, { 'X-Order-Token': await tokenFor() });

    expect(response.status).toBe(409);
    expect(((await response.json()) as any).status).toBe('error');
  });
});

describe('POST /api/create-booking', () => {
  it('adds an order token that proves ownership of the new order', async () => {
    (createPaymentImpl as any).mockResolvedValue({
      status: 201,
      booking: { id: 55, pay_txt_code: 'CS482913057741', payment_expires_at: '2026-11-09T10:10:00.000Z' }
    });

    const response = await post('/api/create-booking', { name: 'A' });
    const body: any = await response.json();

    expect(response.status).toBe(201);
    expect(body.status).toBe('success');
    expect(body.booking.order_token).toBe(await tokenFor());
    expect(body.booking.server_now).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('sends back only what the booking page reads (no name, phone, email, user id or prices)', async () => {
    (createPaymentImpl as any).mockResolvedValue({ status: 201, message: 'ok', booking: { ...CREATED_ROW } });

    const body: any = await (await post('/api/create-booking', { name: 'A' })).json();

    expect(Object.keys(body.booking).sort()).toEqual(CUSTOMER_BOOKING_KEYS);
    expect(body.booking).toMatchObject({ id: 55, payment_status: 'pending', booking_code: null });
    expect(JSON.stringify(body)).not.toMatch(/Nguyen|0900000000|guest@example/);
  });

  it('a 0đ order comes back paid, with its ticket code', async () => {
    (createPaymentImpl as any).mockResolvedValue({ status: 201, booking: { ...CREATED_ROW, total_price: 0 } });
    (payFreeOrderNow as any).mockResolvedValue({ payment_status: 'paid', booking_code: 'TK123456' });

    const body: any = await (await post('/api/create-booking', { name: 'A' })).json();

    expect(body.booking.payment_status).toBe('paid');
    expect(body.booking.booking_code).toBe('TK123456');
    expect(body.booking.order_token).toBe(await tokenFor());
  });

  it('adds no token to a failed order', async () => {
    (createPaymentImpl as any).mockResolvedValue({ status: 409, message: 'Voucher đã hết lượt' });

    const response = await post('/api/create-booking', {});
    const body: any = await response.json();

    expect(response.status).toBe(409);
    expect(body.booking).toBeUndefined();
  });

  it('refuses before creating anything when the secret is missing on a real host', async () => {
    const response = await post('/api/create-booking', {}, {}, { cinema_db: {} });

    expect(response.status).toBe(500);
    expect(createPaymentImpl).not.toHaveBeenCalled();
  });

  it('works on localhost without a configured secret', async () => {
    (createPaymentImpl as any).mockResolvedValue({
      status: 201,
      booking: { id: 55, pay_txt_code: 'CS482913057741' }
    });

    const response = await post('/api/create-booking', {}, {}, { cinema_db: {} }, 'http://localhost:8787');

    expect(response.status).toBe(201);
    expect(((await response.json()) as any).booking.order_token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives no stack trace or database text on an unexpected failure', async () => {
    (createPaymentImpl as any).mockRejectedValue(new Error('D1_ERROR: no such table: bookings'));

    const response = await post('/api/create-booking', {});
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toMatch(/D1_ERROR|no such table|at /);
  });
});

describe('POST /api/vr/create-booking', () => {
  it('adds an order token and passes the branches table', async () => {
    (createVRBookingImpl as any).mockResolvedValue({
      status: 201,
      success: true,
      booking: { id: 55, pay_txt_code: 'CS482913057741' }
    });

    const response = await post('/api/vr/create-booking', { items: [] });
    const body: any = await response.json();

    expect(response.status).toBe(201);
    expect(body.booking.order_token).toBe(await tokenFor());
    expect((createVRBookingImpl as any).mock.calls[0][2]).toHaveProperty('branches');
  });

  it('sends back only what the booking page reads, and the 0đ result', async () => {
    (createVRBookingImpl as any).mockResolvedValue({
      status: 201,
      success: true,
      booking: { ...CREATED_ROW, voucher_id: 3, voucher_code_snapshot: 'SALE10' }
    });
    (payFreeOrderNow as any).mockResolvedValue({ payment_status: 'paid', booking_code: 'TK654321' });

    const body: any = await (await post('/api/vr/create-booking', { items: [] })).json();

    expect(body.success).toBe(true);
    expect(Object.keys(body.booking).sort()).toEqual(CUSTOMER_BOOKING_KEYS);
    expect(body.booking.booking_code).toBe('TK654321');
  });

  it('refuses before creating anything when the secret is missing', async () => {
    const response = await post('/api/vr/create-booking', {}, {}, { cinema_db: {} });

    expect(response.status).toBe(500);
    expect(createVRBookingImpl).not.toHaveBeenCalled();
  });
});
