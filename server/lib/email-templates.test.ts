import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeAttr,
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  getWelcomeEmailTemplate,
  getOTPEmailTemplate,
  getStaffAccountCreatedTemplate,
  getStaffPasswordResetTemplate,
  getStaffPasswordChangeOTPTemplate,
  getStaffLoginOTPTemplate,
  EMAIL_SUBJECTS
} from './email-templates';
import { configureEmailBrand } from './email-layout';
import { htmlToPlainText } from '../routes/mail-service';

// A name that would add a link and a script if it reached an email unescaped
const EVIL = '<a href="http://evil.test">click</a><script>alert(1)</script>';

/** The text must show up as plain characters, never as a tag. */
function expectEscaped(html: string) {
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).not.toContain('<a href="http://evil.test">');
  expect(html).toContain('&lt;a href=&quot;http://evil.test&quot;&gt;click&lt;/a&gt;');
}

describe('escapeHtml', () => {
  it('turns the five special characters into entities', () => {
    expect(escapeHtml('<a href="x" title=\'y\'>&</a>')).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  it('does not escape twice in one pass and keeps ordinary text, Vietnamese included', () => {
    expect(escapeHtml('Nguyễn Văn A - Chi nhánh 1')).toBe('Nguyễn Văn A - Chi nhánh 1');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('turns missing values into an empty string and numbers into text', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(12)).toBe('12');
  });
});

describe('escapeAttr', () => {
  it('keeps an https link, escaped', () => {
    expect(escapeAttr('https://cinesphere.com.vn/login?a=1&b=2')).toBe('https://cinesphere.com.vn/login?a=1&amp;b=2');
  });

  it('allows http only on localhost, for development', () => {
    expect(escapeAttr('http://localhost:3000/login')).toBe('http://localhost:3000/login');
    expect(escapeAttr('http://127.0.0.1/login')).toBe('http://127.0.0.1/login');
    expect(escapeAttr('http://evil.test/login')).toBe('#');
    expect(escapeAttr('http://localhost.evil.test/login')).toBe('#');
  });

  it('turns other schemes and junk into "#"', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', '//evil.test', 'ftp://x', '', undefined, null]) {
      expect(escapeAttr(bad)).toBe('#');
    }
  });

  it('cannot be used to leave the attribute', () => {
    const out = escapeAttr('https://ok.test/" onmouseover="alert(1)');
    expect(out).not.toContain('"');
  });
});

describe('booking confirmation email', () => {
  const data = {
    bookingCode: 'ABCD2345',
    customerName: EVIL,
    movieTitle: JSON.stringify([EVIL]),
    durationMin: JSON.stringify([EVIL]),
    ticketCount: 2,
    totalPrice: '100.000',
    branchName: EVIL,
    branchAddress: EVIL,
    branchPhone: EVIL,
    voucherCode: EVIL,
    discountAmt: 10000,
    originalTotal: 110000,
    expiryDate: '2026-12-01T00:00:00Z',
    bookingType: 'movie'
  };

  it('shows a malicious customer name, movie, branch and voucher as plain text', () => {
    const html = getBookingEmailTemplate('https://cinesphere.com.vn', data);
    expectEscaped(html);
    // The name appears in the greeting, the movie list, the branch rows, the voucher line and the footer
    expect(html.split('&lt;a href=&quot;http://evil.test&quot;').length - 1).toBeGreaterThanOrEqual(5);
  });

  it('still shows an ordinary order correctly', () => {
    const html = getBookingEmailTemplate('https://cinesphere.com.vn', {
      ...data,
      customerName: 'Nguyễn Văn A',
      movieTitle: '["Phim A"]',
      durationMin: '[120]',
      branchName: 'CineSphere Q1',
      branchAddress: '1 Đường A',
      branchPhone: '0900000000',
      voucherCode: 'SALE10'
    });
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('CineSphere Q1');
    expect(html).toContain('SALE10');
    expect(html).toContain('ABCD2345');
  });
});

describe('other emails', () => {
  it('reset password: a link that is not https is not put in the button', () => {
    expect(getResetPasswordEmailTemplate('javascript:alert(1)')).not.toContain('javascript:');
    expect(getResetPasswordEmailTemplate('https://cinesphere.com.vn/reset?token=abc&x=1')).toContain('token=abc&amp;x=1');
  });

  it('welcome: name and email are escaped', () => {
    expectEscaped(getWelcomeEmailTemplate('https://cinesphere.com.vn', { customerName: EVIL, email: EVIL }));
  });

  it('customer OTP: name and email are escaped', () => {
    expectEscaped(getOTPEmailTemplate({ customerName: EVIL, email: EVIL, otp: '123456', expiryMinutes: 5 }));
  });

  it('staff account: name, email and password are escaped, and the login link must be https', () => {
    const html = getStaffAccountCreatedTemplate({
      staffName: EVIL,
      email: EVIL,
      password: '<b>p&ss</b>',
      loginUrl: 'javascript:alert(1)'
    });
    expectEscaped(html);
    expect(html).toContain('&lt;b&gt;p&amp;ss&lt;/b&gt;');
    expect(html).not.toContain('javascript:');
  });

  it('staff password reset: escaped', () => {
    const html = getStaffPasswordResetTemplate({ staffName: EVIL, email: EVIL, newPassword: '<i>x</i>', loginUrl: 'https://cinesphere.com.vn/login' });
    expectEscaped(html);
    expect(html).not.toContain('<i>x</i>');
  });

  it('staff OTP emails: escaped', () => {
    expectEscaped(getStaffLoginOTPTemplate({ staffName: EVIL, email: EVIL, otp: '123456', expiryMinutes: 5 }));
    expectEscaped(getStaffPasswordChangeOTPTemplate({ staffName: EVIL, email: EVIL, otp: '123456', expiryMinutes: 5 } as any));
  });

  it('an ordinary password with special characters is shown exactly', () => {
    const html = getStaffAccountCreatedTemplate({ staffName: 'An', email: 'an@x.test', password: 'Ab&1<2>' });
    expect(html).toContain('Ab&amp;1&lt;2&gt;');
  });
});

