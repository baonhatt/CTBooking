import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { getEmailLogsImpl } from './email-logs';
import { getUserByIdImpl } from './users';

// Email logs and the customer detail on a real in-memory SQLite database.

describe('email logs', () => {
  it('caps the limit at 100', async () => {
    const { db, raw } = makeSqliteDb(['email_logs', 'users', 'bookings']);
    const rows = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      recipient: 'k' + index + '@example.com',
      subject: 'Vé',
      email_type: 'booking_confirmation',
      status: 'sent',
      created_at: '2026-11-01',
      updated_at: '2026-11-01'
    }));
    insertRows(raw, 'email_logs', rows);

    const result: any = await getEmailLogsImpl(db, { email_logs: schema.email_logs, users: schema.users, bookings: schema.bookings }, { limit: 100000 });

    expect(result.data).toHaveLength(100);
    expect(result.pagination).toMatchObject({ limit: 100, total: 120, totalPages: 2 });
  });
});

describe('customer detail', () => {
  it('reads named columns and keeps the same answer', async () => {
    const { db, raw } = makeSqliteDb(['users', 'accounts', 'bookings', 'movies', 'ticket_packages', 'auditLogs']);
    insertRows(raw, 'users', [{ id: 3, fullname: 'An', phone: '0900', created_at: '2026-01-01', updated_at: '2026-01-02' }]);
    insertRows(raw, 'accounts', [{ id: 1, user_id: 3, email: 'an@example.com', password: 'secret-hash', login_type: 'email', is_active: 1, created_at: '2026-01-01' }]);
    insertRows(raw, 'movies', [{ id: 8, title: 'Phim A' }]);
    insertRows(raw, 'bookings', [
      { id: 50, user_id: 3, movie_id: 8, booking_code: 'ABCD2345', ticket_count: 2, total_price: 200000, payment_method: 'vietqr', payment_status: 'paid', created_at: '2026-02-01' }
    ]);
    insertRows(raw, 'auditLogs', [{ id: 1, staff_fullname: 'Staff A', action: 'update', entity_type: 'user', entity_id: 3, created_at: '2026-02-02' }]);

    const detail: any = await getUserByIdImpl(
      db,
      { users: schema.users, bookings: schema.bookings, movies: schema.movies, ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
      3
    );

    expect(detail).toMatchObject({
      id: 3,
      fullname: 'An',
      email: 'an@example.com',
      is_active: true,
      login_type: 'email',
      total_bookings: 1,
      paid_bookings: 1,
      total_spent: 200000,
      updated_by_staff_name: 'Staff A'
    });
    expect(detail.recent_bookings).toEqual([
      {
        id: 50,
        booking_code: 'ABCD2345',
        movie_title: 'Phim A',
        ticket_package_name: '',
        ticket_count: 2,
        total_price: 200000,
        payment_method: 'vietqr',
        payment_status: 'paid',
        created_at: '2026-02-01'
      }
    ]);
    expect(JSON.stringify(detail)).not.toContain('secret-hash');
  });
});
