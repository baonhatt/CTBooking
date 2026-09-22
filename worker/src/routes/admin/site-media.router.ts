import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getCloudHelpers } from './admin-helpers';
import { hasCloudinary, parseMediaUrl, pingIndexNow, cloudinarySignedParams } from '../../utils';



const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

import { createSiteMediaImpl, updateSiteMediaImpl, deleteSiteMediaImpl, listSiteMediaImpl } from '../../../../server/routes/admin/site-media';
import { expireStaleBookingsImpl } from '../../../../server/routes/scheduled/booking-expiry';
type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const sitemediaRouter = new Hono<{ Bindings: any; Variables: Variables }>();

sitemediaRouter.all(
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

sitemediaRouter.post('/api/admin/cloudinary/sign', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
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
        ? { allowed_formats: 'mp4,webm,mov' } // 100MB for video
        : { allowed_formats: 'jpg,jpeg,png,webp,gif' }) // 5MB for images
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

sitemediaRouter.post('/api/admin/uploads/video', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
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

sitemediaRouter.post('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
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

sitemediaRouter.put('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
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

sitemediaRouter.delete('/api/admin/site-media/:id', requireStaffAuth, requirePermission('uploads', 'delete'), async (c) => {
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


sitemediaRouter.get('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'view'), async (c) => {
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


export default sitemediaRouter;
