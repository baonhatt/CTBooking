import { describe, it, expect } from 'vitest';
import { csrfRefusal, hasLoginCookie, isAllowedOrigin } from './origin-policy';

const LIVE_API = 'https://api.cinesphere.com.vn/api/user/profile';
const LIVE_ROUTE_API = 'https://cinesphere.com.vn/api/user/profile';
const PREVIEW_API = 'https://api-preview.cinesphere.com.vn/api/user/profile';
const LOCAL_API = 'http://localhost:8787/api/user/profile';

describe('isAllowedOrigin: each API trusts only its own sites', () => {
  it('live API: live sites only', () => {
    expect(isAllowedOrigin('https://cinesphere.com.vn', LIVE_API)).toBe(true);
    expect(isAllowedOrigin('https://www.cinesphere.com.vn', LIVE_API)).toBe(true);
    expect(isAllowedOrigin('https://admin.cinesphere.com.vn', LIVE_API)).toBe(true);
    expect(isAllowedOrigin('https://cinesphere.com.vn', LIVE_ROUTE_API)).toBe(true);
  });

  it('live API refuses preview sites, pages.dev, localhost and look-alike domains', () => {
    expect(isAllowedOrigin('https://preview.cinesphere.com.vn', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('https://admin-preview.cinesphere.com.vn', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('https://cinema-next.pages.dev', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('http://localhost:3000', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('https://evil.example.com', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('https://cinesphere.com.vn.evil.com', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('https://evilcinesphere.com.vn', LIVE_API)).toBe(false);
  });

  it('preview API: preview sites only', () => {
    expect(isAllowedOrigin('https://preview.cinesphere.com.vn', PREVIEW_API)).toBe(true);
    expect(isAllowedOrigin('https://admin-preview.cinesphere.com.vn', PREVIEW_API)).toBe(true);
    expect(isAllowedOrigin('https://cinesphere.com.vn', PREVIEW_API)).toBe(false);
    expect(isAllowedOrigin('https://admin.cinesphere.com.vn', PREVIEW_API)).toBe(false);
  });

  it('local API: any localhost site, nothing else', () => {
    expect(isAllowedOrigin('http://localhost:3000', LOCAL_API)).toBe(true);
    expect(isAllowedOrigin('http://localhost:8080', LOCAL_API)).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000', LOCAL_API)).toBe(true);
    expect(isAllowedOrigin('https://cinesphere.com.vn', LOCAL_API)).toBe(false);
  });

  it('no or malformed Origin is never allowed', () => {
    expect(isAllowedOrigin(undefined, LIVE_API)).toBe(false);
    expect(isAllowedOrigin('', LIVE_API)).toBe(false);
    expect(isAllowedOrigin('null', LIVE_API)).toBe(false);
  });
});

describe('hasLoginCookie', () => {
  it('finds either login cookie among others', () => {
    expect(hasLoginCookie('selected_branch_id=3; session_token=abc')).toBe(true);
    expect(hasLoginCookie('staff_session=xyz')).toBe(true);
  });

  it('ignores other cookies and look-alike names', () => {
    expect(hasLoginCookie('selected_branch_id=3')).toBe(false);
    expect(hasLoginCookie('my_session_token=abc; staff_session_old=1')).toBe(false);
    expect(hasLoginCookie(undefined)).toBe(false);
  });
});

describe('csrfRefusal', () => {
  const signedIn = 'session_token=abc';

  it('read-only requests always pass, even from another site', () => {
    expect(csrfRefusal({ method: 'GET', url: LIVE_API, origin: 'https://evil.example.com', cookie: signedIn })).toBeUndefined();
    expect(csrfRefusal({ method: 'HEAD', url: LIVE_API, cookie: signedIn })).toBeUndefined();
  });

  it('a signed-in change from our own site passes', () => {
    expect(csrfRefusal({ method: 'POST', url: LIVE_API, origin: 'https://cinesphere.com.vn', cookie: signedIn })).toBeUndefined();
    expect(
      csrfRefusal({ method: 'DELETE', url: LIVE_API, origin: 'https://admin.cinesphere.com.vn', cookie: 'staff_session=1' })
    ).toBeUndefined();
  });

  it('a signed-in change from another site, or without Origin, is refused', () => {
    expect(csrfRefusal({ method: 'POST', url: LIVE_API, origin: 'https://evil.example.com', cookie: signedIn })).toBeTruthy();
    expect(csrfRefusal({ method: 'POST', url: LIVE_API, origin: 'https://preview.cinesphere.com.vn', cookie: signedIn })).toBeTruthy();
    expect(csrfRefusal({ method: 'PUT', url: LIVE_API, cookie: signedIn })).toBeTruthy();
  });

  it('requests without a login cookie are not CSRF-checked (webhook, server-side rendering)', () => {
    expect(csrfRefusal({ method: 'POST', url: 'https://api.cinesphere.com.vn/api/webhooks/sepay' })).toBeUndefined();
    expect(csrfRefusal({ method: 'POST', url: LIVE_API, origin: 'https://evil.example.com', cookie: 'other=1' })).toBeUndefined();
  });
});
