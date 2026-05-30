import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';

export async function listPostsImpl(
        anyDb: any,
        tables: { posts: any; auditLogs: any },
        options: {
                page?: number;
                pageSize?: number;
                q?: string;
                status?: string;
        } = {}
) {
        const { page = 1, pageSize = 10, q, status } = options;

        let whereCondition: any = undefined;
        const conditions: any[] = [];

        if (q) {
                conditions.push(or(like(tables.posts.title, `%${q}%`), like(tables.posts.content, `%${q}%`)));
        }

        if (status && status !== 'all') {
                conditions.push(eq(tables.posts.status, status));
        }

        if (conditions.length > 0) {
                whereCondition = and(...conditions);
        }

        const total = await anyDb
                .select({ count: sql<number>`count(*)` })
                .from(tables.posts)
                .where(whereCondition)
                .then((rows: any[]) => Number(rows[0]?.count || 0));

        const items = await anyDb.query.posts.findMany({
                where: whereCondition,
                orderBy: [desc(tables.posts.created_at)],
                limit: pageSize,
                offset: (page - 1) * pageSize
        });

        return { items, page, pageSize, total };
}

export async function getPostImpl(
        anyDb: any,
        tables: { posts: any; auditLogs: any },
        identifier: number | string,
        publicOnly: boolean = false
) {
        let condition;
        const rawId = Number(identifier);

        if (!isNaN(rawId)) {
                // Trường hợp là numbers thuần (VD: 123)
                condition = eq(tables.posts.id, rawId);
        } else {
                // Trường hợp là string (slug hoặc slug-id)
                const strId = String(identifier);
                const parts = strId.split('-');
                const potentialId = Number(parts[parts.length - 1]);

                if (parts.length > 1 && !isNaN(potentialId)) {
                        // Định dạng slug-id (VD: tieu-de-bai-viet-123)
                        condition = eq(tables.posts.id, potentialId);
                } else {
                        // Định dạng slug thuần (VD: tieu-de-bai-viet)
                        condition = eq(tables.posts.slug, strId);
                }
        }

        if (publicOnly) {
                condition = and(condition, eq(tables.posts.status, 'published'));
        }

        const post = await anyDb.query.posts.findFirst({
                where: condition
        });
        if (!post) return null;

        // Get tracking data from audit logs
        const [createLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'post'), eq(tables.auditLogs.entityId, String(post.id)), eq(tables.auditLogs.action, 'create')))
                .orderBy(tables.auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'post'), eq(tables.auditLogs.entityId, String(post.id)), eq(tables.auditLogs.action, 'update')))
                .orderBy(desc(tables.auditLogs.createdAt))
                .limit(1);

        return {
                ...post,
                created_by_staff_name: createLog?.staffFullname || null,
                updated_by_staff_name: updateLog?.staffFullname || null
        };
}

