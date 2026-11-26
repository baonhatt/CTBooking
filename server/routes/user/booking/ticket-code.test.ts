import { describe, it, expect } from 'vitest';
import { ticketCodeCandidates } from './query';
import { findPayCodes } from '../../webhook/sepay';

describe('ticket check: exact codes only', () => {
  it('a full ticket code or payment code is looked up as typed (upper-cased, spaces removed)', () => {
    expect(ticketCodeCandidates(' a7k9 m2b5 ').codes).toEqual(['A7K9M2B5']);
    expect(ticketCodeCandidates('cs482913057741').codes).toEqual(['CS482913057741']);
  });

  it('the 12 digits alone mean the payment code', () => {
    expect(ticketCodeCandidates('482913057741').codes).toContain('CS482913057741');
  });

  it('a payment code inside longer scanned text is found', () => {
    expect(ticketCodeCandidates('MBVCB.123.CS482913057741.CT').codes).toContain('CS482913057741');
  });

  it('a partial code is never widened into a "contains" search', () => {
    const { codes, bookingId } = ticketCodeCandidates('057741');
    expect(codes).toEqual(['057741']);
    expect(bookingId).toBeNull();
    expect(ticketCodeCandidates('CS4829130577').codes).toEqual(['CS4829130577']);
  });

  it('BK<id> from older printed tickets', () => {
    expect(ticketCodeCandidates('bk123').bookingId).toBe(123);
  });
});

describe('SePay: payment code inside the bank text', () => {
  it('finds one complete code wherever the bank puts it', () => {
    expect(findPayCodes('MBVCB.9876.CS482913057741.CT tu 0123 NGUYEN VAN A')).toEqual(['CS482913057741']);
    expect(findPayCodes('thanh toan cs482913057741')).toEqual(['CS482913057741']);
    expect(findPayCodes('CS482913057741999 glued digits')).toEqual(['CS482913057741']);
  });

  it('a shorter code or none at all matches nothing', () => {
    expect(findPayCodes('CS48291305 thieu so')).toEqual([]);
    expect(findPayCodes('chuyen tien ve')).toEqual([]);
  });

  it('two different complete codes are both tried', () => {
    expect(findPayCodes('CS111111111111 CS222222222222')).toEqual(['CS111111111111', 'CS222222222222']);
  });
});
