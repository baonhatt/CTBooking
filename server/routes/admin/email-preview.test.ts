import { describe, it, expect, vi } from 'vitest';
import { getEmailPreviewImpl, sendTestEmailImpl } from './email-preview';

describe('getEmailPreviewImpl', () => {
  it('lists every mail with who gets it, its subject, its HTML and its plain-text twin', async () => {
    const result: any = await getEmailPreviewImpl();

    expect(result.data.length).toBeGreaterThanOrEqual(10);
    for (const template of result.data) {
      expect(['user', 'staff']).toContain(template.audience);
      expect(template.subject).toBeTruthy();
      expect(template.html).toContain('<!DOCTYPE html>');
      expect(template.text.length).toBeGreaterThan(20);
      expect(template.sent).toBe(true);
    }
    expect(result.data.map((template: any) => template.id)).toContain('staff_login_otp');
  });
});

describe('sendTestEmailImpl', () => {
  it('sends the chosen sample to the given address with a test marker in the subject', async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const result: any = await sendTestEmailImpl('otp_login', 'me@cinesphere.test', send);

    expect(result.status).toBe('success');
    expect(send).toHaveBeenCalledTimes(1);
    const [to, subject, html] = send.mock.calls[0] as any[];
    expect(to).toBe('me@cinesphere.test');
    expect(subject).toContain('[THỬ]');
    expect(html).toContain('829471');
  });

  it('refuses an unknown sample and an empty address, and sends nothing', async () => {
    const send = vi.fn();
    expect(((await sendTestEmailImpl('nope', 'me@cinesphere.test', send)) as any).status).toBe('error');
    expect(((await sendTestEmailImpl('otp_login', '', send)) as any).status).toBe('error');
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses anything that is not one plain address (several addresses, names, line breaks)', async () => {
    const send = vi.fn();
    for (const bad of ['a@b.test, c@d.test', 'A <a@b.test>', 'a@b.test\nBcc: x@y.test', 'no-at-sign', 'a@b', 'a b@c.test']) {
      expect(((await sendTestEmailImpl('otp_login', bad, send)) as any).status, bad).toBe('error');
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('trims the address before sending', async () => {
    const send = vi.fn(async () => ({ ok: true }));
    await sendTestEmailImpl('otp_login', '  me@cinesphere.test  ', send);
    expect((send.mock.calls[0] as any[])[0]).toBe('me@cinesphere.test');
  });
});
