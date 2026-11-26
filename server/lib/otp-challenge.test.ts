import { describe, it, expect } from 'vitest';
import { makeOtpChallenge, readOtpChallenge, OTP_CHALLENGE_LIFETIME_MS } from './otp-challenge';
import { generateOTP } from './otp-utils';

const secret = 'test-secret';

describe('OTP challenge', () => {
  it('gives back the account id it was made for', async () => {
    const challenge = await makeOtpChallenge(secret, 57, 1000);
    expect(await readOtpChallenge(secret, challenge, 2000)).toBe(57);
  });

  it('refuses a challenge whose account id was changed', async () => {
    const challenge = await makeOtpChallenge(secret, 57, 1000);
    const forged = challenge.replace(/^57\./, '58.');
    expect(await readOtpChallenge(secret, forged, 2000)).toBeNull();
  });

  it('refuses a challenge signed with another secret', async () => {
    const challenge = await makeOtpChallenge('other-secret', 57, 1000);
    expect(await readOtpChallenge(secret, challenge, 2000)).toBeNull();
  });

  it('refuses an expired challenge', async () => {
    const challenge = await makeOtpChallenge(secret, 57, 1000);
    expect(await readOtpChallenge(secret, challenge, 1000 + OTP_CHALLENGE_LIFETIME_MS + 1)).toBeNull();
  });

  it('refuses a missing or malformed challenge, including a bare account id', async () => {
    for (const value of [undefined, null, '', 57, '57', 'a.b.c', '57.999.']) {
      expect(await readOtpChallenge(secret, value, 2000)).toBeNull();
    }
  });
});

describe('generateOTP', () => {
  it('returns only digits, of the asked length', () => {
    for (const length of [4, 6, 8]) {
      expect(generateOTP(length)).toMatch(new RegExp(`^\\d{${length}}$`));
    }
  });
});
