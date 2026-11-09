import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '../../../../shared/schema';
import { createPaymentImpl } from './create';
import { validateBookingInput } from './validate';
import { releaseVoucherForCancelledBooking } from '../../scheduled/booking-expiry';
import { PAY_CODE_PATTERN } from '../../../lib/pay-code';

vi.mock('./validate', () => ({ validateBookingInput: vi.fn() }));
vi.mock('../../scheduled/booking-expiry', () => ({
  releaseVoucherForCancelledBooking: vi.fn(async () => undefined)
}));

const { bookings, vouchers, booking_vr_items } = schema as any;
const tables: any = {
  bookings,
  users: (schema as any).users,
  accounts: (schema as any).accounts,
  movies: (schema as any).movies,
  ticket_packages: (schema as any).ticket_packages,
  branches: (schema as any).branches,
  vouchers,
  booking_vr_items,
  voucher_redemption_logs: (schema as any).voucher_redemption_logs
};

const COLLISION = new Error('D1_ERROR: UNIQUE constraint failed: bookings.pay_txt_code');

function validation(overrides: Record<string, any> = {}) {
  return {
    branchId: 2,
    user: { id: null, email: 'guest@example.com' },
    movies: [],
    ticketPackage: { id: 1, name: 'Vé thường', price: 100000 },
    movieItemsDetails: [{ package_id: 1, quantity: 1, price: 100000, name: 'Vé thường' }],
    vrItemsDetails: [],
    totalPrice: 100000,
    originalTotalPrice: 100000,
    voucherDiscountAmount: 0,
    voucherDetails: null,
    ...overrides
  };
}

const payload: any = {
  email: 'guest@example.com',
  emailBook: 'guest@example.com',
  phone: '0900000000',
  name: 'Guest',
  ticketCount: 1,
  paymentMethod: 'vietqr',
  // A browser that tries to choose its own payment reference
  pay_txt_code: 'CS999999999999'
};

type InsertBehaviour = (table: any, values: any) => Promise<any[]> | any[];

/** Fake database. `onInsert` decides what each insert does; `lockRows` is what the voucher lock update returns. */
function makeDb(onInsert: InsertBehaviour, lockRows: any[] = [{ used_count: 1 }]) {
  const inserts: Array<{ table: any; values: any }> = [];
  const updates: Array<{ table: any; values: any }> = [];

  const db: any = {
    insert: (table: any) => ({
      values: (values: any) => {
        inserts.push({ table, values });
        return { returning: async () => onInsert(table, values) };
      }
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          updates.push({ table, values });
          const rows = table === vouchers ? lockRows : [];
          return {
            returning: async () => rows,
            then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject)
          };
        }
      })
    })
  };
  return { db, inserts, updates };
}

const bookingInserts = (inserts: Array<{ table: any; values: any }>) => inserts.filter((entry) => entry.table === bookings);

const okInsert: InsertBehaviour = (table, values) => [{ id: 55, user_id: null, payment_status: 'pending', ...values }];

beforeEach(() => {
  vi.clearAllMocks();
  (validateBookingInput as any).mockResolvedValue(validation());
});

describe('createPaymentImpl: the payment reference', () => {
  it('generates the reference on the server and ignores the one the browser sent', async () => {
    const { db, inserts } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, payload, tables);

    expect(result.status).toBe(201);
    const saved = bookingInserts(inserts)[0].values;
    expect(saved.pay_txt_code).toMatch(PAY_CODE_PATTERN);
    expect(saved.pay_txt_code).not.toBe('CS999999999999');
    expect(result.booking.pay_txt_code).toBe(saved.pay_txt_code);
  });

  it('returns the payment deadline set by the server', async () => {
    const { db, inserts } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, payload, tables);

    const saved = bookingInserts(inserts)[0].values;
    expect(result.booking.payment_expires_at).toBe(saved.payment_expires_at);
    const minutesAhead = (Date.parse(saved.payment_expires_at) - Date.parse(saved.created_at)) / 60000;
    expect(minutesAhead).toBeCloseTo(10, 1);
  });

  it('tries a new reference when the first one collides, and does not touch the voucher', async () => {
    let attempts = 0;
    const { db, inserts } = makeDb((table, values) => {
      attempts += 1;
      if (attempts === 1) throw COLLISION;
      return okInsert(table, values);
    });

    const result: any = await createPaymentImpl(db, payload, tables);

    expect(result.status).toBe(201);
    const codes = bookingInserts(inserts).map((entry) => entry.values.pay_txt_code);
    expect(codes).toHaveLength(2);
    expect(codes[0]).not.toBe(codes[1]);
    expect(releaseVoucherForCancelledBooking).not.toHaveBeenCalled();
  });

  it('gives up after five collisions with a plain error, not the database text', async () => {
    const { db, inserts } = makeDb(() => {
      throw COLLISION;
    });

    const result: any = await createPaymentImpl(db, payload, tables);

    expect(bookingInserts(inserts)).toHaveLength(5);
    expect(result.status).toBe(500);
    expect(result.message).not.toMatch(/UNIQUE|pay_txt_code|D1_ERROR/);
  });
});