describe('layout and brand settings', () => {
  const ALL_MAILS: Record<string, () => string> = {
    booking: () => getBookingEmailTemplate('https://cinesphere.com.vn', {}),
    reset: () => getResetPasswordEmailTemplate('https://cinesphere.com.vn/reset-password?token=abc'),
    welcome: () => getWelcomeEmailTemplate('https://cinesphere.com.vn', { customerName: 'An', email: 'an@x.test' }),
    otp: () => getOTPEmailTemplate({ customerName: 'An', email: 'an@x.test', otp: '123456', expiryMinutes: 5 }),
    staffCreated: () => getStaffAccountCreatedTemplate({ staffName: 'An', email: 'an@x.test', password: 'pw' }),
    staffReset: () => getStaffPasswordResetTemplate({ staffName: 'An', email: 'an@x.test', newPassword: 'pw' }),
    staffOtp: () => getStaffPasswordChangeOTPTemplate({ staffName: 'An', email: 'an@x.test', otp: '123456', expiryMinutes: 5 }),
    staffLogin: () => getStaffLoginOTPTemplate({ email: 'an@x.test', otp: '123456', expiryMinutes: 5 })
  };

  it('never prints a placeholder, "undefined" or "null" in any mail', () => {
    configureEmailBrand({});
    for (const [name, build] of Object.entries(ALL_MAILS)) {
      const html = build();
      expect(html, name).not.toContain('1900-xxxx');
      expect(html, name).not.toContain('undefined');
      expect(html, name).not.toContain('null');
    }
  });

  it('leaves the hotline and address out when they are not configured, and prints them when they are', () => {
    configureEmailBrand({});
    const bare = getBookingEmailTemplate('https://cinesphere.com.vn', {});
    expect(bare).not.toContain('Hotline');
    expect(bare).not.toContain('Trụ sở');

    configureEmailBrand({ SUPPORT_HOTLINE: '1900 6868', COMPANY_ADDRESS: '1 Đường Phim, Quận 1', SUPPORT_EMAIL: 'help@cinesphere.test' });
    const full = getBookingEmailTemplate('https://cinesphere.com.vn', {});
    expect(full).toContain('Hotline: 1900 6868');
    expect(full).toContain('Trụ sở: 1 Đường Phim, Quận 1');
    expect(full).toContain('help@cinesphere.test');
    configureEmailBrand({});
  });

  it('every mail has a preheader, a table frame and the code or button the customer needs', () => {
    expect(ALL_MAILS.otp()).toContain('Mã của bạn là 123456');
    expect(ALL_MAILS.booking()).toContain('Mã đặt vé của bạn');
    expect(ALL_MAILS.reset()).toContain('token=abc');
    for (const build of Object.values(ALL_MAILS)) {
      expect(build()).toContain('width="600"');
    }
  });

  it('the booking mail lists package and VR lines, the discount and a link to the account page', () => {
    const html = getBookingEmailTemplate('https://cinesphere.com.vn', {
      bookingCode: 'CB1',
      packageLines: [{ name: 'Gói VIP', quantity: 2, unitPrice: 150000, lineTotal: 300000, discounted: true }],
      vrLines: [{ name: 'VR Vũ trụ', quantity: 1, unitPrice: 250000, lineTotal: 250000 }],
      originalTotal: 550000,
      totalPrice: 500000,
      discountAmt: 50000,
      voucherCode: 'SALE'
    });
    expect(html).toContain('Gói VIP');
    expect(html).toContain('ĐƯỢC GIẢM');
    expect(html).toContain('VR Vũ trụ');
    expect(html).toContain('Giảm giá (SALE)');
    expect(html).toContain('https://cinesphere.com.vn/account');
  });

  it('escapes package and VR names', () => {
    const html = getBookingEmailTemplate('https://cinesphere.com.vn', {
      packageLines: [{ name: EVIL, quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
      vrLines: [{ name: EVIL, quantity: 1, unitPrice: 1000, lineTotal: 1000 }]
    });
    expectEscaped(html);
  });

  it('uses one brand name in every subject', () => {
    expect(EMAIL_SUBJECTS.resetPassword).toContain('CINESPHERE');
    expect(EMAIL_SUBJECTS.resetPassword).not.toContain('Film');
    expect(EMAIL_SUBJECTS.bookingConfirmation('X1')).toContain('#X1');
  });
});

describe('plain-text twin', () => {
  it('keeps the code and the link, and drops markup, styles and the hidden preheader', () => {
    const text = htmlToPlainText(getOTPEmailTemplate({ customerName: 'An', email: 'an@x.test', otp: '482913', expiryMinutes: 5 }));
    expect(text).toContain('482913');
    expect(text).not.toContain('<');
    expect(text).not.toContain('font-family');

    const reset = htmlToPlainText(getResetPasswordEmailTemplate('https://cinesphere.com.vn/reset-password?token=abc&x=1'));
    expect(reset).toContain('https://cinesphere.com.vn/reset-password?token=abc&x=1');
  });
});
