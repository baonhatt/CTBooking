import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueStaffCredentialsEmail, resolve_staff_login_url } from './staff-credentials-mail';
import { mailQueue } from './mail-queue';
import { EMAIL_SUBJECTS } from './email-templates';

vi.mock('./mail-queue', () => ({ mailQueue: { add: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const staff = { id: 7, email: 'an@cinesphere.test', fullname: 'An' };

async function run_queued_task(kind: 'created' | 'reset') {
  const sent: any[] = [];
  queueStaffCredentialsEmail({
    anyDb: {},
    kind,
    staff,
    password: 'Gen-Pass-1234!',
    loginUrl: 'https://admin.cinesphere.test/',
    sendMailFn: async (to, subject, html) => {
      sent.push({ to, subject, html });
    }
  });
  await (mailQueue.add as any).mock.calls[0][0]();
  return { sent, metadata: (mailQueue.add as any).mock.calls[0][1] };
}

describe('queueStaffCredentialsEmail', () => {
  it('sends the new account mail with the password and the sign-in link to the staff member', async () => {
    const { sent } = await run_queued_task('created');

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('an@cinesphere.test');
    expect(sent[0].subject).toBe(EMAIL_SUBJECTS.staffAccountCreated);
    expect(sent[0].html).toContain('Gen-Pass-1234!');
    expect(sent[0].html).toContain('https://admin.cinesphere.test/');
  });

  it('sends the reset mail with its own subject', async () => {
    const { sent } = await run_queued_task('reset');

    expect(sent[0].subject).toBe(EMAIL_SUBJECTS.staffPasswordReset);
    expect(sent[0].html).toContain('Gen-Pass-1234!');
  });

  it('never puts the password in the email log row', async () => {
    const { metadata } = await run_queued_task('created');

    expect(JSON.stringify(metadata)).not.toContain('Gen-Pass-1234!');
    expect(metadata).toMatchObject({ emailType: 'staff_credentials', recipientType: 'staff', staffId: 7 });
  });
});

describe('resolve_staff_login_url', () => {
  it('uses the admin site the request came from when it is https or localhost', () => {
    expect(resolve_staff_login_url('https://admin.cinesphere.test', 'https://cinesphere.com.vn')).toBe('https://admin.cinesphere.test/');
    expect(resolve_staff_login_url('http://localhost:8080', 'https://cinesphere.com.vn')).toBe('http://localhost:8080/');
  });

  it('falls back to the public site for a missing, http or odd origin', () => {
    for (const origin of [undefined, '', 'http://evil.test', 'javascript:alert(1)', 'https://a.test/path?x=1']) {
      expect(resolve_staff_login_url(origin, 'https://cinesphere.com.vn/')).toBe('https://cinesphere.com.vn/');
    }
  });
});
