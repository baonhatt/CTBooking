import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';

import { requireStaffAuth, requirePermission, rateLimiter } from '../middleware';
import { sendMail } from '../../../server/routes/mail-service';
import {
  cloudinarySignedParams,
  hasCloudinary,
  getBookingEmailTemplate,
  uploadCloudinaryImageDataURI,
  getPublicIdFromUrl,
  deleteCloudinaryImage,
  parseMediaUrl,
  pingIndexNow,
  logSystemError
} from '../utils';

import {
  createMovieImpl,
  updateMovieImpl,
  deleteMovieImpl,
  updateMovieStatusImpl,
  restoreMovieImpl,
  listDeletedMoviesImpl,
  getMovieByIdImpl
} from '../../../server/routes/admin/movies';

import {
  listShowtimesImpl,
  createShowtimeImpl,
  copyShowtimesImpl,
  updateShowtimeImpl,
  deleteShowtimeImpl
} from '../../../server/routes/admin/showtimes';

import {
  listToysImpl,
  createToyImpl,
  getToyImpl,
  updateToyImpl,
  deleteToyImpl,
  restoreToyImpl,
  listDeletedToysImpl
} from '../../../server/routes/admin/toys';

import {
  createTicketPackageImpl,
  updateTicketPackageImpl,
  deleteTicketPackageImpl,
  restoreTicketPackageImpl,
  listDeletedTicketPackagesImpl,
  toggleTicketStatusImpl,
  listTicketPackagesImpl,
  getTicketPackageImpl
} from '../../../server/routes/admin/tickets';

import {
  listBranchesImpl,
  listBranchOptionsImpl,
  getBranchImpl,
  createBranchImpl,
  updateBranchImpl,
  deleteBranchImpl,
  toggleBranchStatusImpl,
  toggleBranchOpenImpl,
  restoreBranchImpl,
  listDeletedBranchesImpl
} from '../../../server/routes/admin/branches';

import { createSiteMediaImpl, updateSiteMediaImpl, deleteSiteMediaImpl, listSiteMediaImpl } from '../../../server/routes/admin/site-media';

import {
  listPostsImpl,
  getPostImpl,
  createPostImpl,
  updatePostImpl,
  deletePostImpl
} from '../../../server/routes/admin/posts';

import {
  listVouchersImpl,
  getVoucherImpl,
  createVoucherImpl,
  updateVoucherImpl,
  toggleVoucherStatusImpl,
  deleteVoucherImpl,
  restoreVoucherImpl,
  listDeletedVouchersImpl
} from '../../../server/routes/admin/vouchers';

import { expireStaleBookingsImpl } from '../../../server/routes/scheduled/booking-expiry';

import {
  getDashboardMetricsImpl,
  getRevenueByDateImpl,
  getRevenue7DaysImpl,
  getRevenueByMonthImpl
} from '../../../server/routes/admin/dashboard';

import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from '../../../server/routes/admin/payments';
import { getBookingByCodeImpl, confirmUseTicketImpl, updatePaymentImpl } from '../../../server/routes/user/payments';
import { getAdminSettingsImpl, updateAdminSettingsImpl } from '../../../server/routes/admin/settings';
import { getUsersImpl, getUserByIdImpl } from '../../../server/routes/admin/users';
import { getEmailLogsImpl } from '../../../server/routes/admin/email-logs';
import { getAuditLogsImpl } from '../../../server/lib/audit-logger';
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
} from '../../../server/routes/admin/staff-auth';
import {
  checkSuperAdminExists,
  setupSuperAdminImpl,
  seedRolesAndPermissionsImpl
} from '../../../server/routes/admin/setup';
import {
  listStaffImpl,
  getStaffByIdImpl,
  createStaffImpl,
  updateStaffImpl,
  deleteStaffImpl,
  restoreStaffImpl,
  listDeletedStaffImpl,
  resetStaffPasswordImpl
} from '../../../server/routes/admin/staff-management';
import {
  listRolesImpl,
  getRoleByIdImpl,
  createRoleImpl,
  updateRoleImpl,
  deleteRoleImpl,
  restoreRoleImpl,
  listDeletedRolesImpl,
  listPermissionsImpl
} from '../../../server/routes/admin/roles';

type Variables = {
  staffId?: number;
  staffEmail?: string;
  staffFullname?: string;
  isSuperAdmin?: boolean;
  staffPermissions?: Array<{ module: string; action: string }>;
  staffBranchIds?: number[];
};

export const adminRouter = new Hono<{ Bindings: any; Variables: Variables }>();

// ==================== [BATCH 0] ADMIN SETUP & AUTHENTICATION ====================

// Check setup

