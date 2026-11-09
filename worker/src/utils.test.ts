import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logSystemError, verifyTurnstile } from './utils';

const PRODUCTION_URL = 'https://api.example.com/api/login';
const env = { TURNSTILE_SECRET: 'real-secret' };

function stubFetch(response: { success?: boolean } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: true, json: async () => response } as any;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('verifyTurnstile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips the check on localhost without calling Cloudflare', async () => {
    const fetchMock = stubFetch({ success: true });
    const result = await verifyTurnstile({}, undefined, 'http://localhost:8787/api/login');
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the secret is not configured', async () => {
    const fetchMock = stubFetch({ success: true });
    const result = await verifyTurnstile({}, 'token', PRODUCTION_URL);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing, empty, non-string or oversized token', async () => {
    const fetchMock = stubFetch({ success: true });
    for (const badToken of [undefined, '', 12345, { a: 1 }, 'x'.repeat(2049)]) {
      const result = await verifyTurnstile(env, badToken, PRODUCTION_URL);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cannot be fooled by a token that tries to add a secret field', async () => {
    const fetchMock = stubFetch({ success: false });
    const maliciousToken = 'x&secret=attacker-controlled';

    await verifyTurnstile(env, maliciousToken, PRODUCTION_URL, '203.0.113.5');

    const sentBody = (fetchMock.mock.calls[0] as any)[1].body as URLSearchParams;
    expect(sentBody.getAll('secret')).toEqual(['real-secret']);
    expect(sentBody.get('response')).toBe(maliciousToken);
    expect(sentBody.get('remoteip')).toBe('203.0.113.5');
  });

  it('rejects when Cloudflare says the token is invalid', async () => {
    stubFetch({ success: false });
    const result = await verifyTurnstile(env, 'token', PRODUCTION_URL);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('returns a server error when the verification request fails', async () => {
    stubFetch(new Error('network down'));
    const result = await verifyTurnstile(env, 'token', PRODUCTION_URL);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('accepts a valid token', async () => {
    stubFetch({ success: true });
    const result = await verifyTurnstile(env, 'token', PRODUCTION_URL);
    expect(result.ok).toBe(true);
  });
});

describe('logSystemError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('masks credentials and personal data in the logged payload', () => {
    logSystemError('create-booking', new Error('boom'), {
      name: 'Nguyen Van A',
      phone: '0900000000',
      email: 'a@example.com',
      emailBook: 'b@example.com',
      password: 'secret',
      otp: '123456',
      ticketCount: 2
    });

    const logged = (console.error as any).mock.calls.map((call: any[]) => call.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('Nguyen Van A');
    expect(logged).not.toContain('0900000000');
    expect(logged).not.toContain('a@example.com');
    expect(logged).not.toContain('b@example.com');
    expect(logged).not.toContain('secret');
    expect(logged).toContain('"ticketCount": 2');
  });
});
