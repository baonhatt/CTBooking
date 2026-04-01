import type { Login, Register } from '@shared/api';
import { eq, desc, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sendMail } from '../mail-service';
import { mailQueue } from '../../lib/mail-queue';
import { getWelcomeEmailTemplate } from '../../lib/booking-utils';
import { formatDateForDb } from '../../lib/date-utils';

export async function loginImpl(anyDb: any, tables: { accounts: any; users: any }, payload: Partial<Login>) {
  const email = payload.email || '';
  const password = payload.password || '';
  const useracc = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.email, email)
  });
  if (!useracc) {
    return { status: 404, message: 'Email không tồn tại!' };
  }
  const isPasswordValid = await bcrypt.compare(password, useracc.password || '');
  if (!isPasswordValid) {
    return { status: 400, message: 'Mật khẩu không đúng!' };
  }
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, useracc.user_id)
  });
  return {
    status: 200,
    message: 'Đăng nhập thành công!',
    user: { username: user?.fullname, email, phone: user?.phone }
  };
}

export async function registerImpl(
  anyDb: any,
  tables: { accounts: any; users: any; email_logs?: any },
  payload: Partial<Register> & { gender?: string; dob?: string; phone?: string; name?: string },
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getWelcomeEmailHtml?: (data: { customerName: string; email: string }) => string,
  RUNTIME_ENV?: string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  try {
    const { email, password } = payload;
    const gender = payload.gender;
    const dobStr = payload.dob;
    const phone = payload.phone;

    if (!email || !password) {
      return { status: 400, message: 'Email và mật khẩu không được để trống!' };
    }

    const existing = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
    if (existing) {
      return { status: 400, message: 'Email đã tồn tại' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let fullname = payload.name;
    if (!fullname || fullname.trim() === '') {
      fullname = email.split('@')[0];
    }

    let dob: string | undefined | Date;
    if (dobStr && typeof dobStr === 'string' && dobStr.trim()) {
      dob = formatDateForDb(dobStr, RUNTIME_ENV);
    }

    // D1/SQLite có thể không hỗ trợ transaction đầy đủ như Postgres
    // Nên tách ra thành các bước riêng, nhưng vẫn đảm bảo thứ tự: USER → ACCOUNT

    const nowIso = new Date();
    // Step 1: Tạo USER trước (vì account cần user_id - foreign key constraint)
    // Try to use .returning() to obtain the created user when supported; fallback to previous selection otherwise.
    const insertedUserRes = await anyDb
      .insert(tables.users)
      .values({
        fullname: fullname,
        phone: phone,
        gender: gender,
        dob: dob,
        created_at: formatDateForDb(nowIso, RUNTIME_ENV),
        updated_at: formatDateForDb(nowIso, RUNTIME_ENV)
      })
      .returning();

    let user: any = Array.isArray(insertedUserRes) ? insertedUserRes[0] : insertedUserRes;

    if (!user) throw new Error('Không thể tạo thông tin người dùng (Insert failed)');

    // Step 2: Tạo ACCOUNT sau (với user_id từ user vừa tạo)
    await anyDb.insert(tables.accounts).values({
      user_id: user.id,
      email,
      password: hashedPassword,
      login_type: 'email',
      is_active: true,
      created_at: formatDateForDb(nowIso, RUNTIME_ENV),
      updated_at: formatDateForDb(nowIso, RUNTIME_ENV)
    });

    const newUser = user;

    try {
      let html = '';
      const templateData = {
        customerName: fullname || email.split('@')[0],
        email
      };

      if (getWelcomeEmailHtml) {
        html = getWelcomeEmailHtml(templateData);
      } else {
        html = getWelcomeEmailTemplate(templateData);
      }

      const mailer = sendMailFn || sendMail;
      // Sử dụng mailQueue để gửi mail ngầm
      mailQueue.add(
        async () => {
          try {
            await mailer(email, '🎉 Chào mừng bạn đến CINESPHERE', html);
            console.log(`[MailQueue] Sent welcome email to ${email}`);
          } catch (e) {
            console.error(`[MailQueue] Failed to send welcome email to ${email}`, e);
            throw e;
          }
        },
        {
          db: anyDb,
          recipient: email,
          subject: '🎉 Chào mừng bạn đến CINESPHERE',
          emailType: 'welcome',
          userId: newUser.id,
          emailLogsTable: tables.email_logs,
          runtimeEnv: RUNTIME_ENV
        },
        context
      );
    } catch (mailErr: any) {
      // Mail queue handles errors, so this catch block might be less relevant for the queue add itself,
      // but kept for safety if queue logic throws synchronously.
      console.error('Mail queue error:', mailErr);
    }

    return {
      status: 200,
      message: 'Đăng ký thành công',
      user: { id: newUser.id, email },
      emailSent: true
    };

    return {
      status: 200,
      message: 'Đăng ký thành công',
      user: { id: newUser.id, email },
      emailSent: true
    };
  } catch (err: any) {
    return { status: 500, message: `Server error: ${err?.message || String(err)}` };
  }
}
