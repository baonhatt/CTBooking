import type { Login, Register } from '@shared/api';
import { eq, desc, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sendMail } from '../mail-service';
import { mailQueue } from '../../lib/mail-queue';
import { getWelcomeEmailTemplate } from '../../lib/booking-utils';
import { formatDateForDb } from '../../lib/date-utils';
import { generateOTP, sendOTPEmail, createOTPRecord, validateOTP, deleteOTP, canResendOTP } from '../../lib/otp-utils';
import { getAdminSettingsImpl } from '../admin/settings';

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

export async function loginWithSessionImpl(
        anyDb: any,
        tables: { accounts: any; users: any; tokens: any; email_logs?: any },
        payload: Partial<Login> & { days?: number },
        generateTokenFn: () => Promise<string>,
        calculateExpiryFn: (days: number) => string,
        kv?: any,
        sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        const email = payload.email || '';
        const password = payload.password || '';
        const days = payload.days || 30;

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

        // Check 2FA settings
        const settingsResult = await getAdminSettingsImpl(kv);
        const settings = settingsResult.settings || {};
        const enable2FA = settings.otp_settings?.enable_2fa === true;
        const otpExpiryMinutes = settings.otp_settings?.otp_expiry_minutes || 5;
        const otpLength = settings.otp_settings?.otp_length || 6;

        if (enable2FA) {
                // Generate OTP
                const otp = generateOTP(otpLength);
                await createOTPRecord(anyDb, { tokens: tables.tokens }, useracc.id, otp, otpExpiryMinutes);
                await sendOTPEmail(anyDb, { email_logs: tables.email_logs }, email, user?.fullname || email.split('@')[0], otp, otpExpiryMinutes, sendMailFn, context);

                return {
                        status: 200,
                        requires_otp: true,
                        message: 'OTP đã gửi đến email của bạn',
                        temp_account_id: useracc.id,
                        email: email
                };
        }

        // Tạo session token
        const token = await generateTokenFn();
        const expiredAt = calculateExpiryFn(days);

        await anyDb.insert(tables.tokens).values({
                account_id: useracc.id,
                type: 'session',
                token,
                expired_at: expiredAt,
                created_at: formatDateForDb(new Date())
        });

        return {
                status: 200,
                message: 'Đăng nhập thành công!',
                user: { username: user?.fullname, email, phone: user?.phone },
                token
        };
}

export async function validateSessionTokenImpl(
        anyDb: any,
        tables: { tokens: any },
        token: string
): Promise<{ valid: boolean; accountId?: number; userId?: number }> {
        if (!token) return { valid: false };

        const tokenRecord = await anyDb.query.tokens.findFirst({
                where: and(eq(tables.tokens.token, token), eq(tables.tokens.type, 'session')),
                with: {
                        account: true
                }
        });
        if (!tokenRecord) return { valid: false };

        // Check expiry
        if (tokenRecord.expired_at) {
                const expiredAt = new Date(tokenRecord.expired_at);
                if (expiredAt < new Date()) {
                        // Delete expired token
                        await anyDb.delete(tables.tokens).where(eq(tables.tokens.id, tokenRecord.id));
                        return { valid: false };
                }
        }

        return {
                valid: true,
                accountId: tokenRecord.account_id,
                userId: tokenRecord.account?.user_id
        };
}

export async function validateOTPImpl(
        anyDb: any,
        tables: { accounts: any; users: any; tokens: any; email_logs?: any },
        payload: { temp_account_id: number; otp: string; days?: number },
        generateTokenFn: () => Promise<string>,
        calculateExpiryFn: (days: number) => string,
        kv?: any,
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        const { temp_account_id, otp, days = 30 } = payload;

        const useracc = await anyDb.query.accounts.findFirst({
                where: eq(tables.accounts.id, temp_account_id)
        });
        if (!useracc) {
                return { status: 404, message: 'Tài khoản không tồn tại!' };
        }

        const validation = await validateOTP(anyDb, { tokens: tables.tokens }, temp_account_id, otp);
        if (!validation.valid) {
                return { status: 400, message: validation.error || 'OTP không hợp lệ' };
        }

        const user = await anyDb.query.users.findFirst({
                where: eq(tables.users.id, useracc.user_id)
        });

        // Delete OTP after successful validation
        await deleteOTP(anyDb, { tokens: tables.tokens }, temp_account_id);

        // Create session token
        const token = await generateTokenFn();
        const expiredAt = calculateExpiryFn(days);

        await anyDb.insert(tables.tokens).values({
                account_id: useracc.id,
                type: 'session',
                token,
                expired_at: expiredAt,
                created_at: formatDateForDb(new Date())
        });

        return {
                status: 200,
                message: 'Xác thực OTP thành công!',
                user: { username: user?.fullname, email: useracc.email, phone: user?.phone },
                token
        };
}

export async function resendOTPImpl(
        anyDb: any,
        tables: { accounts: any; users: any; tokens: any; email_logs?: any },
        payload: { temp_account_id: number; email: string },
        kv?: any,
        sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        const { temp_account_id, email } = payload;

        const useracc = await anyDb.query.accounts.findFirst({
                where: eq(tables.accounts.id, temp_account_id)
        });
        if (!useracc) {
                return { status: 404, message: 'Tài khoản không tồn tại!' };
        }

        const user = await anyDb.query.users.findFirst({
                where: eq(tables.users.id, useracc.user_id)
        });

        // Get settings for cooldown
        const settingsResult = await getAdminSettingsImpl(kv);
        const settings = settingsResult.settings || {};
        console.log('[RESEND OTP] Settings loaded:', JSON.stringify(settings));
        const cooldownSeconds = settings.otp_settings?.otp_resend_cooldown_seconds || 30;
        const otpExpiryMinutes = settings.otp_settings?.otp_expiry_minutes || 5;
        const otpLength = settings.otp_settings?.otp_length || 6;

        // Check cooldown
        const cooldownCheck = await canResendOTP(anyDb, { tokens: tables.tokens }, temp_account_id, cooldownSeconds);
        if (!cooldownCheck.canResend) {
                return {
                        status: 429,
                        message: `Vui lòng đợi ${cooldownCheck.secondsRemaining} giây trước khi gửi lại OTP`,
                        seconds_remaining: cooldownCheck.secondsRemaining
                };
        }

        // Generate new OTP
        const otp = generateOTP(otpLength);
        console.log('[RESEND OTP] Generated OTP for account:', temp_account_id);
        await createOTPRecord(anyDb, { tokens: tables.tokens }, temp_account_id, otp, otpExpiryMinutes);
        console.log('[RESEND OTP] Sending email to:', email);
        await sendOTPEmail(anyDb, { email_logs: tables.email_logs }, email, user?.fullname || email.split('@')[0], otp, otpExpiryMinutes, sendMailFn, context);
        console.log('[RESEND OTP] Email sent successfully');

        return {
                status: 200,
                message: 'OTP mới đã được gửi đến email của bạn'
        };
}

export async function registerImpl(
        anyDb: any,
        tables: { accounts: any; users: any; email_logs?: any },
        payload: Partial<Register> & { gender?: string; dob?: string; phone?: string; name?: string },
        sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
        getWelcomeEmailHtml?: (data: { customerName: string; email: string }) => string,
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
                        dob = formatDateForDb(dobStr);
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
                                created_at: formatDateForDb(nowIso),
                                updated_at: formatDateForDb(nowIso)
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
                        created_at: formatDateForDb(nowIso),
                        updated_at: formatDateForDb(nowIso)
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
                                        emailLogsTable: tables.email_logs
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
