import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import {
  assertBranchesExist,
  assertStaffMayAssign,
  branchScopeStatements,
  readBranchScope,
  readScopeChange,
  readScopeInput,
  runBatch,
  sqlInStaffBranches,
  staffMayModify,
  withBranchScope,
  type BranchScope
} from '../../lib/catalog-scope';

/**
 * Cloudinary folders the admin screens upload into (lib/api/uploads.ts builds "ctbooking/images/<name>" or
 * "ctbooking/videos/<name>"). The sign route signs no other folder.
 */
export const CLOUDINARY_UPLOAD_SUBFOLDERS = [
  'hero_section',
  'technology_section1',
  'technology_section2',
  'posts',
  'vr_packages',
  'branch_banners'
];

/** True when the folder is one the admin screens use, under the root that matches the resource type. */
export function isAllowedUploadFolder(folder: string, resourceType: string): boolean {
  const root = resourceType === 'video' ? 'ctbooking/videos' : resourceType === 'image' ? 'ctbooking/images' : null;
  if (!root) return false;
  return CLOUDINARY_UPLOAD_SUBFOLDERS.some((name) => folder === `${root}/${name}`);
}

/**
 * Whether a staff member may change or delete a media row. Rows for all branches (every row the admin screens create
 * today) are for the Super Admin only; other staff only rows fully inside their branches.
 * restrictToBranchIds: null for the Super Admin.
 */
export function staffCanModifySiteMedia(scope: BranchScope | null, restrictToBranchIds: number[] | null): boolean {
  return staffMayModify(scope, restrictToBranchIds);
}

/** The branches of one media row, or null when the row does not exist. */
export async function findSiteMediaBranchIdsImpl(anyDb: any, _tables: { site_media: any }, id: number) {
  return readBranchScope(anyDb, 'media', Number(id));
}

export async function createSiteMediaImpl(
  anyDb: any,
  tables: { site_media: any; auditLogs: any },
  args: {
    section: string;
    type: string;
    title?: string;
    description?: string;
    public_id?: string;
    url: string;
    format?: string;
    width?: number;
    height?: number;
    duration?: string | number;
    display_order?: number;
    is_active?: boolean;
    all_branches?: boolean;
    branch_ids?: number[];
  },
  deleter?: (url: string, type?: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  // Where it is shown: the form must say so (every branch, or a list that may be empty); never assumed.
  // Staff of some branches add media for their own branches only.
  const mediaScope: BranchScope = readScopeInput(args);
  assertStaffMayAssign(mediaScope, restrictToBranchIds, 'ảnh/video');
  await assertBranchesExist(anyDb, mediaScope.branch_ids);
  const {
    section,
    type,
    title,
    description,
    public_id,
    url,
    format,
    width,
    height,
    duration,
    display_order,
    is_active
  } = args;

  // 1. Check for existing item with same section + public_id (or url)
  const conditions: any[] = [eq(tables.site_media.section, String(section))];
  if (public_id) conditions.push(eq(tables.site_media.public_id, String(public_id)));
  else conditions.push(eq(tables.site_media.url, String(url)));

  const existing = await anyDb.query.site_media.findFirst({
    where: and(...conditions)
  });

  if (existing) {
    // Upsert: the same file again updates the existing row, which keeps its own branches. Staff may only touch it
    // when it is fully theirs.
    if (!staffMayModify(await readBranchScope(anyDb, 'media', existing.id), restrictToBranchIds)) {
      throw Object.assign(new Error('Bạn không có quyền với media của chi nhánh khác hoặc media dùng chung'), { statusCode: 403 });
    }
    const { all_branches: _sentAll, branch_ids: _sentBranches, ...fileFields } = args;
    return updateSiteMediaImpl(
      anyDb,
      tables,
      {
        ...fileFields,
        id: existing.id,
        duration: args.duration !== undefined ? Number(args.duration) : undefined
      },
      deleter
    );
  }

  // 2. Insert new
  const nowIso = new Date();
  const inserted = await anyDb
    .insert(tables.site_media)
    .values({
      section: String(section),
      type: String(type),
      title: title ? String(title) : null,
      description: description ? String(description) : null,
      public_id: public_id ? String(public_id) : null,
      url: String(url),
      format: format ? String(format) : null,
      width: width !== undefined ? Number(width) : null,
      height: height !== undefined ? Number(height) : null,
      duration: duration !== undefined ? String(duration) : null,
      display_order: display_order !== undefined ? Number(display_order) : 0,
      is_active: typeof is_active === 'boolean' ? is_active : true,
      all_branches: mediaScope.all_branches,
      created_at: formatDateForDb(nowIso),
      updated_at: formatDateForDb(nowIso)
    })
    .returning();

  let item: any = Array.isArray(inserted) ? inserted[0] : inserted;
  // if (!item) {
  //   // Fallback for DBs without returning()
  //   item = await anyDb.query.site_media.findFirst({ orderBy: [desc(tables.site_media.id)] });
  // }

  if (!item) throw new Error('Không thể tạo site media');
  await runBatch(anyDb, await branchScopeStatements(anyDb, 'media', item.id, mediaScope));
  [item] = await withBranchScope(anyDb, 'media', [item]);

  const auditNew = buildAuditPayload(item);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'create',
      'site_media',
      item.id,
      `Tạo site media: ${title || type} (${section})`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      undefined,
      auditNew
    );
  }

  return { item };
}

