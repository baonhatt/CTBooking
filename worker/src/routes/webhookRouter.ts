import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import * as schema from '../../../shared/schema';

import { getBookingEmailTemplate } from '../utils';
import { logSystemError } from '../utils';
import { sendMail } from '../../../server/routes/mail-service';
import { handleSePayWebhookImpl, timingSafeEqualStr } from '../../../server/routes/webhook/sepay';

const sepayWebhookSchema = z.object({
  gateway: z.string().optional(),
  transactionDate: z.string().optional(),
  accountNumber: z.string().optional(),
  subAccount: z.string().optional(),
  transferType: z.string().optional(),
  transferAmount: z.union([z.number(), z.string()]),
  referenceCode: z.string().optional(),
  description: z.string().optional(),
  content: z.string(),
  id: z.union([z.number(), z.string()]).optional()
}).passthrough();

const webhookRouter = new Hono<any>();

function getMailer(c: Context) {
  return async (to: string, subject: string, html: string) => {
    const res = await sendMail(to, subject, html, c.env);
    if (res.ok) {
      console.log(`[Mailer] Sent email to ${to} via ${res.provider}`);
    }
    return res;
  };
}

const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  email_logs: schema.email_logs,
  branches: schema.branches,
  booking_vr_items: schema.booking_vr_items,
  vouchers: schema.vouchers,
  voucher_redemption_logs: schema.voucher_redemption_logs
});

webhookRouter.post('/api/webhooks/sepay', async (c) => {
  try {
    const authHeader = c.req.header('authorization');
    const expectedKey = c.env.SEPAY_API_KEY;

    if (!authHeader || !expectedKey) {
      logSystemError('sepay-webhook-auth', 'Missing Authorization header or SEPAY_API_KEY');
      return c.json({ success: false, message: 'Unauthorized (401)', status: 401 }, 401);
    }
    const expectedHeaderValue = `Apikey ${expectedKey}`;
    if (!timingSafeEqualStr(authHeader, expectedHeaderValue)) {
      return c.json({ success: false, message: 'Unauthorized (401)', status: 401 }, 401);
    }

    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);

    const body = await c.req.json().catch(() => ({}));
    
    const parsed = sepayWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ status: 'error', message: parsed.error.issues[0].message }, 400);
    }

    // Worker Mailer Injection

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const result = await handleSePayWebhookImpl(
      db,
      tables,
      parsed.data,
      mailer,
      renderBooking,
      c.executionCtx,
      authHeader,
      expectedKey,
      logSystemError
    );

    if ((result as any).status) {
      return c.json(result, (result as any).status);
    }
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, message: 'Internal Error' });
  }
});

export default webhookRouter;