export async function createPostImpl(
        anyDb: any,
        tables: { posts: any; auditLogs: any },
        args: {
                title: string;
                content: string;
                excerpt?: string;
                featured_image?: string;
                image_base64?: string;
                author_id?: number;
                status?: string;
                is_featured?: boolean;
                meta_description?: string;
                meta_keywords?: string;
                seo_title?: string;
                og_image?: string;
                canonical_url?: string;
                schema_type?: string;
        },
        RUN_ENV?: any,
        uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const {
                title,
                content,
                excerpt,
                featured_image,
                image_base64,
                author_id,
                status,
                is_featured,
                meta_description,
                meta_keywords,
                seo_title,
                og_image,
                canonical_url,
                schema_type
        } = args;

        let savedImage = featured_image;

        if (image_base64 && typeof image_base64 === 'string' && uploader) {
                try {
                        const uploadResult = await uploader(image_base64, 'ctbooking/images/posts');
                        savedImage = uploadResult.url;
                } catch (e) {
                        console.error('Upload post image failed', e);
                }
        }

        const slug = title
                .toLowerCase()
                .replace(/[đĐ]/g, 'd')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .slice(0, 255);

        const nowIso = new Date();
        const published_at = status === 'published' ? nowIso : null;

        // Build the data object explicitly to avoid issues with undefined values
        // which can cause parameter shifting in some Drizzle version/driver combinations.
        const insertData: any = {
                title,
                slug,
                content,
                excerpt: excerpt || null,
                featured_image: savedImage || null,
                status: status || 'draft',
                is_featured: is_featured || false,
                meta_description: meta_description || null,
                meta_keywords: meta_keywords || null,
                seo_title: seo_title || null,
                og_image: og_image || null,
                canonical_url: canonical_url || null,
                schema_type: schema_type || 'Article',
                published_at: published_at ? formatDateForDb(published_at) : null,
                created_at: formatDateForDb(nowIso),
                updated_at: formatDateForDb(nowIso)
        };

        // Only include author_id if it's actually provided as a number
        if (typeof author_id === 'number') {
                insertData.author_id = author_id;
        } else {
                // If not provided, we can either omit it (letting DB default to NULL)
                // or explicitly set to null.
                insertData.author_id = null;
        }

        const inserted = await anyDb.insert(tables.posts).values(insertData).returning();

        let post: any = Array.isArray(inserted) ? inserted[0] : inserted;
        if (!post) return null;

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        anyDb,
                        tables.auditLogs,
                        'create',
                        'post',
                        post.id,
                        `Tạo bài viết: ${title}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return post;
}

export async function updatePostImpl(
        anyDb: any,
        tables: { posts: any; auditLogs: any },
        id: number,
        args: {
                title?: string;
                slug?: string;
                content?: string;
                excerpt?: string;
                featured_image?: string;
                image_base64?: string;
                status?: string;
                is_featured?: boolean;
                meta_description?: string;
                meta_keywords?: string;
                seo_title?: string;
                og_image?: string;
                canonical_url?: string;
                schema_type?: string;
        },
        RUN_ENV?: any,
        uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
        deleter?: (url: string) => Promise<void>,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const existing = await anyDb.query.posts.findFirst({
                where: eq(tables.posts.id, id)
        });
        if (!existing) return null;

        const {
                title,
                content,
                excerpt,
                featured_image,
                image_base64,
                status,
                is_featured,
                meta_description,
                meta_keywords,
                seo_title,
                og_image,
                canonical_url,
                schema_type
        } = args;

        const data: any = {
                updated_at: formatDateForDb(new Date())
        };

        if (title !== undefined) {
                data.title = title;
        }
        if (args.slug !== undefined) {
                data.slug = args.slug;
        }
        if (content !== undefined) data.content = content;
        if (excerpt !== undefined) data.excerpt = excerpt;
        if (featured_image !== undefined) data.featured_image = featured_image;
        if (status !== undefined) {
                data.status = status;
                if (status === 'published' && !existing.published_at) {
                        data.published_at = formatDateForDb(new Date());
                }
                if (status !== 'published') {
                        // "Gỡ bài" / lưu trữ: không còn public
                        data.published_at = null;
                }
        }
        if (is_featured !== undefined) data.is_featured = is_featured;
        if (meta_description !== undefined) data.meta_description = meta_description;
        if (meta_keywords !== undefined) data.meta_keywords = meta_keywords;
        if (seo_title !== undefined) data.seo_title = seo_title;
        if (og_image !== undefined) data.og_image = og_image;
        if (canonical_url !== undefined) data.canonical_url = canonical_url;
        if (schema_type !== undefined) data.schema_type = schema_type;

        if (image_base64 && typeof image_base64 === 'string' && uploader) {
                try {
                        const uploadResult = await uploader(image_base64, 'ctbooking/images/posts');
                        data.featured_image = uploadResult.url;
                } catch (e) {
                        console.error('Upload post image failed', e);
                }
        }

        const updatedRes = await anyDb.update(tables.posts).set(data).where(eq(tables.posts.id, id)).returning();

        let post: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

        if (
                existing &&
                data.featured_image &&
                existing.featured_image &&
                existing.featured_image !== data.featured_image &&
                deleter
        ) {
                deleter(existing.featured_image).catch((e) => console.error('Failed to delete old post image:', e));
        }

        if (existing && data.og_image && existing.og_image && existing.og_image !== data.og_image && deleter) {
                deleter(existing.og_image).catch((e) => console.error('Failed to delete old post OG image:', e));
        }

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        anyDb,
                        tables.auditLogs,
                        'update',
                        'post',
                        id,
                        `Cập nhật bài viết: ${post?.title || existing.title}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return post || null;
}

export async function deletePostImpl(
        anyDb: any,
        tables: { posts: any; auditLogs: any },
        id: number,
        deleter?: (url: string) => Promise<void>,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const existing = await anyDb.query.posts.findFirst({
                where: eq(tables.posts.id, id)
        });
        if (!existing) return null;

        if (existing.featured_image && deleter) {
                deleter(existing.featured_image).catch((e) => console.error('Failed to delete post image:', e));
        }

        await anyDb.delete(tables.posts).where(eq(tables.posts.id, id));

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        anyDb,
                        tables.auditLogs,
                        'delete',
                        'post',
                        id,
                        `Xóa bài viết: ${existing.title}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return existing;
}

export async function incrementPostViewImpl(anyDb: any, tables: { posts: any; auditLogs: any }, id: number) {
        return anyDb
                .update(tables.posts)
                .set({
                        view_count: sql`${tables.posts.view_count} + 1`
                })
                .where(eq(tables.posts.id, id))
                .returning();
}
