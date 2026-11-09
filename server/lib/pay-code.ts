/**
 * The payment reference a customer types into the bank transfer, for example CS482913057741.
 *
 * It is generated on the server, never taken from the browser, so two customers cannot collide on a guessable value
 * and a caller cannot choose someone else's reference. The shape (CS + exactly 12 digits) is what the SePay webhook
 * looks for in the transfer content (server/routes/webhook/sepay.ts), so it must not change.
 */
export const PAY_CODE_PATTERN = /^CS\d{12}$/;

const PAY_CODE_DIGITS = 12;

export function generatePayTxtCode(): string {
  // One byte gives 0-255; only 0-249 are used so every digit is equally likely
  const digits: string[] = [];
  const randomBytes = new Uint8Array(1);
  while (digits.length < PAY_CODE_DIGITS) {
    crypto.getRandomValues(randomBytes);
    if (randomBytes[0] < 250) digits.push(String(randomBytes[0] % 10));
  }
  return `CS${digits.join('')}`;
}

/** True when a database error says the pay_txt_code value is already taken (a random collision). */
export function isPayCodeCollision(error: unknown): boolean {
  const message = String((error as any)?.message || error || '');
  return /UNIQUE/i.test(message) && /pay_txt_code/i.test(message);
}