describe('createPaymentImpl: branch', () => {
  it('saves the branch the validation decided on, never an empty one', async () => {
    (validateBookingInput as any).mockResolvedValue(validation({ branchId: 7 }));
    const { db, inserts } = makeDb(okInsert);

    await createPaymentImpl(db, { ...payload, branch_id: undefined }, tables);

    expect(bookingInserts(inserts)[0].values.branch_id).toBe(7);
  });
});

describe('createPaymentImpl: voucher slot', () => {
  const voucherValidation = () =>
    validation({ voucherDetails: { id: 11, code: 'SALE10' }, voucherDiscountAmount: 10000, totalPrice: 90000 });

  it('rejects the order when the last voucher slot was just taken, and saves nothing', async () => {
    (validateBookingInput as any).mockResolvedValue(voucherValidation());
    const { db, inserts } = makeDb(okInsert, []);

    const result: any = await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(result.status).toBe(409);
    expect(bookingInserts(inserts)).toHaveLength(0);
    expect(releaseVoucherForCancelledBooking).not.toHaveBeenCalled();
  });

  it('gives the slot back when saving the booking fails', async () => {
    (validateBookingInput as any).mockResolvedValue(voucherValidation());
    const { db } = makeDb(() => {
      throw new Error('D1_ERROR: database is busy');
    });

    const result: any = await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(result.status).toBe(500);
    expect(result.message).not.toMatch(/D1_ERROR|busy/);
    expect(releaseVoucherForCancelledBooking).toHaveBeenCalledTimes(1);
    expect((releaseVoucherForCancelledBooking as any).mock.calls[0][2]).toEqual({
      voucher_id: 11,
      previous_payment_status: 'pending'
    });
  });

  it('gives the slot back once, not once per failed attempt', async () => {
    (validateBookingInput as any).mockResolvedValue(voucherValidation());
    const { db } = makeDb(() => {
      throw COLLISION;
    });

    await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(releaseVoucherForCancelledBooking).toHaveBeenCalledTimes(1);
  });

  it('keeps the slot when the booking is saved', async () => {
    (validateBookingInput as any).mockResolvedValue(voucherValidation());
    const { db } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(result.status).toBe(201);
    expect(releaseVoucherForCancelledBooking).not.toHaveBeenCalled();
  });
});

describe('createPaymentImpl: VR lines', () => {
  const vrValidation = () =>
    validation({
      vrItemsDetails: [{ vr_package_id: 5, quantity: 2, unit_price: 50000, package_name: 'VR 30', line_total: 100000, branch_id: 2 }],
      voucherDetails: { id: 11, code: 'SALE10' },
      totalPrice: 190000,
      originalTotalPrice: 200000,
      voucherDiscountAmount: 10000
    });

  it('cancels the booking, gives the voucher slot back and reports an error when a VR line cannot be saved', async () => {
    (validateBookingInput as any).mockResolvedValue(vrValidation());
    const { db, updates } = makeDb((table, values) => {
      if (table === booking_vr_items) throw new Error('D1_ERROR: FOREIGN KEY constraint failed');
      return okInsert(table, values);
    });

    const result: any = await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(result.status).toBe(500);
    expect(result.message).not.toMatch(/FOREIGN KEY|D1_ERROR/);
    expect(result).not.toHaveProperty('booking');

    const cancel = updates.find((entry) => entry.table === bookings);
    expect(cancel?.values.payment_status).toBe('failed');
    expect(releaseVoucherForCancelledBooking).toHaveBeenCalledTimes(1);
  });

  it('returns the saved VR lines when everything works', async () => {
    (validateBookingInput as any).mockResolvedValue(vrValidation());
    const { db, inserts } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, { ...payload, voucher_code: 'SALE10' }, tables);

    expect(result.status).toBe(201);
    expect(inserts.some((entry) => entry.table === booking_vr_items)).toBe(true);
    expect(result.booking.vr_items.length).toBeGreaterThan(0);
  });
});

describe('createPaymentImpl: errors', () => {
  it('passes on a deliberate validation error with its own status and message', async () => {
    (validateBookingInput as any).mockRejectedValue(Object.assign(new Error('Chi nhánh hiện đang đóng cửa.'), { status: 403 }));
    const { db, inserts } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, payload, tables);

    expect(result).toEqual({ status: 403, message: 'Chi nhánh hiện đang đóng cửa.' });
    expect(inserts).toHaveLength(0);
  });

  it('hides the text of an unexpected failure', async () => {
    (validateBookingInput as any).mockRejectedValue(new Error('TypeError: cannot read properties of undefined'));
    const { db } = makeDb(okInsert);

    const result: any = await createPaymentImpl(db, payload, tables);

    expect(result.status).toBe(500);
    expect(result.message).toBe('Lỗi máy chủ nội bộ');
  });
});
