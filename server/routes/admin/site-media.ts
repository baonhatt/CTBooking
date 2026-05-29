import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

export async function createSiteMediaImpl(
        anyDb: any,
        tables: { site_media: any },
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
        }
        ,
        deleter?: (url: string, type?: string) => Promise<void>
) {
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
                // Upsert: Update existing
                return updateSiteMediaImpl(anyDb, tables, {
                        ...args,
                        id: existing.id,
                        duration: args.duration !== undefined ? Number(args.duration) : undefined
                }, deleter);
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
        return { item };
}

export async function listSiteMediaImpl(
        anyDb: any,
        tables: { site_media: any },
        args: { section?: string; type?: string; active?: string }
) {
        const { section, type, active } = args;
        const conditions: any[] = [];
        if (section) conditions.push(eq(tables.site_media.section, String(section)));
        if (type) conditions.push(eq(tables.site_media.type, String(type)));
        if (active) conditions.push(and(eq(tables.site_media.is_active, String(active) === 'true'), isNull(tables.site_media.deleted_at)));
        const items = await anyDb.query.site_media.findMany({
                where: and(...conditions),
                orderBy: [asc(tables.site_media.display_order), desc(tables.site_media.created_at)]
        });
        return { items };
}

export async function updateSiteMediaImpl(
        anyDb: any,
        tables: { site_media: any },
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
        }
        ,
        deleter?: (url: string, type?: string) => Promise<void>
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
        // Try to use .returning() for update, fallback to query
        const existing = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });

        const updatedRes = await anyDb
                .update(tables.site_media)
                .set(payload)
                .where(eq(tables.site_media.id, Number(id)))
                .returning();
        let item: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
        // if (!item) {
        //   item = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });
        // }

        if (existing && deleter) {
                const oldChanged = existing.url && payload.url && existing.url !== payload.url;
                const oldPublicIdChanged = existing.public_id && payload.public_id && existing.public_id !== payload.public_id;
                if (oldChanged || oldPublicIdChanged) {
                        const resourceType = existing.type === 'video' ? 'video' : 'image';
                        deleter(existing.url, resourceType).catch((e) => console.error('Failed to delete old site media asset:', e));
                }
        }

        return { item, success: Boolean(item) };
}

export async function deleteSiteMediaImpl(
        anyDb: any,
        tables: { site_media: any },
        id: number,
        deleter?: (url: string, type?: string) => Promise<void>
) {
        const existing = await anyDb.query.site_media.findFirst({ where: eq(tables.site_media.id, Number(id)) });
        if (!existing) return { ok: false, message: 'Không tìm thấy media' };
        try {
                if (existing.url && deleter) {
                        const resourceType = existing.type === 'video' ? 'video' : 'image';
                        // We pass the URL here, letting the deleter decide how to handle it
                        deleter(existing.url, resourceType).catch((e) => { });
                }
                // Delete site media (tương thích với D1/SQLite không hỗ trợ .returning())
                await anyDb.delete(tables.site_media).where(eq(tables.site_media.id, Number(id)));
                return { ok: true, item: existing };
        } catch (err: any) {
                return { ok: false, message: err?.message || 'Xóa media thất bại' };
        }
}
// Replace all media for a section: Delete all existing -> Insert new
// REMOVED as redundant
