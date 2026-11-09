import { isLocal } from './media-utils';

/**
 * A per-order secret that lets the person who placed an order (guest or not) see its payment status and cancel it,
 * without a login and without exposing the booking id as the only key.
 *
 * token = HMAC-SHA256(ORDER_TOKEN_SECRET, "<booking id>:<pay_txt_code>"), as hex.
 * Nothing is stored: the server recomputes it from the booking row. The pay_txt_code is random (see pay-code.ts),
 * so the token cannot be guessed from the booking id.
 */

/** Name of the request header that carries the token. Also listed in the CORS allow-list in worker/src/index.ts. */
export const ORDER_TOKEN_HEADER = 'X-Order-Token';

/** Used only on localhost when ORDER_TOKEN_SECRET is not set, so local development works without extra setup. */
const LOCAL_DEV_SECRET = 'local-development-order-token-secret';

const textEncoder = new TextEncoder();

/**
 * Returns the signing secret. Outside localhost a missing secret is an error, never a silent empty key.
 * Call this BEFORE creating an order, so a configuration mistake cannot leave a half-created order behind.
 */
export function resolveOrderTokenSecret(env: any, requestUrl: string): string {
  const configured = String(env?.ORDER_TOKEN_SECRET || '');
  if (configured) return configured;
  if (isLocal(requestUrl)) return LOCAL_DEV_SECRET;
  throw new Error('ORDER_TOKEN_SECRET chưa được cấu hình trên máy chủ');
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeOrderToken(secret: string, bookingId: number, payTxtCode: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${bookingId}:${payTxtCode}`));
  return toHex(signature);
}

/** Compares two strings without stopping at the first difference. */
function constantTimeEqual(first: string, second: string): boolean {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index++) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyOrderToken(
  secret: string,
  bookingId: number,
  payTxtCode: string | null | undefined,
  token: unknown
): Promise<boolean> {
  if (!payTxtCode || typeof token !== 'string' || token.length === 0) return false;
  const expected = await makeOrderToken(secret, bookingId, payTxtCode);
  return constantTimeEqual(expected, token);
}
