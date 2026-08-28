import { eq } from 'drizzle-orm';
import { formatDateForDb } from './date-utils';

export type EmailMetadata = {
  db: any;
  recipient: string;
  subject: string;
  emailType: 'welcome' | 'reset_password' | 'booking_confirmation' | 'otp' | 'staff_otp';
  recipientType?: 'user' | 'staff';
  userId?: number;
  staffId?: number;
  bookingId?: number;
  provider?: string;
  additionalData?: any;
  emailLogsTable?: any;
  runtimeEnv?: string;
};

export class MailQueue {
  private queue: (() => Promise<void>)[] = [];
  private processingPromise: Promise<void> | null = null;

  add(task: () => Promise<void>, metadata: EmailMetadata, context?: { waitUntil: (promise: Promise<any>) => void }) {
    this.queue.push(async () => {
      await this.executeWithLogging(task, metadata);
    });

    // Use microtask to ensure add() returns immediately and doesn't block the response
    Promise.resolve().then(() => {
      const p = this.process();
      if (context && context.waitUntil) {
        context.waitUntil(p);
      }
    });
  }

  private async executeWithLogging(task: () => Promise<void>, metadata: EmailMetadata) {
    const {
      db,
      recipient,
      subject,
      emailType,
      recipientType = 'user',
      userId,
      staffId,
      bookingId,
      provider,
      additionalData,
      emailLogsTable,
      runtimeEnv
    } = metadata;
    let logId: number | null = null;
    let table: any = emailLogsTable;

    try {
      if (!table && db) {
        try {
          const schemaModule = await import('../../worker/src/schema.js');
          table = schemaModule.email_logs;
        } catch (e) {
          console.error('[EmailTracking] Could not load email_logs table:', e);
        }
      }

      if (table && db) {
        try {
          const insertResult = await db
            .insert(table)
            .values({
              recipient,
              subject,
              email_type: emailType,
              status: 'pending',
              provider: provider || null,
              recipient_type: recipientType,
              user_id: userId || null,
              staff_id: staffId || null,
              booking_id: bookingId || null,
              metadata: additionalData ? JSON.stringify(additionalData) : null,
              created_at: formatDateForDb(new Date()),
              updated_at: formatDateForDb(new Date())
            })
            .returning({ id: table.id });

          logId = insertResult[0]?.id;
        } catch (logInsertErr: any) {
          console.warn('[EmailTracking] Could not create pending log in DB:', logInsertErr?.message);
        }
      }

      // Execute email sending task
      await task();

      // Update to sent
      if (logId && table && db) {
        try {
          await db
            .update(table)
            .set({
              status: 'sent',
              sent_at: formatDateForDb(new Date()),
              updated_at: formatDateForDb(new Date())
            })
            .where(eq(table.id, logId));
        } catch (logUpdateErr: any) {
          console.warn('[EmailTracking] Could not update sent status in DB:', logUpdateErr?.message);
        }
      }

      console.log(`[EmailTracking] ✅ Email sent successfully to ${recipient} (ID: ${logId})`);
    } catch (error: any) {
      // Update to failed
      if (logId && table && db) {
        try {
          await db
            .update(table)
            .set({
              status: 'failed',
              error_message: error?.message || String(error),
              updated_at: formatDateForDb(new Date())
            })
            .where(eq(table.id, logId));
        } catch (updateError) {
          console.error('[EmailTracking] Failed to update error log:', updateError);
        }
      }

      console.error(`[EmailTracking] ❌ Email failed (ID: ${logId}):`, error?.message);
      throw error;
    }
  }

  private process(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise;
    }

    // Start new processing loop
    this.processingPromise = (async () => {
      try {
        while (this.queue.length > 0) {
          const task = this.queue.shift();
          if (task) {
            try {
              await task();
            } catch (error) {
              console.error('Mail queue processing error:', error);
            }
          }
        }
      } finally {
        this.processingPromise = null;
      }
    })();

    return this.processingPromise;
  }
}

export const mailQueue = new MailQueue();
