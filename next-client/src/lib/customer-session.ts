// Plain helpers (no 'use client'): every function checks for the browser itself, so server code may import this file
import { buildUrl } from '@/lib/api/http';
import { deleteCookie, getCookie, setCookie } from '@/lib/cookies';

/**
 * The signed-in customer, as this site sees it.
 *
 * The session itself is the HttpOnly `session_token` cookie that the API sets at login (on the API's own host). Page
 * scripts cannot read it and never send it by hand: the browser adds it to API requests made with
 * credentials: 'include'. What the site keeps is only `userProfile` (email, name, phone) to draw the header without a
 * request; it is not a secret and grants nothing. Whether the session is still valid is asked from the API.
 */

/** Token copies the old login kept where page scripts could read them; removed wherever they are still found */
const LEGACY_TOKEN_KEYS = ['userToken', 'token', 'staffToken', 'authToken'];

const PROFILE_KEY = 'userProfile';

/** The profile saved at login, or null when nobody is signed in on this browser */
export function readStoredProfile(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return getCookie(PROFILE_KEY) || localStorage.getItem(PROFILE_KEY);
  } catch {
    return getCookie(PROFILE_KEY);
  }
}

export function hasStoredProfile(): boolean {
  return !!readStoredProfile();
}

/** Saves the profile shown in the header after login or registration (the session cookie is set by the API) */
export function saveCustomerProfile(user: any) {
  const profile = {
    email: user?.email,
    name: user?.username || user?.name || String(user?.email || '').split('@')[0],
    phone: user?.phone || ''
  };
  const profileJson = JSON.stringify(profile);
  try {
    localStorage.setItem(PROFILE_KEY, profileJson);
  } catch {
    // Storage blocked (private window): the cookie below still carries it
  }
  // Kept as long as the session cookie (30 days), so the header does not look signed out while the session is valid
  setCookie(PROFILE_KEY, profileJson, 30 * 24 * 60 * 60);
}

/** Removes token copies left by the old login (localStorage and the script-readable cookie) */
export function removeLegacyTokens() {
  if (typeof window === 'undefined') return;
  for (const storageKey of LEGACY_TOKEN_KEYS) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage blocked; nothing more to do
    }
    deleteCookie(storageKey);
  }
}

/** Forgets the signed-in customer on this browser (the API clears the session cookie itself on /api/logout) */
export function clearCustomerProfile() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Storage blocked; nothing more to do
  }
  deleteCookie(PROFILE_KEY);
  removeLegacyTokens();
}

/**
 * Asks the API whether the session cookie is still valid.
 * 'invalid': refused (401/403), the customer must sign in again. 'unknown': no answer (offline, server error).
 * Uses fetch directly, so an expired session found here does not pop up the login dialog by itself.
 */
export async function checkCustomerSession(): Promise<'valid' | 'invalid' | 'unknown'> {
  try {
    const res = await fetch(buildUrl('/api/user/profile'), { credentials: 'include', cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return 'invalid';
    return res.ok ? 'valid' : 'unknown';
  } catch {
    return 'unknown';
  }
}
