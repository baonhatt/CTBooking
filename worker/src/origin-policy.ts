/**
 * Which websites may call this API with the visitor's login cookie, and the CSRF check that goes with it.
 *
 * Logins live in HttpOnly cookies set by the API itself (session_token for customers, staff_session for staff), so the
 * browser sends them on every request to the API. Two rules keep that safe:
 * - CORS: only our own sites get an Access-Control-Allow-Origin header, and each API only trusts the sites of its own
 *   environment. The live API trusts the live sites; the preview API trusts the preview sites. A preview page running
 *   unfinished code can therefore never read live data with a staff member's live cookie.
 * - CSRF: a request that changes something (not GET/HEAD/OPTIONS) and carries a login cookie must come from one of those
 *   sites (Origin header). A form or script on any other page is refused before it reaches a route.
 * Requests without a login cookie (SePay webhook, server-side page rendering, scripts) are not affected by the CSRF check.
 */

/** Sites that may call the live API (api.cinesphere.com.vn, and cinesphere.com.vn/api/*) */
const LIVE_SITE_HOSTS = ['cinesphere.com.vn', 'www.cinesphere.com.vn', 'admin.cinesphere.com.vn'];

/** Sites that may call the preview API (api-preview.cinesphere.com.vn) */
const PREVIEW_SITE_HOSTS = ['preview.cinesphere.com.vn', 'admin-preview.cinesphere.com.vn'];

/** API host names that serve the preview environment */
const PREVIEW_API_HOSTS = ['api-preview.cinesphere.com.vn'];

/** The login cookies the API sets; a request carrying one of them is acting as a signed-in person */
const LOGIN_COOKIE_NAMES = ['session_token', 'staff_session'];

/** Methods that only read, so a forged request cannot change anything */
const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

function hostnameOf(url: string | undefined | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * The sites allowed to call the API that answers on `apiUrl`.
 * Local API (wrangler dev): any localhost site. Preview API: the preview sites. Anything else is the live API.
 */
export function allowedSiteHosts(apiUrl: string): { hosts: string[]; allowAnyLocalhost: boolean } {
  const apiHost = hostnameOf(apiUrl);
  if (isLocalHost(apiHost)) return { hosts: [], allowAnyLocalhost: true };
  if (PREVIEW_API_HOSTS.includes(apiHost)) return { hosts: PREVIEW_SITE_HOSTS, allowAnyLocalhost: false };
  return { hosts: LIVE_SITE_HOSTS, allowAnyLocalhost: false };
}

/** True when a page on `origin` may call the API at `apiUrl` with the visitor's cookie */
export function isAllowedOrigin(origin: string | undefined | null, apiUrl: string): boolean {
  const originHost = hostnameOf(origin);
  if (!originHost) return false;
  const policy = allowedSiteHosts(apiUrl);
  if (policy.allowAnyLocalhost) return isLocalHost(originHost);
  return policy.hosts.includes(originHost);
}

/** True when the Cookie header holds one of the login cookies */
export function hasLoginCookie(cookieHeader: string | undefined | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .some((cookieName) => LOGIN_COOKIE_NAMES.includes(cookieName));
}

/**
 * The CSRF decision for one request: undefined when it may go on, or the reason it is refused.
 * Read-only requests and requests without a login cookie always go on.
 */
export function csrfRefusal(request: {
  method: string;
  url: string;
  origin?: string | null;
  cookie?: string | null;
}): string | undefined {
  if (READ_ONLY_METHODS.includes(request.method.toUpperCase())) return undefined;
  if (!hasLoginCookie(request.cookie)) return undefined;
  if (!request.origin) return 'missing Origin on a signed-in request';
  if (!isAllowedOrigin(request.origin, request.url)) return `Origin not allowed: ${request.origin}`;
  return undefined;
}
