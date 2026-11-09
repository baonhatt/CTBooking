import { describe, it, expect } from 'vitest';
import { clampPage, chunk, MAX_PAGE_SIZE } from './paging';

describe('clampPage', () => {
  it('passes good values through', () => {
    expect(clampPage('3', '25')).toEqual({ page: 3, pageSize: 25 });
    expect(clampPage(2, 100)).toEqual({ page: 2, pageSize: 100 });
  });

  it('caps the page size at 100', () => {
    expect(clampPage(1, 100000).pageSize).toBe(MAX_PAGE_SIZE);
    expect(clampPage(1, 101).pageSize).toBe(100);
  });

  it('uses the defaults for missing, negative, zero, fractional and text values', () => {
    for (const bad of [undefined, null, '', 'abc', NaN, -5, 0, 1.5, Infinity]) {
      expect(clampPage(bad, bad)).toEqual({ page: 1, pageSize: 20 });
    }
  });

  it('can use another default page size, but never above the cap', () => {
    expect(clampPage(1, undefined, { defaultPageSize: 10 }).pageSize).toBe(10);
    expect(clampPage(1, undefined, { defaultPageSize: 500 }).pageSize).toBe(100);
    expect(clampPage(1, 50, { maxPageSize: 30 }).pageSize).toBe(30);
  });
});

describe('chunk', () => {
  it('cuts a list into pieces of at most the size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });

  it('keeps the order and loses nothing for 250 ids in chunks of 100', () => {
    const ids = Array.from({ length: 250 }, (_, i) => i);
    const pieces = chunk(ids);
    expect(pieces.map((piece) => piece.length)).toEqual([100, 100, 50]);
    expect(pieces.flat()).toEqual(ids);
  });

  it('falls back to 100 for a bad size', () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });
});
