import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSePayWebhookImpl } from './sepay';
import { updatePaymentImpl } from '../user/booking/update';

vi.mock('../user/booking/update', () => ({
  updatePaymentImpl: vi.fn()
}));

describe('SePay Webhook Logic (Auth removed to route)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('Should reject and not update payment when content is missing', async () => {
    const result = await handleSePayWebhookImpl(
      {}, // db
      {} as any, // tables
      {}, // empty body, no content
      undefined, 
      undefined, 
      undefined, 
      undefined, 
      undefined, 
      undefined
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('No content');
    expect(updatePaymentImpl).not.toHaveBeenCalled(); // Critical assertion retained
  });

  it('Should reject and not update payment when amount is insufficient', async () => {
    const mockDb = {
      query: {
        bookings: {
          findFirst: vi.fn().mockResolvedValue({ id: 1, pay_txt_code: 'CS123456789012', total_price: 100000, user_id: 1, payment_status: 'pending' })
        }
      }
    };
    const tables = { bookings: {} };
    const body = {
      content: 'Thanh toan CS123456789012',
      transferAmount: 50000 // Less than total_price (100000)
    };

    const result = await handleSePayWebhookImpl(
      mockDb,
      tables as any,
      body,
      undefined,
      undefined,
      undefined
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Insufficient amount');
    expect(updatePaymentImpl).not.toHaveBeenCalled(); // Critical assertion retained
  });
});
