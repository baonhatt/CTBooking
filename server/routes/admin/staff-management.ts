import { eq, and, or, like, isNull, isNotNull, desc, count, sql, aliasedTable, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateStrongPassword, hashPassword, invalidateStaffPermissionCache } from '../../lib/staff-auth';
import { canManageStaffTarget, type StaffScope } from '../../lib/branch-guard';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';

export async function listStaffImpl(
  db: any,
  tables: any,
  params: { page: number; pageSize: number; q?: string; includeInactive?: boolean; roleId?: number; branchId?: number; restrictToBranchIds?: number[] | null }
) {
  const { staffs, staffRoles, roles, staffBranches, branches } = tables;
  const { page = 1, pageSize = 20, q = '', includeInactive = false, roleId, branchId, restrictToBranchIds } = params;
  const offset = (page - 1) * pageSize;

  let query = db
    .select({
      id: staffs.id,
      email: staffs.email,
      fullname: staffs.fullname,
      phone: staffs.phone,
      avatar: staffs.avatar,
      isSuperAdmin: staffs.isSuperAdmin,
      isActive: staffs.isActive,
      forcePasswordChange: staffs.forcePasswordChange,
      lastLoginAt: staffs.lastLoginAt,
      createdAt: staffs.createdAt,
      updatedAt: staffs.updatedAt,
      roleCount: sql<number>`count(${staffRoles.roleId})`
    })
    .from(staffs)
    .leftJoin(staffRoles, eq(staffs.id, staffRoles.staffId))
    .groupBy(staffs.id)
    .orderBy(desc(staffs.createdAt))
    .limit(pageSize)
    .offset(offset);
  const conditions = [];
  
  if (includeInactive) {
    conditions.push(isNull(staffs.deletedAt));
  } else {
    conditions.push(and(eq(staffs.isActive, true), isNull(staffs.deletedAt)));
  }

  if (q) {
    conditions.push(sql`${staffs.email} LIKE ${'%' + q + '%'} OR ${staffs.fullname} LIKE ${'%' + q + '%'}`);
  }

  if (roleId) {
    conditions.push(eq(staffRoles.roleId, roleId));
  }

  if (branchId) {
    // Subquery condition for branch filtering without disrupting existing joins
    conditions.push(
      sql`${staffs.id} IN (SELECT staff_id FROM staff_branches WHERE branch_id = ${branchId})`
    );
  }

  // null = unrestricted (Super Admin). An empty list means the caller has no branch, so they see nobody.
  if (restrictToBranchIds && restrictToBranchIds.length === 0) {
    conditions.push(sql`1 = 0`);
  } else if (restrictToBranchIds) {
    // 1) Không cho phép xem Super Admin
    conditions.push(eq(staffs.isSuperAdmin, false));
    // 2) Chỉ được thấy những nhân viên thuộc các chi nhánh mà caller quản lý
    conditions.push(
      inArray(
        staffs.id,
        db.select({ staffId: staffBranches.staffId }).from(staffBranches).where(inArray(staffBranches.branchId, restrictToBranchIds))
      )
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const staffList = await query;

  const staffIds = staffList.map((s: any) => s.id);
  const staffWithDetails = staffList.map((s: any) => ({ ...s, roleIds: [], roles: [], branchIds: [], branchNames: [], branches: [] }));

  if (staffIds.length > 0) {
    const allRoles = await db
      .select({ staffId: staffRoles.staffId, roleId: staffRoles.roleId, roleName: roles.name })
      .from(staffRoles)
      .innerJoin(roles, eq(staffRoles.roleId, roles.id))
      .where(inArray(staffRoles.staffId, staffIds));

    const allBranches = await db
      .select({ staffId: staffBranches.staffId, branchId: staffBranches.branchId, branchName: branches.name })
      .from(staffBranches)
      .innerJoin(branches, eq(staffBranches.branchId, branches.id))
      .where(inArray(staffBranches.staffId, staffIds));

    const rolesByStaff = allRoles.reduce((acc: any, r: any) => {
      if (!acc[r.staffId]) acc[r.staffId] = [];
      acc[r.staffId].push(r);
      return acc;
    }, {});
    const branchesByStaff = allBranches.reduce((acc: any, b: any) => {
      if (!acc[b.staffId]) acc[b.staffId] = [];
      acc[b.staffId].push(b);
      return acc;
    }, {});

    staffWithDetails.forEach((s: any) => {
      const r = rolesByStaff[s.id] || [];
      const b = branchesByStaff[s.id] || [];
      s.roleIds = r.map((x: any) => x.roleId);
      s.roles = r.map((x: any) => x.roleName);
      s.branchIds = b.map((x: any) => x.branchId);
      s.branchNames = b.map((x: any) => x.branchName);
      s.branches = b.map((x: any) => ({ id: x.branchId, name: x.branchName }));
    });
  }

  let countQuery = db
    .select({ count: count(sql`DISTINCT ${staffs.id}`) })
    .from(staffs)
    .leftJoin(staffRoles, eq(staffs.id, staffRoles.staffId));

  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions));
  }

  const [totalResult] = await countQuery;

  return {
    items: staffWithDetails,
    total: totalResult?.count || 0,
    page,
    pageSize
  };
}

