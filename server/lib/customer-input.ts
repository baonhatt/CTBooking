// Checks for the customer's name and email, shared by booking and registration.

/** Longest name accepted. */
export const NAME_MAX_LENGTH = 100;

/** Longest email address accepted (the limit of the email standard). */
export const EMAIL_MAX_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** A name is fine when it has text, is not too long and holds no angle brackets. */
export function isValidCustomerName(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const name = value.trim();
  return name.length > 0 && name.length <= NAME_MAX_LENGTH && !/[<>]/.test(name);
}

/** An email is fine when it looks like name@domain.tld, has no spaces or quote characters and is not too long. */
export function isValidCustomerEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}
