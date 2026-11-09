import { describe, it, expect } from 'vitest';
import { makeOrderToken, resolveOrderTokenSecret, verifyOrderToken } from './order-token';

const SECRET = 'a-test-secret';

describe('order token', () => {
  it('is a 64 character hex string and is stable for the same order', async () => {
    const first = await makeOrderToken(SECRET, 55, 'CS482913057741');
    const second = await makeOrderToken(SECRET, 55, 'CS482913057741');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
  });

  it('verifies for the order it was made for', async () => {
    const token = await makeOrderToken(SECRET, 55, 'CS482913057741');
    expect(await verifyOrderToken(SECRET, 55, 'CS482913057741', token)).toBe(true);
  });

  it('does not verify for another booking id, another payment reference or another secret', async () => {
    const token = await makeOrderToken(SECRET, 55, 'CS482913057741');
    expect(await verifyOrderToken(SECRET, 56, 'CS482913057741', token)).toBe(false);
    expect(await verifyOrderToken(SECRET, 55, 'CS000000000000', token)).toBe(false);
    expect(await verifyOrderToken('another-secret', 55, 'CS482913057741', token)).toBe(false);
  });

  it('does not verify a booking id guessed from a neighbour, which is what an attacker has', async () => {
    const neighbourToken = await makeOrderToken(SECRET, 54, 'CS111111111111');
    expect(await verifyOrderToken(SECRET, 55, 'CS482913057741', neighbourToken)).toBe(false);
  });

  it('does not verify missing, empty, wrong-length or non-string tokens', async () => {
    const token = await makeOrderToken(SECRET, 55, 'CS482913057741');
    for (const bad of [undefined, null, '', 'abc', token.slice(1), `${token}0`, 12345, {}, ['x']]) {
      expect(await verifyOrderToken(SECRET, 55, 'CS482913057741', bad)).toBe(false);
    }
  });

  it('does not verify a booking that has no payment reference', async () => {
    const token = await makeOrderToken(SECRET, 55, '');
    expect(await verifyOrderToken(SECRET, 55, null, token)).toBe(false);
    expect(await verifyOrderToken(SECRET, 55, undefined, token)).toBe(false);
    expect(await verifyOrderToken(SECRET, 55, '', token)).toBe(false);
  });

  it('is sensitive to a single changed character', async () => {
    const token = await makeOrderToken(SECRET, 55, 'CS482913057741');
    const flipped = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
    expect(await verifyOrderToken(SECRET, 55, 'CS482913057741', flipped)).toBe(false);
  });
});

describe('resolveOrderTokenSecret', () => {
  it('uses the configured secret', () => {
    expect(resolveOrderTokenSecret({ ORDER_TOKEN_SECRET: 'configured' }, 'https://api.example.com/x')).toBe('configured');
  });

  it('fails on a real host when the secret is missing, instead of using an empty key', () => {
    expect(() => resolveOrderTokenSecret({}, 'https://api.example.com/x')).toThrow(/ORDER_TOKEN_SECRET/);
    expect(() => resolveOrderTokenSecret({ ORDER_TOKEN_SECRET: '' }, 'https://api.cinesphere.com.vn/x')).toThrow();
    expect(() => resolveOrderTokenSecret(undefined, 'https://api.example.com/x')).toThrow();
  });

  it('uses a development secret on localhost so local work needs no extra setup', () => {
    const secret = resolveOrderTokenSecret({}, 'http://localhost:8787/api/create-booking');
    expect(secret.length).toBeGreaterThan(10);
  });

  it('prefers the configured secret even on localhost', () => {
    expect(resolveOrderTokenSecret({ ORDER_TOKEN_SECRET: 'configured' }, 'http://localhost:8787/x')).toBe('configured');
  });
});