export async function getStaffByIdImpl(db: any, tables: any, id: number, caller?: StaffScope) {
  const { staffs, staffRoles, roles, staffBranches, branches, auditLogs } = tables;

  const [staffRow] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  if (!staffRow) {
    return { status: 'error', message: 'Staff not found' };
  }

  // The password hash must never leave the server
  const { password: _passwordHash, ...staff } = staffRow;

  // Outside the caller's scope the reply is the same as for a missing staff member, so existence is not revealed
  if (caller && !caller.isSuperAdmin) {
    const targetBranchRows = await db
      .select({ branchId: staffBranches.branchId })
      .from(staffBranches)
      .where(eq(staffBranches.staffId, id));
    const targetBranchIds = targetBranchRows.map((row: any) => row.branchId);
    if (staff.deletedAt || !canManageStaffTarget(caller, staff, targetBranchIds, 'view')) {
      return { status: 'error', message: 'Staff not found' };
    }
  }

  const roleData = await db
    .select({ roleId: staffRoles.roleId, roleName: roles.name })
    .from(staffRoles)
    .innerJoin(roles, eq(staffRoles.roleId, roles.id))
    .where(eq(staffRoles.staffId, id));

  const branchData = await db
    .select({ branchId: staffBranches.branchId, branchName: branches.name })
    .from(staffBranches)
    .innerJoin(branches, eq(staffBranches.branchId, branches.id))
    .where(eq(staffBranches.staffId, id));

  // Get tracking data from audit logs (skipped when the caller did not pass the audit table)
  let createLog: any;
  let updateLog: any;
  if (auditLogs) {
    [createLog] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'staff'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'create')))
      .orderBy(auditLogs.createdAt)
      .limit(1);

    [updateLog] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'staff'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'update')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
  }

  return {
    status: 'success',
    staff: {
      ...staff,
      created_by_staff_name: createLog?.staffFullname || null,
      updated_by_staff_name: updateLog?.staffFullname || null,
      roles: roleData.map((r) => ({ id: r.roleId, name: r.roleName })),
      branches: branchData.map((b) => ({ id: b.branchId, name: b.branchName }))
    }
  };
}

