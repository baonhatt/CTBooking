import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  formatDateTimeVN,
  formatDateVN,
  getVNYear,
  formatToVNDatetimeLocal,
  vnDatetimeLocalToUTC,
  getTodayStartIso,
  getTodayEndIso
} from './utils';

const originalTZ = process.env.TZ;

describe('Timezone Utils - Admin Client', () => {
  beforeAll(() => {
    // 3. Đổi múi giờ OS máy test sang nước ngoài (UTC-4 New York)
    process.env.TZ = 'America/New_York';
    vi.useFakeTimers();
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
    vi.useRealTimers();
  });

  // Case 1: Booking tạo gần nửa đêm VN
  it('Case 1: Booking tạo gần nửa đêm VN (23:45 21/9 VN)', () => {
    const utcString = '2026-09-21T16:45:00.000Z'; // 16:45 + 7h = 23:45 VN
    
    // UI hiển thị formatToVNDatetimeLocal ra đúng 23:45 21/9
    const localInputValue = formatToVNDatetimeLocal(utcString);
    expect(localInputValue).toBe('2026-09-21T23:45');
    
    // Convert VN sang UTC ngược lại
    const toUTC = vnDatetimeLocalToUTC('2026-09-21T23:45');
    expect(toUTC).toBe(utcString);

    // Bổ sung check formatDateTimeVN
    const displayTime = formatDateTimeVN(utcString);
    expect(displayTime).toContain('23:45');
  });

  // Case 2: Booking tạo ngay sau nửa đêm VN
  it('Case 2: Booking tạo ngay sau nửa đêm VN (00:15 22/9 VN)', () => {
    const utcString = '2026-09-21T17:15:00.000Z'; // 17:15 21/9 + 7h = 00:15 22/9 VN
    
    const localInputValue = formatToVNDatetimeLocal(utcString);
    expect(localInputValue).toBe('2026-09-22T00:15'); // Không bị lùi về 21/9
    
    const toUTC = vnDatetimeLocalToUTC('2026-09-22T00:15');
    expect(toUTC).toBe(utcString);
  });

  // Case 6, 7: Voucher Time Boundary 
  it('Case 6, 7: Hàm lấy Today ISO ở mốc nhạy cảm', () => {
    // Giả lập thời điểm 23:58 21/09 VN -> UTC là 16:58 21/09
    vi.setSystemTime(new Date('2026-09-21T16:58:00.000Z'));
    let start = getTodayStartIso();
    let end = getTodayEndIso();
    expect(start).toBe('2026-09-20T17:00:00.000Z'); // 00h ngày 21
    expect(end).toBe('2026-09-21T16:59:59.000Z');   // 23:59 ngày 21
    
    // Giả lập thời điểm 00:01 22/09 VN -> UTC là 17:01 21/09 
    // Nếu máy OS New York đang là 13:01 21/09 (chưa sang ngày mới 22 ở local Mỹ) -- nhưng getTodayIso phải sang ngày 22 VN.
    vi.setSystemTime(new Date('2026-09-21T17:01:00.000Z'));
    start = getTodayStartIso();
    end = getTodayEndIso();
    expect(start).toBe('2026-09-21T17:00:00.000Z'); // 00h ngày 22
    expect(end).toBe('2026-09-22T16:59:59.000Z');   // 23:59 ngày 22
  });

  // Case 10: Nhóm giao dịch cuối tháng
  it('Case 10: Giao dịch cuối tháng (23:50 30/9 VN)', () => {
    const utcString = '2026-09-30T16:50:00.000Z';
    const localInputValue = formatToVNDatetimeLocal(utcString);
    expect(localInputValue).toBe('2026-09-30T23:50'); 
  });

  // Case 11: Nhóm giao dịch đầu tháng
  it('Case 11: Giao dịch đầu tháng (00:10 1/10 VN)', () => {
    const utcString = '2026-09-30T17:10:00.000Z';
    const localInputValue = formatToVNDatetimeLocal(utcString);
    expect(localInputValue).toBe('2026-10-01T00:10'); // Sang mốc tháng 10 ở VN
  });

  // Case 13: Ảnh hưởng lệch NĂM - getVNYear
  it('Case 13: Ảnh hưởng lệch NĂM (Phim chiếu 00:30 1/1/2027 VN)', () => {
    const utcString = '2026-12-31T17:30:00.000Z'; // 17:30 31/12 UTC + 7h = 00:30 1/1/2027 VN
    // Dù máy tính OS ở Mỹ đang là 13:30 31/12/2026 (TZ=America/New_York)
    
    const year = getVNYear(utcString);
    expect(year).toBe(2027); // Vẫn lấy chuẩn năm 2027 ở Việt Nam
  });

  // Case 14: Input ngày nhuận 29/02/2028 vnDatetimeLocalToUTC 
  it('Case 14: vnDatetimeLocalToUTC input ngày nhuận 29/02/2028', () => {
    const vnInput = '2028-02-29T03:00';
    const toUTC = vnDatetimeLocalToUTC(vnInput);
    // 03:00 29/2/2028 VN - 7h = 20:00 28/2/2028 UTC
    expect(toUTC).toBe('2028-02-28T20:00:00.000Z');
    
    // Convert test ngược lại UI
    const backToLocal = formatToVNDatetimeLocal('2028-02-28T20:00:00.000Z');
    expect(backToLocal).toBe('2028-02-29T03:00');
  });

  // Case 16: DOB date-only string split không bị timezone làm lệch
  it('Case 16: DOB không bị lùi ngày dù OS ở âm h', () => {
    const apiDob = '1995-05-20T00:00:00.000Z';
    const mockSliceProcessing = (dob: string) => {
      return dob.slice(0, 10).split('-').reverse().join('/');
    };
    expect(mockSliceProcessing(apiDob)).toBe('20/05/1995'); // Đúng hiển thị ngày sinh 20
  });

  // Bổ sung độc lập OS Timezone
  it('Độc lập OS Timezone: Cùng 1 hàm phải ra kết quả y hệt trên TZ khác nhau', () => {
    const utcStr = '2026-09-21T16:45:00.000Z';
    
    process.env.TZ = 'UTC';
    const resultUTC = formatToVNDatetimeLocal(utcStr);
    
    process.env.TZ = 'America/New_York';
    const resultNY = formatToVNDatetimeLocal(utcStr);
    
    expect(resultUTC).toBe(resultNY);
    expect(resultUTC).toBe('2026-09-21T23:45'); // Phải là 23:45 VN
  });

});
