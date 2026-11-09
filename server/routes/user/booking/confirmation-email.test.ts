import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '../../../../shared/schema';
import { queueBookingConfirmationEmail } from './confirmation-email';
import { validateBookingInput } from './validate';
import { getBookingByCodeImpl } from './query';
import { mailQueue } from '../../../lib/mail-queue';

vi.mock('../../../lib/mail-queue', () => ({ mailQueue: { add: vi.fn() } }));

const EVIL = '<a href="http://evil.test">x</a>';
const tables: any = { email_logs: (schema as any).email_logs, vouchers: undefined, booking_vr_items: undefined };

beforeEach(() => {
  vi.clearAllMocks();
});

/** Runs the queued email task and returns the data the template received. */
async function runQueuedTask(booking: any, source: any = {}) {
  const sent: any[] = [];
  let templateData: any = null;
  queueBookingConfirmationEmail({
    anyDb: {},
    tables,
    source: { booking, ...source },
    updatedBooking: booking,
    bookingCode: 'ABCD2345',
    sendMailFn: async (to, subject, html) => {
      sent.push({ to, subject, html });
    },
    getBookingEmailHtml: (data) => {
      templateData = data;
      return '<p>mail</p>';
    }
  });
  const task = (mailQueue.add as any).mock.calls[0][0];
  await task();
  return { sent, templateData };
}

describe('queueBookingConfirmationEmail', () => {
  const booking = {
    id: 55,
    email: 'guest@example.com',
    name: 'Guest',
    booking_type: 'movie',
    ticket_count: 1,
    total_price: 100000,
    ticket_package_name: EVIL,
    pay_txt_code: 'CS123456789012',
    user_id: null
  };

  it('puts one email in the queue, with an email log row for it', async () => {
    await runQueuedTask(booking);

    expect(mailQueue.add).toHaveBeenCalledTimes(1);
    const metadata = (mailQueue.add as any).mock.calls[0][1];
    expect(metadata).toMatchObject({ recipient: 'guest@example.com', emailType: 'booking_confirmation', bookingId: 55 });
    expect(metadata.emailLogsTable).toBe(tables.email_logs);
  });

  it('sends it to the order address with the booking code in the subject', async () => {
    const { sent } = await runQueuedTask(booking);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('guest@example.com');
    expect(sent[0].subject).toContain('ABCD2345');
  });

  it('escapes the package name in the table it hands to the template', async () => {
    const { templateData } = await runQueuedTask(booking);

    expect(templateData.moviePackagesTableHtml).not.toContain('<a href="http://evil.test">');
    expect(templateData.moviePackagesTableHtml).toContain('&lt;a href=&quot;http://evil.test&quot;&gt;x&lt;/a&gt;');
  });
});

describe('booking input: name and email', () => {
  const base: any = { email: 'a@b.co', emailBook: 'a@b.co', phone: '0900000000', name: 'An', ticketCount: 1 };
  const failingDb: any = {
    select: () => {
      throw new Error('the database must not be reached');
    }
  };
  const bookingTables: any = { users: {}, accounts: {}, movies: {}, ticket_packages: {}, branches: {} };

  it.each([
    ['a name with a tag', { name: EVIL }, /Họ tên/],
    ['a name over 100 characters', { name: 'a'.repeat(101) }, /Họ tên/],
    ['a bad booking email', { emailBook: 'not-an-email' }, /Email/],
    ['a bad account email', { email: 'a b@c.co' }, /Email/],
    ['an email over 254 characters', { emailBook: `${'a'.repeat(250)}@b.co` }, /Email/]
  ])('refuses %s with a 400 before touching the database', async (_label, override, message) => {
    await expect(validateBookingInput(failingDb, { ...base, ...override }, bookingTables)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(message)
    });
  });
});

describe('getBookingByCodeImpl: email status', () => {
  function makeDb(emailRows: any[]) {
    const booking = { id: 55, payment_status: 'paid', booking_code: 'ABCD2345', total_price: 100000, ticket_count: 1 };
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: async () => emailRows
    };
    return { query: { bookings: { findFirst: async () => booking } }, select: () => chain } as any;
  }
  const bookingTables: any = { bookings: (schema as any).bookings, email_logs: (schema as any).email_logs };

  it('says "none" when no confirmation email was ever tried', async () => {
    const result: any = await getBookingByCodeImpl(makeDb([]), 'ABCD2345', bookingTables);
    expect(result.email_status).toEqual({ state: 'none', at: null });
  });

  it.each([
    ['sent', 'sent'],
    ['failed', 'failed'],
    ['pending', 'pending'],
    ['something-else', 'pending']
  ])('reports a %s email as %s', async (stored, expected) => {
    const result: any = await getBookingByCodeImpl(
      makeDb([{ status: stored, sent_at: '2026-11-09 10:00:00', created_at: '2026-11-09 09:59:00' }]),
      'ABCD2345',
      bookingTables
    );
    expect(result.email_status).toEqual({ state: expected, at: '2026-11-09 10:00:00' });
  });

  it('falls back to the creation time when nothing was sent', async () => {
    const result: any = await getBookingByCodeImpl(
      makeDb([{ status: 'failed', sent_at: null, created_at: '2026-11-09 09:59:00' }]),
      'ABCD2345',
      bookingTables
    );
    expect(result.email_status.at).toBe('2026-11-09 09:59:00');
  });
});
