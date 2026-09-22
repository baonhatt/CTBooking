import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth } from '../../middleware';
import { getMailer } from './admin-helpers';

import {
  checkSuperAdminExists,
  setupSuperAdminImpl,
  seedRolesAndPermissionsImpl
} from '../../../../server/routes/admin/setup';

import {
  staffLoginImpl,
  staffLogoutImpl,
  staffExtendSessionImpl,
  staffGetMeImpl,
  staffChangePasswordImpl,
  staffForgotPasswordImpl,
  staffResetPasswordImpl,
  staffRequestPasswordChangeOTP,
  staffChangePasswordWithOTP,
  staffForceChangePasswordImpl
} from '../../../../server/routes/admin/staff-auth';

type Variables = {
  staffId?: number;
  staffEmail?: string;
  staffFullname?: string;
  isSuperAdmin?: boolean;
  staffPermissions?: Array<{ module: string; action: string }>;
  staffBranchIds?: number[];
};

const authRouter = new Hono<{ Bindings: any; Variables: Variables }>();

// Check setup

authRouter.get('/api/admin/setup/super-admin', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const exists = await checkSuperAdminExists(db, { staffs: schema.staffs });

    return c.json({ exists });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Create super admin
authRouter.post('/api/admin/setup/super-admin', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const env = {
      SUPER_ADMIN_EMAIL: c.env.SUPER_ADMIN_EMAIL,

      SUPER_ADMIN_PASSWORD: c.env.SUPER_ADMIN_PASSWORD,

      SUPER_ADMIN_FULLNAME: c.env.SUPER_ADMIN_FULLNAME
    };

    const r = await setupSuperAdminImpl(
      db,
      {
        staffs: schema.staffs,
        permissions: schema.permissions,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions
      },
      body,
      env
    );

    if (r.status === 'error') return c.json(r, 409);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Seed roles and permissions
authRouter.post('/api/admin/setup/seed-roles', requireStaffAuth, async (c) => {
  try {
    const isSuperAdmin = c.get('isSuperAdmin');

    if (!isSuperAdmin) {
      return c.json({ status: 'error', message: 'Chỉ Super Admin mới có thể thực hiện thao tác này' }, 403);
    }

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await seedRolesAndPermissionsImpl(db, {
      permissions: schema.permissions,

      roles: schema.roles,

      rolePermissions: schema.rolePermissions
    });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Login
authRouter.post('/api/admin/auth/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    // --- TURNSTILE VALIDATION BLOCK BẮT ĐẦU ---
    const turnstileToken = (body as any).turnstileToken;
    const clientIp = c.req.header('CF-Connecting-IP') || '127.0.0.1';

    if (typeof turnstileToken !== 'string' || turnstileToken.length === 0) {
      return c.json({ status: 'error', message: 'Vui lòng xác thực bảo mật hệ thống (Captcha)' }, 403);
    }
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: String(c.env.TURNSTILE_SECRET || ''),
          response: turnstileToken,
          remoteip: clientIp
        })
      });
      if (!r.ok) throw new Error(`Turnstile error ${r.status}`);
      const result: any = await r.json();
      if (!result.success || result.action !== 'admin_login') {
        return c.json(
          { status: 'error', message: 'Hệ thống bảo vệ từ chối quyền truy cập do hoạt động bất thường' },
          403
        );
      }
    } catch (err) {
      return c.json({ status: 'error', message: 'Máy chủ không thể kiểm tra xác thực bảo vệ' }, 500);
    }
    // --- TURNSTILE VALIDATION BLOCK KẾT THÚC ---

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffLoginImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.SETTINGS_KV,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    // Bỏ qua tạo session cookie nếu yêu cầu OTP
    if (r.status === 'require_otp') {
      return c.json(r);
    }

    // Set cookie
    c.header('Set-Cookie', `staff_session=${r.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

authRouter.post('/api/admin/auth/verify-login-otp', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.staffId || !body.otp) {
      return c.json({ status: 'error', message: 'Thiếu thông tin xác thực' }, 400);
    }

    // Ensure IP matching if strict security is required?
    // Here we just verify OTP code against the database.
    const db = drizzle(c.env.cinema_db, { schema });
    
    // Import manually since we don't pollute top level imports if possible (or reuse existing)
    const { staffVerifyLoginOtpImpl } = await import('../../../../server/routes/admin/staff-auth');
    
    // Call implementation
    const r = await staffVerifyLoginOtpImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.SETTINGS_KV,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    // Important: set the session cookie finally when 2FA is successful
    c.header('Set-Cookie', `staff_session=${r.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Logout
authRouter.post('/api/admin/auth/logout', requireStaffAuth, async (c) => {
  try {
    const token =
      c.req.header('cookie')?.match(/staff_session=([^;]+)/)?.[1] ||
      c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) return c.json({ status: 'error', message: 'Unauthorized' }, 401);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffLogoutImpl(db, { staffTokens: schema.staffTokens }, token);

    // Clear cookie

    c.header('Set-Cookie', 'staff_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Extend Session
authRouter.post('/api/admin/auth/extend-session', requireStaffAuth, async (c) => {
  try {
    const token =
      c.req.header('cookie')?.match(/staff_session=([^;]+)/)?.[1] ||
      c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) return c.json({ status: 'error', message: 'Unauthorized' }, 401);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffExtendSessionImpl(
      db,
      {
        staffTokens: schema.staffTokens,
        staffs: schema.staffs
      },
      token
    );

    if (r.status === 'error') return c.json(r, 400);

    // Refresh cookie expiry

    c.header('Set-Cookie', `staff_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get Me
authRouter.get('/api/admin/auth/me', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffGetMeImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.SETTINGS_KV,
      staffId
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

authRouter.post('/api/admin/auth/change-password', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffChangePasswordImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.SETTINGS_KV,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

authRouter.post('/api/admin/auth/force-change-password', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffForceChangePasswordImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs
      },
      c.env.SETTINGS_KV,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/request-password-change-otp - Request OTP for password change

authRouter.post('/api/admin/auth/request-password-change-otp', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffRequestPasswordChangeOTP(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, email_logs: schema.email_logs },
      staffId,
      body,
      getMailer(c),
      c.executionCtx
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/change-password-with-otp - Change password with OTP verification

authRouter.post('/api/admin/auth/change-password-with-otp', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffChangePasswordWithOTP(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      c.env.SETTINGS_KV,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/forgot-password - Forgot password

authRouter.post('/api/admin/auth/forgot-password', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffForgotPasswordImpl(db, { staffs: schema.staffs, staffTokens: schema.staffTokens }, body);

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/reset-password - Reset password with token

authRouter.post('/api/admin/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffResetPasswordImpl(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      c.env.SETTINGS_KV,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ── Helper ──────────────────────────────────────────────────────────────────

// ===== DEPRECATED ADMIN LOGIN ===============================
// ============================================================
authRouter.post('/api/admin/login', (c) => {
  return c.json(
    {
      status: 'error',
      message: 'Endpoint này đã bị xóa. Vui lòng dùng /api/admin/auth/login'
    },
    410
  );
});

// ============================================================

export default authRouter;
