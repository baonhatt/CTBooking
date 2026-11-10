// Address of the public website (the customer site), read from the build settings so that the admin screens never
// hard-code a domain. The same setting (VITE_CLIENT_BASE_URL) is used by the server for sitemap and e-mail links.

function readConfiguredBaseUrl(): string {
  const configured = String((import.meta as any).env?.VITE_CLIENT_BASE_URL || '').trim();
  return configured.replace(/\/+$/, '');
}

// Base address without a trailing slash; the address of this page's origin when nothing is configured
export function getPublicSiteBaseUrl(): string {
  const configured = readConfiguredBaseUrl();
  if (configured) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

// Full public address of a post, e.g. https://example.com/bai-viet/ten-bai-viet; empty when there is no slug yet
export function getPublicPostUrl(slug?: string | null): string {
  if (!slug) return '';
  return `${getPublicSiteBaseUrl()}/bai-viet/${slug}`;
}
