import { describe, it, expect } from 'vitest';
import { isPaymentReceivedLate, bookingStatusPayload } from './access';

describe('money received after the order closed', () => {
  it('is true only for a closed order that has a bank reference', () => {
    expect(isPaymentReceivedLate({ payment_status: 'failed', transaction_id: 'FT123' })).toBe(true);
    expect(isPaymentReceivedLate({ payment_status: 'EXPIRED', transaction_id: 'FT123' })).toBe(true);
    expect(isPaymentReceivedLate({ payment_status: 'cancelled', transaction_id: 'FT123' })).toBe(true);
    expect(isPaymentReceivedLate({ payment_status: 'failed', transaction_id: '' })).toBe(false);
    expect(isPaymentReceivedLate({ payment_status: 'failed', transaction_id: null })).toBe(false);
    expect(isPaymentReceivedLate({ payment_status: 'paid', transaction_id: 'FT123' })).toBe(false);
    expect(isPaymentReceivedLate({ payment_status: 'pending', transaction_id: 'FT123' })).toBe(false);
  });

  it('the status reply carries the flag but never the bank reference', () => {
    const payload = bookingStatusPayload({ id: 1, payment_status: 'failed', transaction_id: 'FT123' });
    expect(payload.payment_received_late).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('FT123');
  });
});
