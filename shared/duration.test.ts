import { describe, it, expect } from 'vitest';
import { formatDurationMinutes } from './duration';

describe('formatDurationMinutes', () => {
  it('writes whole minutes as minutes', () => {
    expect(formatDurationMinutes(120)).toBe('120 phút');
    expect(formatDurationMinutes('95')).toBe('95 phút');
  });

  it('turns a fraction of a minute into seconds', () => {
    expect(formatDurationMinutes(5.34)).toBe('5 phút 20 giây');
    expect(formatDurationMinutes(5.41)).toBe('5 phút 25 giây');
    expect(formatDurationMinutes(0.5)).toBe('30 giây');
  });

  it('gives nothing when there is no usable length', () => {
    expect(formatDurationMinutes(null)).toBe('');
    expect(formatDurationMinutes(undefined)).toBe('');
    expect(formatDurationMinutes(0)).toBe('');
    expect(formatDurationMinutes('abc')).toBe('');
  });
});
