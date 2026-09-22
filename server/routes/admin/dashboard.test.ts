import { describe, it, expect } from 'vitest';
import { getRevenue7DaysImpl } from './dashboard';
import { getVnParts } from '../../lib/date-utils';

// A strict mock for anyDb and tables to test the JS-side execution logic in getRevenue7DaysImpl
describe('getRevenue7DaysImpl', () => {
  it('groups revenue by VN time correctly preventing UTC day drift', async () => {
    // Generate an exact date from today's perspective to mock boundaries so the test is deterministic
    const now = new Date();
    now.setUTCHours(18, 0, 0, 0); 
    // 18:00 UTC = 01:00 VN Time the NEXT day

    // Let's create a fake created_at that represents 01:00 AM VN time (18:00 UTC previous day)
    const fixedDate = new Date('2024-05-15T18:00:00Z'); 
    // In VN this is '2024-05-16' (01:00 AM)

    // And another date at 12:00 AM UTC (07:00 AM VN time the same day)
    const fixedDate2 = new Date('2024-05-16T00:00:00Z'); 
    // In VN this is '2024-05-16' (07:00 AM)

    // They should BOTH group into '05-16'. With pure UTC grouping, the first one used to fall into '05-15' and the second '05-16'.

    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => {
        // Return fake query results
        return [
          { total_price: 150000, created_at: fixedDate.toISOString() }, // 18:00 UTC on May 15
          { total_price: 50000, created_at: fixedDate2.toISOString() }  // 00:00 UTC on May 16
        ];
      }
    };

    const mockTables = {
      bookings: {
        total_price: 'total_price',
        created_at: 'created_at',
        payment_status: 'payment_status'
      }
    };

    // Replace Date.now() or new Date() locally during the test so it doesn't fail based on current day
    const originalDate = global.Date;
    class MockDate extends originalDate {
      constructor(dateStr?: string | number | Date) {
        super(dateStr || '2024-05-16T12:00:00Z'); 
      }
    }
    (global as any).Date = MockDate;
    global.Date.now = () => new Date('2024-05-16T12:00:00Z').getTime();
    global.Date.UTC = originalDate.UTC;

    try {
      const result = await getRevenue7DaysImpl(mockDb, mockTables);
      
      const day16 = result.data.find(d => d.day === '05-16');
      const day15 = result.data.find(d => d.day === '05-15');

      expect(day16).toBeDefined();
      expect(day16?.revenue).toBe(200000); // 150000 + 50000, correctly summed into the SAME VN day

      expect(day15).toBeDefined();
      expect(day15?.revenue).toBe(0); // UTC 18:00 May 15 should NOT fall into VN May 15
    } finally {
      global.Date = originalDate;
    }
  });
});

describe('getVnParts', () => {
  it('correctly maps 01:00 VN time (18:00 UTC previous day) to the correct VN day without drifting backwards', () => {
    // 2026-09-21 18:00:00 UTC -> 2026-09-22 01:00:00 VN Time
    const parts = getVnParts(new Date('2026-09-21T18:00:00.000Z'));
    expect(parts?.year).toBe(2026);
    expect(parts?.month).toBe(9);
    expect(parts?.day).toBe(22);
    expect(parts?.hour).toBe(1);
    expect(parts?.dateString).toBe('2026-09-22');
  });

  it('correctly shifts to next day string when given the exact 00:00:00 VN time crossing (17:00:00 UTC)', () => {
    // 2026-09-21 17:00:00 UTC -> 2026-09-22 00:00:00 VN Time
    const partsPreviousMinute = getVnParts(new Date('2026-09-21T16:59:59.999Z'));
    expect(partsPreviousMinute?.dateString).toBe('2026-09-21');
    expect(partsPreviousMinute?.hour).toBe(23);

    const partsCrossing = getVnParts(new Date('2026-09-21T17:00:00.000Z'));
    expect(partsCrossing?.dateString).toBe('2026-09-22');
    expect(partsCrossing?.hour).toBe(0);
  });

  it('correctly maps weekday to Sunday (0) when VN time is Sunday early morning, even though UTC date is still Saturday', () => {
    // 2026-09-20 is Sunday VN Time (and UTC). Let's pick 01:00 VN Time on Sunday 2026-09-20
    // UTC time will be 2026-09-19T18:00:00.000Z (Saturday)
    const dateSaturdayUTC = new Date('2026-09-19T18:00:00.000Z');
    
    // Default UTC behavior returns 6 for Saturday (Saturday 18:00 UTC is still Saturday)
    expect(dateSaturdayUTC.getUTCDay()).toBe(6);

    const parts = getVnParts(dateSaturdayUTC);
    
    // In VN Time, it has passed midnight onto Sunday (dayOfWeek 0)
    expect(parts?.dayOfWeek).toBe(0);
    expect(parts?.hour).toBe(1);
    // Explicitly confirm it is Sun from the weekday name map logic internally
    expect(parts?.dateString).toBe('2026-09-20');
  });
});

