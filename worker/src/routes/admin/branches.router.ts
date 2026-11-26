import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

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
  listDeletedBranchesImpl,
  listAdminBranchOptionsImpl,
  listBranchUnusedCodesImpl
} from '../../../../server/routes/admin/branches';
import { clampPage } from '../../../../server/lib/paging';

/** True when the staff member may act on this branch: the Super Admin on any, other staff only on their own branches. */
export function staffHasBranch(c: Context, branchId: number): boolean {
  const restrictBranchIds = getRestrictBranchIds(c);
  return restrictBranchIds === null || restrictBranchIds.includes(branchId);
}

const OTHER_BRANCH_MESSAGE = 'Bạn không có quyền với chi nhánh này';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const branchesRouter = new Hono<{ Bindings: any; Variables: Variables }>();

branchesRouter.get('/api/admin/branches/options', requireStaffAuth, async (c) => {
  try {
    const includeInactive = c.req.query('includeInactive') === 'true';
    const onlyOpen = c.req.query('onlyOpen') === 'true';
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listAdminBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive, onlyOpen, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

branchesRouter.get('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });

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
      { page, pageSize, q, includeInactive, restrictToBranchIds: getRestrictBranchIds(c) }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Paid tickets of one branch never used: the close-branch dialog warns with their codes (read when it opens)
branchesRouter.get('/api/admin/branches/:id/unused-codes', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);
    if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listBranchUnusedCodesImpl(db, { bookings: schema.bookings }, id);
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

branchesRouter.get('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    // Another branch's record is answered like a missing one
    if (!staffHasBranch(c, id)) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id);

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

branchesRouter.post('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'create'), async (c) => {
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

branchesRouter.put('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);

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

branchesRouter.delete('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);

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

branchesRouter.post(
  '/api/admin/branches/:id/toggle-status',
  requireStaffAuth,
  requirePermission('branches', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);

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

branchesRouter.post(
  '/api/admin/branches/:id/toggle-open',
  requireStaffAuth,
  requirePermission('branches', 'edit'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);
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

branchesRouter.post(
  '/api/admin/branches/:id/restore',
  requireStaffAuth,
  requirePermission('branches', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      if (!staffHasBranch(c, id)) return c.json({ status: 'error', message: OTHER_BRANCH_MESSAGE }, 403);
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

branchesRouter.get(
  '/api/admin/deleted/branches',
  requireStaffAuth,
  requirePermission('branches', 'view_deleted'),
  async (c) => {
    try {
      const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });
      const search = String(c.req.query('search') || '');

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedBranchesImpl(
        db,
        { branches: schema.branches, staffs: schema.staffs },
        {
          page,
          pageSize,
          search,
          sort: String(c.req.query('sort') || ''),
          dir: String(c.req.query('dir') || ''),
          restrictToBranchIds: getRestrictBranchIds(c)
        }
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


export default branchesRouter;