export async function createStaffImpl(
  db: any,
  tables: any,
  kv: any,
  body: {
    email: string;
    fullname: string;
    phone?: string;
    avatar?: string;
    roleIds?: number[];
    branchIds?: number[];
  },
  caller?: { isSuperAdmin?: boolean; branchIds?: number[]; id?: number; email?: string; fullname?: string }
) {
  const { staffs, staffRoles, staffBranches } = tables;
  const { email, fullname, phone, avatar, roleIds = [], branchIds = [] } = body;
  const callerBranchIds = caller?.branchIds || [];
  const callerIsSuperAdmin = !!caller?.isSuperAdmin;
  const now = new Date().toISOString();

  // Check if email already exists in staffs
  const [existingStaff] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
  if (existingStaff && !existingStaff.deletedAt) {
    return { status: 'error', message: 'Email đã tồn tại trong danh sách nhân viên đang hoạt động' };
  }

  // Reactivating a deleted account overwrites its password, roles and branches, so only the Super Admin may do it
  if (existingStaff && existingStaff.deletedAt && !callerIsSuperAdmin) {
    return {
      status: 'error',
      code: 'forbidden',
      message: 'Email này thuộc một nhân viên đã bị xóa. Chỉ Super Admin mới được kích hoạt lại tài khoản đó.'
    };
  }

  // Check if email already exists in accounts (Users)
  const { accounts } = await import('../../../shared/schema');
  const [existingUser] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existingUser) {
    return {
      status: 'error',
      message: 'Email này đang được sử dụng bởi một tài khoản khách hàng. Vui lòng dùng email khác.'
    };
  }

  if (!callerIsSuperAdmin) {
    if (roleIds.length > 0) {
      return { status: 'error', message: 'Chỉ Super Admin mới được gán role cho nhân viên' };
    }

    if (branchIds.length > 0) {
      const invalidBranch = branchIds.some((branchId) => !callerBranchIds.includes(branchId));
      if (invalidBranch) {
        return { status: 'error', message: 'Không được gán nhân viên cho chi nhánh ngoài phạm vi quản lý' };
      }
    }
  }

  // The password is always generated here and shown once to the person creating the account.
  // It is not emailed (staff emails are placeholders) and never written to a log.
  const generatedPassword = generateStrongPassword();
  const hashedPassword = await hashPassword(generatedPassword);

  let targetStaffId: number;

  if (existingStaff && existingStaff.deletedAt) {
    // Reactivate soft-deleted staff
    targetStaffId = existingStaff.id;
    await db
      .update(staffs)
      .set({
        password: hashedPassword,
        fullname,
        phone: phone || null,
        avatar: avatar || null,
        isSuperAdmin: false,
        isActive: true,
        deletedAt: null,
        deleted_by_staff_id: null,
        forcePasswordChange: true,
        updatedAt: now
      })
      .where(eq(staffs.id, targetStaffId));

    // Clean old roles and branches
    await db.delete(staffRoles).where(eq(staffRoles.staffId, targetStaffId));
    await db.delete(staffBranches).where(eq(staffBranches.staffId, targetStaffId));
    await invalidateStaffPermissionCache(kv, targetStaffId);
  } else {
    // Create brand new staff
    const [newStaff] = await db
      .insert(staffs)
      .values({
        email,
        password: hashedPassword,
        fullname,
        phone,
        avatar,
        isSuperAdmin: false,
        isActive: true,
        forcePasswordChange: true,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    targetStaffId = newStaff.id;
  }

  // Assign roles
  for (const roleId of roleIds) {
    await db.insert(staffRoles).values({
      staffId: targetStaffId,
      roleId
    });
  }

  // Assign branches
  for (const branchId of branchIds) {
    await db.insert(staffBranches).values({
      staffId: targetStaffId,
      branchId
    });
  }

  const [finalStaff] = await db.select().from(staffs).where(eq(staffs.id, targetStaffId)).limit(1);
  const auditNew = buildAuditPayload(finalStaff, 'staff', { roleIds, branchIds });

  // Log audit action
  await logAuditAction(
    db,
    tables.auditLogs,
    existingStaff?.deletedAt ? 'restore' : 'create',
    'staff',
    targetStaffId,
    `${existingStaff?.deletedAt ? 'Tạo lại (kích hoạt)' : 'Tạo'} nhân viên: ${fullname} (${email})`,
    caller?.id || null,
    caller?.email || email,
    caller?.fullname || fullname,
    undefined,
    auditNew
  );

  return {
    status: 'success',
    message: 'Đã tạo nhân viên thành công',
    staff: {
      id: targetStaffId,
      email: email,
      fullname: fullname
    },
    // Shown once on screen. Not stored anywhere readable.
    generated_password: generatedPassword
  };
}

const OUT_OF_SCOPE_MESSAGE =
  'Bạn chỉ được thao tác trên nhân viên làm việc duy nhất tại chi nhánh của mình. Nhân viên thuộc nhiều chi nhánh chỉ Super Admin được thao tác.';

async function loadStaffBranchIds(db: any, staffBranches: any, staffId: number): Promise<number[]> {
  const rows = await db
    .select({ branchId: staffBranches.branchId })
    .from(staffBranches)
    .where(eq(staffBranches.staffId, staffId));
  return rows.map((row: any) => row.branchId);
}

export async function updateStaffImpl(
  db: any,
  tables: any,
  kv: any,
  id: number,
  body: {
    email?: string;
    fullname?: string;
    phone?: string;
    avatar?: string;
    isActive?: boolean;
    roleIds?: number[];
    branchIds?: number[];
    forcePasswordChange?: boolean;
  },
  caller?: { isSuperAdmin?: boolean; branchIds?: number[]; id?: number; email?: string; fullname?: string }
) {
  const { staffs, staffRoles, staffBranches } = tables;
  const { email, fullname, phone, avatar, isActive, roleIds, branchIds, forcePasswordChange } = body;
  const callerBranchIds = caller?.branchIds || [];
  const callerIsSuperAdmin = !!caller?.isSuperAdmin;
  const now = new Date().toISOString();

  // Check if staff exists
  const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  if (!existing) {
    return { status: 'error', message: 'Staff not found' };
  }

  // Cannot modify super admin
  if (existing.isSuperAdmin) {
    return { status: 'error', message: 'Không thể sửa super admin' };
  }

  if (existing.deletedAt) {
    return { status: 'error', message: 'Nhân viên đã bị xóa. Hãy khôi phục trước khi sửa.' };
  }

  const oldBranchIds = await loadStaffBranchIds(db, staffBranches, id);

  if (!callerIsSuperAdmin) {
    if (!canManageStaffTarget({ isSuperAdmin: false, branchIds: callerBranchIds }, existing, oldBranchIds, 'modify')) {
      return { status: 'error', code: 'forbidden', message: OUT_OF_SCOPE_MESSAGE };
    }

    if ((body as any).isSuperAdmin !== undefined) {
      return { status: 'error', message: 'Chỉ Super Admin mới được thay đổi quyền Super Admin' };
    }

    if (roleIds !== undefined) {
      return { status: 'error', message: 'Chỉ Super Admin mới được thay đổi role của nhân viên' };
    }

    // Changing someone else's email would let the caller take the account over through a password reset
    if (email !== undefined && email !== existing.email) {
      return { status: 'error', message: 'Chỉ Super Admin mới được đổi email nhân viên' };
    }

    if (branchIds !== undefined) {
      const invalidBranch = branchIds.some((branchId) => !callerBranchIds.includes(branchId));
      if (invalidBranch) {
        return { status: 'error', message: 'Không được gán nhân viên cho chi nhánh ngoài phạm vi quản lý' };
      }
    }
  }

  if (isActive === false && caller?.id === id) {
    return { status: 'error', message: 'Không thể tự khóa tài khoản của chính mình' };
  }

  // Check email uniqueness if changing email
  if (email && email !== existing.email) {
    const [emailCheck] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
    if (emailCheck) {
      return { status: 'error', message: 'Email đã tồn tại trong danh sách nhân viên' };
    }

    // Check in accounts table
    const { accounts } = await import('../../../shared/schema');
    const [userCheck] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (userCheck) {
      return { status: 'error', message: 'Email này đang được sử dụng bởi một tài khoản khách hàng.' };
    }
  }

  const oldRoles = await db.select({ roleId: staffRoles.roleId }).from(staffRoles).where(eq(staffRoles.staffId, id));

  const auditOld = buildAuditPayload(existing, 'staff', {
    roleIds: oldRoles.map((r) => r.roleId),
    branchIds: oldBranchIds
  });

  // Update staff
  const updateData: any = { updatedAt: now };
  if (email) updateData.email = email;
  if (fullname) updateData.fullname = fullname;
  if (phone !== undefined) updateData.phone = phone;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange;
  if (callerIsSuperAdmin && (body as any).isSuperAdmin !== undefined) {
    updateData.isSuperAdmin = Boolean((body as any).isSuperAdmin);
  }

  await db.update(staffs).set(updateData).where(eq(staffs.id, id));

  // Update roles if provided
  if (roleIds !== undefined) {
    await db.delete(staffRoles).where(eq(staffRoles.staffId, id));
    for (const roleId of roleIds) {
      await db.insert(staffRoles).values({ staffId: id, roleId });
    }
  }

  // Update branches if provided
  if (branchIds !== undefined) {
    await db.delete(staffBranches).where(eq(staffBranches.staffId, id));
    for (const branchId of branchIds) {
      await db.insert(staffBranches).values({ staffId: id, branchId });
    }
  }

  // Invalidate permission cache
  await invalidateStaffPermissionCache(kv, id);

  const [updatedStaff] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  const newRoles = await db.select({ roleId: staffRoles.roleId }).from(staffRoles).where(eq(staffRoles.staffId, id));
  const newBranchIds = await loadStaffBranchIds(db, staffBranches, id);

  const auditNew = buildAuditPayload(updatedStaff, 'staff', {
    roleIds: newRoles.map((r) => r.roleId),
    branchIds: newBranchIds
  });

  // Log audit action
  await logAuditAction(
    db,
    tables.auditLogs,
    'update',
    'staff',
    id,
    `Cập nhật nhân viên: ${existing.fullname} (${existing.email})`,
    caller?.id || null,
    caller?.email || existing.email,
    caller?.fullname || existing.fullname,
    auditOld,
    auditNew
  );

  return {
    status: 'success',
    message: 'Đã cập nhật nhân viên thành công'
  };
}

export async function deleteStaffImpl(
  db: any,
  tables: any,
  id: number,
  caller?: { id?: number; email?: string; fullname?: string; isSuperAdmin?: boolean; branchIds?: number[] }
) {
  const { staffs, staffBranches } = tables;

  // Check if staff exists
  const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  if (!existing) {
    return { status: 'error', message: 'Staff not found' };
  }

  // Cannot delete super admin
  if (existing.isSuperAdmin) {
    return { status: 'error', message: 'Không thể xóa super admin' };
  }

  if (existing.deletedAt) {
    return { status: 'error', message: 'Nhân viên này đã bị xóa trước đó' };
  }

  if (caller?.id === id) {
    return { status: 'error', message: 'Không thể tự xóa tài khoản của chính mình' };
  }

  if (!caller?.isSuperAdmin) {
    const targetBranchIds = await loadStaffBranchIds(db, staffBranches, id);
    if (!canManageStaffTarget(caller || {}, existing, targetBranchIds, 'modify')) {
      return { status: 'error', code: 'forbidden', message: OUT_OF_SCOPE_MESSAGE };
    }
  }

  const deletionTimestamp = new Date().toISOString();

  // Soft delete by setting isActive to false and deleted_at
  await db
    .update(staffs)
    .set({ isActive: false, deletedAt: deletionTimestamp, deleted_by_staff_id: caller?.id })
    .where(eq(staffs.id, id));

  const auditOld = buildAuditPayload(existing, 'staff');
  const auditNew = buildAuditPayload(
    {
      ...existing,
      isActive: false,
      deletedAt: deletionTimestamp,
      deleted_by_staff_id: caller?.id
    },
    'staff'
  );

  // Log audit action
  await logAuditAction(
    db,
    tables.auditLogs,
    'delete',
    'staff',
    id,
    `Xóa nhân viên: ${existing.fullname} (${existing.email})`,
    caller?.id || null,
    caller?.email || existing.email,
    caller?.fullname || existing.fullname,
    auditOld,
    auditNew
  );

  return {
    status: 'success',
    message: 'Đã xóa nhân viên thành công'
  };
}

export async function restoreStaffImpl(
  db: any,
  tables: any,
  id: number,
  caller?: { id?: number; email?: string; fullname?: string; isSuperAdmin?: boolean; branchIds?: number[] }
) {
  const { staffs, staffBranches } = tables;

  const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  if (!existing) {
    return { status: 'error', message: 'Staff not found' };
  }

  // Only a staff member that is actually deleted can be restored
  if (!existing.deletedAt) {
    return { status: 'error', message: 'Nhân viên này chưa bị xóa' };
  }

  if (!caller?.isSuperAdmin) {
    const targetBranchIds = await loadStaffBranchIds(db, staffBranches, id);
    if (!canManageStaffTarget(caller || {}, existing, targetBranchIds, 'modify')) {
      return { status: 'error', code: 'forbidden', message: OUT_OF_SCOPE_MESSAGE };
    }
  }

  // Restore by setting isActive to true and deleted_at to null
  await db.update(staffs).set({ isActive: true, deletedAt: null }).where(eq(staffs.id, id));

  const auditOld = buildAuditPayload(existing, 'staff');
  const auditNew = buildAuditPayload({ ...existing, isActive: true, deletedAt: null }, 'staff');

  // Log audit action
  await logAuditAction(
    db,
    tables.auditLogs,
    'restore',
    'staff',
    id,
    `Restore nhân viên: ${existing.fullname} (${existing.email})`,
    caller?.id,
    caller?.email,
    caller?.fullname,
    auditOld,
    auditNew
  );

  return {
    status: 'success',
    message: 'Đã restore nhân viên thành công'
  };
}

export async function listDeletedStaffImpl(
  db: any,
  tables: any,
  options: { page?: number; pageSize?: number; search?: string } = {}
) {
  const { staffs } = tables;
  const { page = 1, pageSize = 10, search = '' } = options;

  const conditions = [];
  if (search) {
    conditions.push(or(like(staffs.fullname, `%${search}%`), like(staffs.email, `%${search}%`)));
  }
  conditions.push(isNotNull(staffs.deletedAt));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Self-join to get deleted_by staff info
  const staffsAlias = aliasedTable(staffs, 'deleted_by_staff');
  const query = db
    .select({
      id: staffs.id,
      email: staffs.email,
      fullname: staffs.fullname,
      phone: staffs.phone,
      isSuperAdmin: staffs.isSuperAdmin,
      deletedAt: staffs.deletedAt,
      deleted_by_staff_id: staffs.deleted_by_staff_id,
      deleted_by_staff_name: staffsAlias.fullname
    })
    .from(staffs)
    .leftJoin(staffsAlias, eq(staffs.deleted_by_staff_id, staffsAlias.id))
    .where(whereClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(desc(staffs.deletedAt));

  const items = await query;

  const [countResult] = await db.select({ count: count() }).from(staffs).where(whereClause);

  return {
    status: 'success',
    items,
    total: countResult?.count || 0,
    page,
    pageSize
  };
}

/**
 * Resets a staff member's password. Only the Super Admin may do this.
 * The new password is generated here and returned once, so the Super Admin can pass it on.
 * It is not emailed (staff emails are placeholders) and not written to any log. The staff member must change
 * it at the next login, and every session they have is revoked.
 */
export async function resetStaffPasswordImpl(
  db: any,
  tables: any,
  kv: any,
  id: number,
  caller?: { id?: number; email?: string; fullname?: string; isSuperAdmin?: boolean }
) {
  const { staffs, staffTokens } = tables;
  const now = new Date().toISOString();

  if (!caller?.isSuperAdmin) {
    return { status: 'error', code: 'forbidden', message: 'Chỉ Super Admin mới được đặt lại mật khẩu nhân viên' };
  }

  const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
  if (!existing) {
    return { status: 'error', message: 'Staff not found' };
  }

  if (existing.deletedAt) {
    return { status: 'error', message: 'Nhân viên đã bị xóa. Hãy khôi phục trước khi đặt lại mật khẩu.' };
  }

  if (caller.id === id) {
    return {
      status: 'error',
      message: 'Hãy dùng chức năng đổi mật khẩu trong Hồ sơ để đổi mật khẩu của chính bạn'
    };
  }

  const newPassword = generateStrongPassword();
  const hashedPassword = await hashPassword(newPassword);

  // Update password and force change on next login
  await db
    .update(staffs)
    .set({
      password: hashedPassword,
      forcePasswordChange: true,
      updatedAt: now
    })
    .where(eq(staffs.id, id));

  // Revoke all sessions
  await db
    .update(staffTokens)
    .set({ revokedAt: now, revokeReason: 'password_reset' })
    .where(and(eq(staffTokens.staffId, id), isNull(staffTokens.revokedAt)));

  // Invalidate permission cache
  await invalidateStaffPermissionCache(kv, id);

  const auditOld = buildAuditPayload(existing, 'staff');
  const auditNew = buildAuditPayload(
    {
      ...existing,
      forcePasswordChange: true,
      updatedAt: now
    },
    'staff'
  );

  // The audit entry names the Super Admin who did it, not the staff member who was reset
  await logAuditAction(
    db,
    tables.auditLogs,
    'reset_password',
    'staff',
    id,
    `Reset mật khẩu nhân viên: ${existing.fullname} (${existing.email})`,
    caller.id || null,
    caller.email,
    caller.fullname,
    auditOld,
    auditNew
  );

  return {
    status: 'success',
    message: 'Đã đặt lại mật khẩu. Hãy chuyển mật khẩu mới cho nhân viên, mật khẩu chỉ hiển thị một lần.',
    generated_password: newPassword
  };
}