adminRouter.get('/api/admin/setup/super-admin', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const exists = await checkSuperAdminExists(db, { staffs: schema.staffs });

    return c.json({ exists });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Create super admin
adminRouter.post('/api/admin/setup/super-admin', async (c) => {
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
adminRouter.post('/api/admin/setup/seed-roles', requireStaffAuth, async (c) => {
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
adminRouter.post('/api/admin/auth/login', async (c) => {
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
      null,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    // Set cookie

    c.header('Set-Cookie', `staff_session=${r.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Logout
adminRouter.post('/api/admin/auth/logout', requireStaffAuth, async (c) => {
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
adminRouter.post('/api/admin/auth/extend-session', requireStaffAuth, async (c) => {
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
adminRouter.get('/api/admin/auth/me', requireStaffAuth, async (c) => {
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
      null,
      staffId
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/auth/change-password', requireStaffAuth, async (c) => {
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
      null,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/auth/force-change-password', requireStaffAuth, async (c) => {
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
      null,
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

adminRouter.post('/api/admin/auth/request-password-change-otp', requireStaffAuth, async (c) => {
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

adminRouter.post('/api/admin/auth/change-password-with-otp', requireStaffAuth, async (c) => {
  try {
    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffChangePasswordWithOTP(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      null,
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

adminRouter.post('/api/admin/auth/forgot-password', async (c) => {
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

adminRouter.post('/api/admin/auth/reset-password', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffResetPasswordImpl(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      null,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ── Helper ──────────────────────────────────────────────────────────────────
function getRestrictBranchIds(c: Context): number[] | null {
  const isSuperAdmin = c.get('isSuperAdmin');
  const staffBranchIds = (c.get('staffBranchIds') as number[] | undefined) || [];
  return isSuperAdmin ? null : staffBranchIds;
}

function getMailer(c: Context) {
  return async (to: string, subject: string, html: string) => {
    const res = await sendMail(to, subject, html, c.env);
    if (res.ok) console.log(`[AdminMailer] Sent to ${to} via ${res.provider}`);
    return res;
  };
}

const getCloudHelpers = (c: Context, env: any) => {
  return {
    uploader: async (base64: string, folder: string) => {
      try {
        if (hasCloudinary(env)) {
          const res = await uploadCloudinaryImageDataURI(env, base64, folder);
          return { url: res.url };
        }
      } catch (err) {
        console.warn('[Uploader] Cloudinary upload failed, using Data URI fallback:', err);
      }
      return { url: base64 };
    },
    deleter: async (url: string, type: 'image' | 'video' = 'image') => {
      try {
        const publicId = getPublicIdFromUrl(url);
        if (publicId && hasCloudinary(env)) {
          await deleteCloudinaryImage(env, publicId, type);
        }
      } catch (err) {
        console.warn('[Deleter] Cloudinary delete warning:', err);
      }
    }
  };
};

// ============================================================
// ===== DEPRECATED ADMIN LOGIN ===============================
// ============================================================
adminRouter.post('/api/admin/login', (c) => {
  return c.json(
    {
      status: 'error',
      message: 'Endpoint này đã bị xóa. Vui lòng dùng /api/admin/auth/login'
    },
    410
  );
});

// ============================================================
// ===== DASHBOARD & REVENUE ==================================
// ============================================================

adminRouter.get('/api/admin/dashboard/metrics', requireStaffAuth, requirePermission('dashboard', 'view'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const period = c.req.query('period') || 'week';

    const yearParam = c.req.query('year');

    const year = yearParam ? parseInt(yearParam) : undefined;
    const branchIdParam = c.req.query('branch_id');
    const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
    const restrictBranchIds = getRestrictBranchIds(c);
    const branchIds =
      branchId !== undefined && !Number.isNaN(branchId)
        ? restrictBranchIds
          ? restrictBranchIds.filter((id) => id === branchId)
          : [branchId]
        : restrictBranchIds;

    const r = await getDashboardMetricsImpl(
      db,

      {
        movies: schema.movies,

        users: schema.users,

        bookings: schema.bookings,

        ticket_packages: schema.ticket_packages,

        toys: schema.toys,

        branches: schema.branches,

        booking_vr_items: schema.booking_vr_items,

        voucher_redemption_logs: schema.voucher_redemption_logs
      },

      period,

      year,
      branchIds
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get(
  '/api/admin/dashboard/revenue-date',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const date = String(c.req.query('date') || '');

      const status = String(c.req.query('status') || 'paid');

      const yearParam = c.req.query('year');

      const year = yearParam ? parseInt(yearParam) : undefined;
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenueByDateImpl(db, { bookings: schema.bookings }, { date, status, year, branchIds });

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

adminRouter.get(
  '/api/admin/dashboard/revenue-7days',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const yearParam = c.req.query('year');

      const year = yearParam ? parseInt(yearParam) : undefined;
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenue7DaysImpl(db, { bookings: schema.bookings }, year, branchIds);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

adminRouter.get(
  '/api/admin/dashboard/revenue-month',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const year = String(c.req.query('year') || '');

      const month = String(c.req.query('month') || '');

      const status = String(c.req.query('status') || 'paid');
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenueByMonthImpl(
        db,

        { bookings: schema.bookings },

        { year, month, status, branchIds }
      );

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// ============================================================
// ===== TRANSACTIONS (Finance) ===============================
// ============================================================

adminRouter.get('/api/admin/revenue', requireStaffAuth, requirePermission('dashboard', 'view_revenue'), async (c) => {
  try {
    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');

    const status = String(c.req.query('status') || 'paid');

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getRevenueImpl(
      db,
      { bookings: schema.bookings },
      { from, to, status, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/transactions', requireStaffAuth, requirePermission('transactions', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const searchText = String(c.req.query('searchText') || '');

    const status = String(c.req.query('status') || 'all');

    const sort = String(c.req.query('sort') || 'created_at');

    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const payment_method = String(c.req.query('payment_method') || '');

    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');
    const booking_type_raw = String(c.req.query('booking_type') || 'all');
    const booking_type = (['all', 'movie', 'vr'].includes(booking_type_raw) ? booking_type_raw : 'all') as
      | 'all'
      | 'movie'
      | 'vr';
    const branch_id_raw = c.req.query('branch_id');
    const branch_id = branch_id_raw && branch_id_raw !== 'all' ? Number(branch_id_raw) : undefined;

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await listTransactionsImpl(
      db,
      {
        bookings: schema.bookings,
        users: schema.users,
        accounts: schema.accounts,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        vouchers: (schema as any).vouchers,
        booking_vr_items: (schema as any).booking_vr_items
      },
      {
        page,
        pageSize,

        searchText,

        status,

        sort,

        dir,

        payment_method,

        branch_id: branch_id,

        from,
        to,
        booking_type,
        restrictToBranchIds: restrictBranchIds
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get(
  '/api/admin/transactions/:id',
  requireStaffAuth,
  requirePermission('transactions', 'view'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const db = drizzle(c.env.cinema_db, { schema });
      const restrictBranchIds = getRestrictBranchIds(c);

      const r = await getTransactionByIdImpl(
        db,

        {
          bookings: schema.bookings,

          users: schema.users,

          accounts: schema.accounts,

          movies: schema.movies,

          ticket_packages: schema.ticket_packages,

          branches: schema.branches,
          auditLogs: schema.auditLogs,
          booking_vr_items: (schema as any).booking_vr_items,
          vouchers: (schema as any).vouchers
        },
        id,
        restrictBranchIds
      );

      if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// ============================================================
// ===== SETTINGS & EMAIL LOGS ================================
// ============================================================

adminRouter.get('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'view'), async (c) => {
  try {
    const r = await getAdminSettingsImpl();

    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'manage'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const r = await updateAdminSettingsImpl(null, body);

    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/email-logs', requireStaffAuth, requirePermission('email_logs', 'view'), async (c) => {
  try {
    const status = c.req.query('status') || 'all';

    const email_type = c.req.query('email_type') || 'all';

    const search = c.req.query('search') || '';

    const page = Number(c.req.query('page') || 1);

    const limit = Number(c.req.query('limit') || 20);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getEmailLogsImpl(
      db,

      {
        email_logs: schema.email_logs,

        users: schema.users,

        bookings: schema.bookings
      },

      { status, email_type, search, page, limit }
    );

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'Internal error' }, 500);
  }
});

// ============================================================
// ===== USERS (Admin View) ===================================
// ============================================================

adminRouter.get('/api/admin/users', requireStaffAuth, requirePermission('users', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const q = String(c.req.query('q') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUsersImpl(
      db,

      {
        users: schema.users,

        accounts: schema.accounts,

        bookings: schema.bookings
      },

      { page, pageSize, q }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/users/:id', requireStaffAuth, requirePermission('users', 'view_detail'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUserByIdImpl(
      db,

      {
        users: schema.users,

        bookings: schema.bookings,

        movies: schema.movies,

        ticket_packages: schema.ticket_packages,

        auditLogs: schema.auditLogs
      },

      id
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});



// ============================================================
// ===== AUDIT LOGS ===========================================
// ============================================================

adminRouter.get('/api/admin/audit-logs', requireStaffAuth, requirePermission('audit_logs', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const module = c.req.query('module') || '';

    const action = c.req.query('action') || '';

    const staffId = c.req.query('staffId') ? Number(c.req.query('staffId')) : undefined;

    const from = c.req.query('from') || '';

    const to = c.req.query('to') || '';

    const search = c.req.query('search') || '';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getAuditLogsImpl(
      db,
      { auditLogs: schema.auditLogs },
      {
        page,
        pageSize,
        module,
        action,
        staffId,
        from,
        to,
        search
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== MOVIES (Batch 2) =====================================
// ============================================================

adminRouter.post('/api/admin/movies', requireStaffAuth, requirePermission('movies', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,

      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,

      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };

    const cloud = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createMovieImpl(
      db,

      { movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      undefined,

      undefined,

      cloud.uploader,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    const status = (r as any)?.status === 'error' ? 400 : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.put('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,

      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,

      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };

    const { uploader: localUploader, deleter: localDeleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await updateMovieImpl(
      db,

      { movies: schema.movies, ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },

      id,

      body as any,

      undefined,

      c.env,

      localUploader,

      localDeleter,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err: any) {
    console.error('[PUT /api/admin/movies/:id] Error:', err?.message || err, err?.stack);

    const msg = err?.message || 'Lỗi máy chủ nội bộ';

    // Ưu tiên dùng statusCode từ error object nếu có (ví dụ conflict packages = 400)

    const statusCode = err?.statusCode || (msg.includes('Không thể') || msg.includes('đang được sử dụng') ? 400 : 500);

    return c.json({ status: 'error', message: msg }, statusCode);
  }
});

adminRouter.post(
  '/api/admin/movies-status/:id',
  requireStaffAuth,
  requirePermission('movies', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const body: any = await c.req.json().catch(() => ({}));

      const is_active = body.is_active !== undefined ? body.is_active : false;

      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await updateMovieStatusImpl(
        db,
        { movies: schema.movies, ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        is_active,
        c.env,
        getRestrictBranchIds(c),
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

      const payload = {
        ...(r as any),

        status: status >= 400 ? 'error' : 'success'
      };

      // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

      return c.json(payload, status);
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Lỗi máy chủ nội bộ' }), {
        status: 500,

        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);

adminRouter.delete('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const { deleter: localDeleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await deleteMovieImpl(
      db,
      { movies: schema.movies, auditLogs: schema.auditLogs, ticket_packages: schema.ticket_packages },
      id,
      c.env,
      localDeleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.post(
  '/api/admin/movies/:id/restore',
  requireStaffAuth,
  requirePermission('movies', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await restoreMovieImpl(db, { movies: schema.movies, auditLogs: schema.auditLogs }, id, {
        id: staffId,
        email: staffEmail,
        fullname: staffFullname
      });

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

adminRouter.get(
  '/api/admin/deleted/movies',
  requireStaffAuth,
  requirePermission('movies', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('search') || '');
      const branch_id = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : null;
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedMoviesImpl(
        db,
        { movies: schema.movies, staffs: schema.staffs },
        { page, pageSize, search, branch_id, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200);
    } catch (err) {
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
    }
  }
);

// ============================================================
// ===== SHOWTIMES (Batch 3) ==================================
// ============================================================

adminRouter.get('/api/admin/showtimes', requireStaffAuth, requirePermission('showtimes', 'view'), async (c) => {
  try {
    const branchId = Number(c.req.query('branch_id') || 0);
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listShowtimesImpl(
      db,
      { showtimes: schema.showtimes, movies: schema.movies },
      branchId,
      getRestrictBranchIds(c)
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

adminRouter.post('/api/admin/showtimes', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await createShowtimeImpl(
      db,
      {
        showtimes: schema.showtimes,
        movies: schema.movies,
        branches: schema.branches,
        auditLogs: schema.auditLogs
      },
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

adminRouter.post('/api/admin/showtimes/copy', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await copyShowtimesImpl(
      db,
      { showtimes: schema.showtimes, auditLogs: schema.auditLogs },
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

adminRouter.put('/api/admin/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await updateShowtimeImpl(
      db,
      { showtimes: schema.showtimes, movies: schema.movies, auditLogs: schema.auditLogs },
      id,
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

adminRouter.delete('/api/admin/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await deleteShowtimeImpl(
      db,
      { showtimes: schema.showtimes, auditLogs: schema.auditLogs },
      id,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// ============================================================
// ===== TOYS & TICKETS (Batch 4) =============================
// ============================================================

adminRouter.post('/api/admin/toys', requireStaffAuth, requirePermission('toys', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const { uploader } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createToyImpl(
      db,
      { toys: schema.toys, auditLogs: schema.auditLogs },
      body as any,
      c.env,
      uploader,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.put('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const { uploader, deleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateToyImpl(
      db,
      { toys: schema.toys, auditLogs: schema.auditLogs },
      id,
      body as any,
      c.env,
      uploader,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.delete('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const { deleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id, c.env, deleter, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.post('/api/admin/toys/:id/restore', requireStaffAuth, requirePermission('toys', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

adminRouter.get('/api/admin/deleted/toys', requireStaffAuth, requirePermission('toys', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedToysImpl(db, { toys: schema.toys }, { page, pageSize, search });

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.post('/api/admin/tickets', requireStaffAuth, requirePermission('tickets', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.put('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await updateTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      id,

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err: any) {
    console.error('Error updating ticket package:', err);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.delete('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await deleteTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, bookings: schema.bookings, auditLogs: schema.auditLogs },

      id,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.post(
  '/api/admin/tickets/:id/restore',
  requireStaffAuth,
  requirePermission('tickets', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await restoreTicketPackageImpl(
        db,
        { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

adminRouter.get(
  '/api/admin/deleted/tickets',
  requireStaffAuth,
  requirePermission('tickets', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('search') || '');
      const branch_id = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : null;
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedTicketPackagesImpl(
        db,
        { ticket_packages: schema.ticket_packages, staffs: schema.staffs },
        { page, pageSize, search, branch_id, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200);
    } catch (err) {
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
    }
  }
);

adminRouter.post(
  '/api/admin/tickets/:id/toggle-status',
  requireStaffAuth,
  requirePermission('tickets', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleTicketStatusImpl(
        db,
        { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        c.env,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

// ============================================================
// ===== BRANCHES (Batch 5) ===================================
// ============================================================

adminRouter.get('/api/admin/branches/options', requireStaffAuth, async (c) => {
  try {
    const includeInactive = c.req.query('includeInactive') === 'true';
    const onlyOpen = c.req.query('onlyOpen') === 'true';
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive, onlyOpen, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 10);

    const q = String(c.req.query('q') || '');

    const includeInactive = c.req.query('includeInactive') === 'true';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchesImpl(
      db,
      {
        branches: schema.branches,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        bookings: schema.bookings
      },
      { page, pageSize, q, includeInactive }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id);

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, body, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json({ status: 'success', branch: r.item });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Update branch

adminRouter.put('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateBranchImpl(
      db,
      { branches: schema.branches, auditLogs: schema.auditLogs, bookings: schema.bookings },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ status: 'success', branch: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Delete branch

adminRouter.delete('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteBranchImpl(
      db,
      {
        branches: schema.branches,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        bookings: schema.bookings,
        staff_branches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ status: 'success', message: 'Đã xóa chi nhánh' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post(
  '/api/admin/branches/:id/toggle-status',
  requireStaffAuth,
  requirePermission('branches', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleBranchStatusImpl(
        db,
        {
          branches: schema.branches,
          auditLogs: schema.auditLogs,
          staff_branches: schema.staffBranches
        },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

adminRouter.post(
  '/api/admin/branches/:id/toggle-open',
  requireStaffAuth,
  requirePermission('branches', 'edit'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleBranchOpenImpl(
        db,
        {
          branches: schema.branches,
          auditLogs: schema.auditLogs,
          bookings: schema.bookings
        },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

adminRouter.post(
  '/api/admin/branches/:id/restore',
  requireStaffAuth,
  requirePermission('branches', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await restoreBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id, {
        id: staffId,
        email: staffEmail,
        fullname: staffFullname
      });

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

adminRouter.get(
  '/api/admin/deleted/branches',
  requireStaffAuth,
  requirePermission('branches', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('search') || '');

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedBranchesImpl(
        db,
        { branches: schema.branches, staffs: schema.staffs },
        { page, pageSize, search }
      );

      return c.json(r, 200);
    } catch (err) {
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
    }
  }
);

// ============================================================
// ===== STAFF & ROLES (Batch 6) ==============================
// ============================================================

adminRouter.get('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const q = c.req.query('q') || '';
    const includeInactive = c.req.query('includeInactive') === 'true';
    const roleId = c.req.query('roleId') ? Number(c.req.query('roleId')) : undefined;
    const branchId = c.req.query('branchId') ? Number(c.req.query('branchId')) : undefined;

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listStaffImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches
      },
      { page, pageSize, q, includeInactive, roleId, branchId }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/staff/:id - Get staff by ID

adminRouter.get('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getStaffByIdImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches
      },
      id
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff - Create staff

adminRouter.post('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffMailer = getMailer(c);

    const r = await createStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        email_logs: schema.email_logs,
        auditLogs: schema.auditLogs
      },
      null,
      body,
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) },
      staffMailer
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/staff/:id - Update staff

adminRouter.put('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await updateStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      null,
      id,
      body,
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/staff/:id - Delete staff

adminRouter.delete('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff/:id/restore
adminRouter.post('/api/admin/staff/:id/restore', requireStaffAuth, requirePermission('staff', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/staff
adminRouter.get('/api/admin/deleted/staff', requireStaffAuth, requirePermission('staff', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedStaffImpl(db, { staffs: schema.staffs }, { page, pageSize, search });

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// POST /api/admin/staff/:id/reset-password - Reset staff password

adminRouter.post(
  '/api/admin/staff/:id/reset-password',
  requireStaffAuth,
  requirePermission('staff', 'reset_password'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const body = await c.req.json().catch(() => ({}));

      const db = drizzle(c.env.cinema_db, { schema });

      const staffMailer = getMailer(c);

      const r = await resetStaffPasswordImpl(
        db,
        {
          staffs: schema.staffs,
          staffTokens: schema.staffTokens,
          email_logs: schema.email_logs,
          auditLogs: schema.auditLogs
        },
        null,
        id,
        body,
        c.env,
        { waitUntil: (p) => c.executionCtx.waitUntil(p) },
        staffMailer
      );

      if (r.status === 'error') return c.json(r, 400);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

adminRouter.get('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');
    const pageSize = Number(c.req.query('pageSize') || '100');
    const q = c.req.query('q') || '';
    const isSystemParam = c.req.query('isSystem');
    const isSystem = isSystemParam === 'true' ? true : isSystemParam === 'false' ? false : undefined;

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listRolesImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions
      },
      { page, pageSize, q, isSystem }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/roles/:id - Get role by ID

adminRouter.get('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getRoleByIdImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions,

        auditLogs: schema.auditLogs
      },
      id
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles - Create role

adminRouter.post('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/roles/:id - Update role

adminRouter.put('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const isSuperAdmin = Boolean(c.get('isSuperAdmin'));

    const r = await updateRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname, isSuperAdmin }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/roles/:id - Delete role

adminRouter.delete('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await deleteRoleImpl(
      db,
      {
        roles: schema.roles,

        staffRoles: schema.staffRoles,

        auditLogs: schema.auditLogs
      },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles/:id/restore
adminRouter.post('/api/admin/roles/:id/restore', requireStaffAuth, requirePermission('roles', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreRoleImpl(db, { roles: schema.roles, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/roles
adminRouter.get('/api/admin/deleted/roles', requireStaffAuth, requirePermission('roles', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedRolesImpl(
      db,
      { roles: schema.roles, staffs: schema.staffs },
      { page, pageSize, search }
    );

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.get('/api/admin/permissions', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPermissionsImpl(db, { permissions: schema.permissions });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== VOUCHERS (Batch 7) ===================================
// ============================================================

adminRouter.get('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const scope = c.req.query('scope') || '';
    const is_active = c.req.query('is_active');
    const sale_staff_id = c.req.query('sale_staff_id');
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listVouchersImpl(
      db,
      { vouchers: schema.vouchers, voucher_redemption_logs: schema.voucher_redemption_logs },
      { page, pageSize, q, scope, is_active, sale_staff_id, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// GET /api/admin/vouchers/:id - Get voucher detail
adminRouter.get('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getVoucherImpl(
      db,
      {
        vouchers: schema.vouchers,
        auditLogs: schema.auditLogs,
        voucher_redemption_logs: schema.voucher_redemption_logs
      },
      id,
      restrictBranchIds
    );

    if (!r) return c.json({ message: 'Voucher không tồn tại' }, 404 as any);
    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// POST /api/admin/vouchers - Create new voucher
adminRouter.post('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createVoucherImpl(db, { vouchers: schema.vouchers, auditLogs: schema.auditLogs }, body, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 201 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// PUT /api/admin/vouchers/:id - Update voucher
adminRouter.put('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateVoucherImpl(
      db,
      { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

// POST /api/admin/vouchers/:id/toggle-status - Toggle active status
adminRouter.post(
  '/api/admin/vouchers/:id/toggle-status',
  requireStaffAuth,
  requirePermission('vouchers', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const restrictBranchIds = getRestrictBranchIds(c);
      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleVoucherStatusImpl(
        db,
        { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      const errStatus = Number(err?.statusCode) || 500;
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
    }
  }
);

// DELETE /api/admin/vouchers/:id - Soft delete voucher
adminRouter.delete('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteVoucherImpl(
      db,
      { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Voucher không tồn tại' }, 404 as any);
    return c.json(r, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

// POST /api/admin/vouchers/:id/restore - Restore deleted voucher
adminRouter.post(
  '/api/admin/vouchers/:id/restore',
  requireStaffAuth,
  requirePermission('vouchers', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const restrictBranchIds = getRestrictBranchIds(c);
      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await restoreVoucherImpl(
        db,
        { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      const errStatus = Number(err?.statusCode) || 500;
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
    }
  }
);

// GET /api/admin/deleted/vouchers - List deleted vouchers (trash)
adminRouter.get(
  '/api/admin/deleted/vouchers',
  requireStaffAuth,
  requirePermission('vouchers', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('q') || c.req.query('search') || '');
      const scope = c.req.query('scope') || '';
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedVouchersImpl(
        db,
        { vouchers: schema.vouchers },
        { page, pageSize, search, scope, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
    }
  }
);


adminRouter.all(
  '/api/admin/scheduled/trigger-booking-expiry',
  requireStaffAuth,
  requirePermission('settings', 'manage'),
  async (c) => {
    try {
      const db = drizzle(c.env.cinema_db, { schema });
      const result = await expireStaleBookingsImpl(db, {
        bookings: schema.bookings,
        vouchers: schema.vouchers
      });
      return c.json(
        {
          status: 'success',
          message: `Đã chạy cronjob dọn dẹp đơn quá hạn thành công.`,
          result
        },
        200 as any
      );
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
    }
  }
);

// ============================================================
// ===== UPLOADS & CLOUDINARY (Batch 8) =======================
// ============================================================

adminRouter.post('/api/admin/cloudinary/sign', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const env = c.env;

    if (!hasCloudinary(env)) return c.json({ message: 'Thiếu cấu hình Cloudinary' }, 400);

    const body = await c.req.json().catch(() => null);

    const folder = String(body?.folder || '');

    const resourceType = String(body?.resource_type || '');

    if (!folder || !resourceType) return c.json({ message: 'Thiếu tham số cần thiết' }, 400);

    const timestamp = Math.floor(Date.now() / 1000);

    const isVideo = resourceType === 'video';

    const params = {
      timestamp,

      folder,

      use_filename: 'true',

      unique_filename: 'false',

      overwrite: 'true',

      ...(isVideo
        ? { allowed_formats: 'mp4,webm,mov', max_bytes: 104857600 } // 100MB for video
        : { allowed_formats: 'jpg,jpeg,png,webp,gif', max_bytes: 5242880 }) // 5MB for images
    } as Record<string, string | number>;

    const signed = await cloudinarySignedParams(env, params);

    return c.json({
      timestamp,

      signature: signed.signature,

      api_key: signed.api_key
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/uploads/video', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const formData = await c.req.formData();

    const file = formData.get('file');

    const folderParam = formData.get('folder');

    // Compatibility check: if parseBody was used before, we switch to formData for consistency with file uploads

    if (!file || !(file instanceof File)) {
      return c.json({ message: 'Thiếu tệp video' }, 400);
    }

    const mime = String(file.type || 'application/octet-stream').toLowerCase();

    if (!mime.startsWith('video/')) return c.json({ message: 'Chỉ chấp nhận tệp video' }, 400);

    const env = c.env;

    if (hasCloudinary(env)) {
      const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');

      const timestamp = Math.floor(Date.now() / 1000);

      // Determine folder with clean overwrite logic

      let folder = String(env.CLOUDINARY_UPLOAD_FOLDER || 'ctbooking/videos');

      if (folderParam) {
        const safeFolder = String(folderParam).replace(/[^a-zA-Z0-9._-]/g, '_');

        folder = `ctbooking/videos/${safeFolder}`;
      }

      const params = {
        timestamp,

        folder,

        use_filename: 'true',

        unique_filename: 'false',

        overwrite: 'true',

        eager: 'q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264',

        eager_async: 'true'
      };

      const signed = await cloudinarySignedParams(env, params);

      const cf = new FormData();

      cf.append('file', file);

      cf.append('folder', folder);

      cf.append('use_filename', 'true');

      cf.append('unique_filename', 'false');

      cf.append('overwrite', 'true');

      cf.append('timestamp', String(timestamp));

      cf.append('api_key', signed.api_key);

      cf.append('signature', signed.signature);

      cf.append('eager', 'q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264');

      cf.append('eager_async', 'true');

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

      const resp = await fetch(endpoint, { method: 'POST', body: cf });

      const data: any = await resp.json().catch(() => ({}));

      if (!resp.ok)
        return c.json(
          {
            message: String(data?.error?.message || `Cloudinary ${resp.status}`)
          },

          500
        );

      return c.json({
        public_id: String(data.public_id || ''),

        url: String(data.secure_url || data.url || ''),

        bytes: Number(data.bytes || file.size || 0),

        duration: typeof data.duration === 'number' ? data.duration : undefined,

        format: String(data.format || ''),

        width: typeof data.width === 'number' ? data.width : undefined,

        height: typeof data.height === 'number' ? data.height : undefined
      });
    }

    if (!env.r2_cinemastore) return c.json({ message: 'Thiếu R2 bucket hoặc Cloudinary' }, 500);

    const ext = (() => {
      const e = (file.name || '').split('.').pop()?.toLowerCase() || '';

      if (e) return e;

      if (mime.includes('mp4')) return 'mp4';

      if (mime.includes('webm')) return 'webm';

      if (mime.includes('mov')) return 'mov';

      return 'bin';
    })();

    const key = `uploads/videos/video_${Date.now()}.${ext}`;

    const arr = new Uint8Array(await file.arrayBuffer());

    await env.r2_cinemastore.put(key, arr, {
      httpMetadata: { contentType: mime }
    });

    return c.json({
      public_id: key,

      url: `/${key}`,

      bytes: Number(file.size || arr.byteLength || 0),

      format: ext
    });
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Upload error') }, 500);
  }
});

adminRouter.post('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);
    const r = await createSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      body as any,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.put('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);
    const r = await updateSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      body as any,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    const status = (r as any)?.item ? 200 : 404;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload as any, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

adminRouter.delete('/api/admin/site-media/:id', requireStaffAuth, requirePermission('uploads', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);

    const r = await deleteSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      id,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Manual deletion from cloud storage for Worker environment

    if (r.ok && r.item && r.item.public_id) {
      const env = c.env;

      const publicId = String(r.item.public_id);

      // Try R2

      if (env.r2_cinemastore) {
        try {
          await env.r2_cinemastore.delete(publicId);
        } catch {}
      }

      // Try Cloudinary (manual fetch because SDK might not work in Worker or env missing in shared code)

      if (hasCloudinary(env)) {
        try {
          const type = r.item.type === 'video' ? 'video' : 'image';

          const timestamp = Math.floor(Date.now() / 1000);

          const params = { public_id: publicId, timestamp };

          const signed = await cloudinarySignedParams(env, params);

          const fd = new FormData();

          fd.append('public_id', publicId);

          fd.append('timestamp', String(timestamp));

          fd.append('api_key', signed.api_key);

          fd.append('signature', signed.signature);

          const cloudName = env.CLOUDINARY_CLOUD_NAME;

          const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;

          await fetch(endpoint, { method: 'POST', body: fd });
        } catch {}
      }
    }

    const status = (r as any)?.ok ? 200 : 404;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload as any, status);
  } catch (err: any) {
    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// ============================================================
// ===== POSTS ENDPOINTS (Admin) ==============================
// ============================================================

adminRouter.get('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPostsImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      { page, pageSize, q, status }
    );

    const parsedItems = (r.items || []).map((p: any) => ({
      ...p,
      cover_image: parseMediaUrl(p.cover_image, c)
    }));

    return c.json({ ...r, items: parsedItems });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const id = c.req.param('id');

    const db = drizzle(c.env.cinema_db, { schema });

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id, false);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    const parsed = {
      ...post,

      cover_image: parseMediaUrl(post.cover_image, c)
    };

    return c.json({ post: parsed }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.post('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createPostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      body,
      c.env,
      getCloudHelpers(c, c.env).uploader,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r && r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Update post

adminRouter.put('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const helpers = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updatePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      body,
      c.env,
      helpers.uploader,
      helpers.deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    if (r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Delete post

adminRouter.delete('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const isSuperAdmin = c.get('isSuperAdmin');

    const r = await deletePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      getCloudHelpers(c, c.env).deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      isSuperAdmin
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json({ status: 'success', message: isSuperAdmin ? 'Đã xóa vĩnh viễn' : 'Đã lưu trữ bài viết' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

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

// POST /api/admin/confirm-booking
adminRouter.post('/api/admin/confirm-booking', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    body = await c.req.json().catch(() => ({}));

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const r = await updatePaymentImpl(
      db,

      body as any,

      mailer,

      renderBooking,

      tables,

      c.executionCtx
    );

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('confirm-booking', err, body);

    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Ticket checking control system
adminRouter.get('/api/admin/bookings-code/:code', requireStaffAuth, requirePermission('ticket_check', 'scan'), async (c) => {
  // Rate Limit Check dùng KV

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const max = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_MAX) || 10;

  const windowMs = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS) || 60000;

  c.header('X-RateLimit-Limit', String(max));

  c.header('X-RateLimit-Remaining', String(max));

  c.header('X-RateLimit-WindowMS', String(windowMs));

  const db = drizzle(c.env.cinema_db, { schema });

  const tables = getD1Tables(schema);

  const code = String(c.req.param('code') || '');

  const r = await getBookingByCodeImpl(db, code, tables);

  const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status as any);
});

adminRouter.post('/api/admin/bookings-use', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });

  const tables = getD1Tables(schema);

  const body = await c.req.json().catch(() => ({}));

  const code = String((body as any)?.code || '');
  const allowExpired = Boolean((body as any)?.allow_expired);

  const restrictBranchIds = getRestrictBranchIds(c);
  const staffInfo = {
    id: c.get('staffId'),
    email: c.get('staffEmail'),
    fullname: c.get('staffFullname')
  };

  const r = await confirmUseTicketImpl(db, code, tables, restrictBranchIds, allowExpired, staffInfo);

  const status = (r as any)?.status === 'error' ? 400 : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status);
});

// ============================================================
// ===== PHASE 1: MISSING ADMIN GET ROUTES (Leak Fixed) =======
// ============================================================

adminRouter.get('/api/admin/toys', requireStaffAuth, requirePermission('toys', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listToysImpl(db, { toys: schema.toys }, { page, pageSize, q, status });
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const toy = await getToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id);
    if (!toy) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json({ toy }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/tickets', requireStaffAuth, requirePermission('tickets', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const includeInactive = c.req.query('includeInactive') === 'true';
    const typeRaw = c.req.query('type') || 'all';
    const type = typeRaw === 'movie' || typeRaw === 'vr' ? typeRaw : 'all';
    
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);
    const branchIdRaw = c.req.query('branch_id');
    const branchId = branchIdRaw && branchIdRaw !== 'all' ? Number(branchIdRaw) : undefined;

    const r = await listTicketPackagesImpl(
      db,
      { ticket_packages: schema.ticket_packages, movies: schema.movies },
      { page, pageSize, q, includeInactive, branch_id: branchId, restrictToBranchIds: restrictBranchIds, type }
    );
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
      id,
      restrictBranchIds
    );
    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'view'), async (c) => {
  try {
    const section = String(c.req.query('section') || '');
    const type = String(c.req.query('type') || '');
    const active = String(c.req.query('active') || '');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listSiteMediaImpl(db, { site_media: schema.site_media }, { section, type, active });
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

adminRouter.get('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getMovieByIdImpl(
      db,
      {
        movies: schema.movies,
        bookings: schema.bookings,
        ticket_packages: schema.ticket_packages,
        auditLogs: schema.auditLogs
      },
      id,
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy phim' }, 404);
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

export default adminRouter;
