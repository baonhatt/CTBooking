import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';

import { getBookingEmailTemplate } from '../utils';
import { sendMail } from '../../../server/routes/mail-service';
import { handleSePayWebhookImpl } from '../../../server/routes/webhook/sepay';


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

webhookRouter.post('/api/sepay/webhook', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    const body = await c.req.json().catch(() => ({}));

    // Worker Mailer Injection

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const result = await handleSePayWebhookImpl(
      db,

      tables,

      body,

      mailer,

      renderBooking,

      c.executionCtx
    );

    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, message: 'Internal Error' });
  }
});

export default webhookRouter;
