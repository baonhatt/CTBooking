// ============================================================
// CINESPHERE - Mail with a staff member's login details
//
// Sent when a staff account is created and when a Super Admin resets a staff password.
// The mail holds the new password, so:
//   - the email log row stores only the subject and the recipient, never the password;
//   - the staff member must change the password at the first login (forcePasswordChange is already set).
// ============================================================

import { EMAIL_SUBJECTS, getStaffAccountCreatedTemplate, getStaffPasswordResetTemplate } from './email-templates';
import { mailQueue } from './mail-queue';

export type StaffCredentialsKind = 'created' | 'reset';

/** Where the sign-in link points: the admin site the request came from, if it is a normal https address. */
export function resolve_staff_login_url(adminBaseUrl: string | undefined, fallbackBaseUrl: string): string {
  const candidate = String(adminBaseUrl || '').trim().replace(/\/+$/, '');
  const usable = /^https:\/\/[^\s/]+$/i.test(candidate) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(candidate);
  return `${usable ? candidate : fallbackBaseUrl.replace(/\/+$/, '')}/`;
}

export function queueStaffCredentialsEmail(args: {
  anyDb: any;
  emailLogsTable?: any;
  kind: StaffCredentialsKind;
  staff: { id: number; email: string; fullname: string };
  password: string;
  loginUrl: string;
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>;
  context?: { waitUntil: (promise: Promise<any>) => void };
}) {
  const { anyDb, emailLogsTable, kind, staff, password, loginUrl, sendMailFn, context } = args;

  const subject = kind === 'created' ? EMAIL_SUBJECTS.staffAccountCreated : EMAIL_SUBJECTS.staffPasswordReset;
  const html =
    kind === 'created'
      ? getStaffAccountCreatedTemplate({ staffName: staff.fullname, email: staff.email, password, loginUrl })
      : getStaffPasswordResetTemplate({ staffName: staff.fullname, email: staff.email, newPassword: password, loginUrl });

  mailQueue.add(
    async () => {
      if (!sendMailFn) {
        console.warn('[StaffCredentials] No mailer provided, skipping email');
        return;
      }
      await sendMailFn(staff.email, subject, html);
    },
    {
      db: anyDb,
      recipient: staff.email,
      subject,
      emailType: 'staff_credentials',
      recipientType: 'staff',
      staffId: staff.id,
      emailLogsTable
    },
    context
  );
}