export async function listSiteMediaImpl(
  anyDb: any,
  tables: { site_media: any },
  args: { section?: string; type?: string; active?: string; restrictToBranchIds?: number[] | null }
) {
  const { section, type, active } = args;
  const restrictToBranchIds = args.restrictToBranchIds ?? null;
  const conditions: any[] = [];
  // Staff of some branches see the media for all branches and the media of their branches
  if (restrictToBranchIds) conditions.push(sqlInStaffBranches('media', restrictToBranchIds));
  if (section) conditions.push(eq(tables.site_media.section, String(section)));
  if (type) conditions.push(eq(tables.site_media.type, String(type)));
  if (active)
    conditions.push(
      and(eq(tables.site_media.is_active, String(active) === 'true'), isNull(tables.site_media.deleted_at))
    );
  const items = await anyDb.query.site_media.findMany({
    where: and(...conditions),
    orderBy: [asc(tables.site_media.display_order), desc(tables.site_media.created_at)]
  });
  return { items: await withBranchScope(anyDb, 'media', items) };
}

/**
 * Whether saving points the row at a DIFFERENT stored file, so the old one can be deleted. The storage id (public_id)
 * decides: the same id means the file was overwritten in place (only the version in the url changed), and deleting
 * "the old file" would delete the new one. Rows without a storage id compare the url.
 */
export function isAssetReplaced(
  existing: { url?: string | null; public_id?: string | null },
  changes: { url?: string | null; public_id?: string | null }
): boolean {
  if (existing.public_id) {
    const newPublicId = changes.public_id === undefined ? existing.public_id : changes.public_id;
    return Boolean(newPublicId) && newPublicId !== existing.public_id;
  }
  return Boolean(existing.url && changes.url && changes.url !== existing.url);
}

export async function updateSiteMediaImpl(
  anyDb: any,
  tables: { site_media: any; auditLogs: any },
  args: {
    id: number;
    section?: string;
    type?: string;
    title?: string;
    description?: string;
    public_id?: string;
    url?: string;
    format?: string;
    width?: number;
    height?: number;
    duration?: number;
    display_order?: number;
    is_active?: boolean;
    all_branches?: boolean;
    branch_ids?: number[];
  },
  deleter?: (url: string, type?: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const {
    id,
    section,
    type,
    title,
    description,
    public_id,
    url,
    format,
    width,
    height,
    duration,
    display_order,
    is_active
  } = args;
  const now = new Date();
  const payload: any = { updated_at: formatDateForDb(now) };
  if (section !== undefined) payload.section = String(section);
  if (type !== undefined) payload.type = String(type);
  if (title !== undefined) payload.title = title ? String(title) : null;
  if (description !== undefined) payload.description = description ? String(description) : null;
  if (public_id !== undefined) payload.public_id = public_id ? String(public_id) : null;
  if (url !== undefined) payload.url = url ? String(url) : null;
  if (format !== undefined) payload.format = format ? String(format) : null;
  if (width !== undefined) payload.width = width !== null && width !== undefined ? Number(width) : null;
  if (height !== undefined) payload.height = height !== null && height !== undefined ? Number(height) : null;
  if (duration !== undefined) payload.duration = duration !== null && duration !== undefined ? String(duration) : null;
  if (display_order !== undefined)
    payload.display_order = display_order !== null && display_order !== undefined ? Number(display_order) : 0;
  if (is_active !== undefined) payload.is_active = Boolean(is_active);
  // Sent branch fields change where it is shown; fields not sent leave it as it is
  const newScope = readScopeChange(args);
  if (newScope) await assertBranchesExist(anyDb, newScope.branch_ids);
  const existing = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });

  // The row and its branches change together
  await runBatch(anyDb, [
    anyDb.update(tables.site_media).set(payload).where(eq(tables.site_media.id, Number(id))),
    ...(newScope ? await branchScopeStatements(anyDb, 'media', Number(id), newScope) : [])
  ]);
  const updatedRow = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });
  let item: any = updatedRow ? (await withBranchScope(anyDb, 'media', [updatedRow]))[0] : null;
  // if (!item) {
  //   item = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });
  // }

  if (existing && deleter && isAssetReplaced(existing, payload)) {
    const resourceType = existing.type === 'video' ? 'video' : 'image';
    deleter(existing.url, resourceType).catch((e) => console.error('Failed to delete old site media asset:', e));
  }

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload(item);

  // Log audit action
  if (staffInfo && item) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'site_media',
      id,
      `Cập nhật site media: ${title || type} (${section})`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { item, success: Boolean(item) };
}

export async function deleteSiteMediaImpl(
  anyDb: any,
  tables: { site_media: any; auditLogs: any },
  id: number,
  deleter?: (url: string, type?: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const existing = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });
  if (!existing) return { ok: false, message: 'Không tìm thấy media' };
  try {
    if (existing.url && deleter) {
      const resourceType = existing.type === 'video' ? 'video' : 'image';
      // We pass the URL here, letting the deleter decide how to handle it
      deleter(existing.url, resourceType).catch((e) => {});
    }
    // Delete site media (tương thích với D1/SQLite không hỗ trợ .returning())
    await anyDb.delete(tables.site_media).where(eq(tables.site_media.id, Number(id)));

    const auditOld = buildAuditPayload(existing);

    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'delete',
        'site_media',
        id,
        `Xóa site media: ${existing.title || existing.type} (${existing.section})`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname,
        auditOld,
        undefined
      );
    }

    return { ok: true, item: existing };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Xóa media thất bại' };
  }
}
// Replace all media for a section: Delete all existing -> Insert new
// REMOVED as redundant
