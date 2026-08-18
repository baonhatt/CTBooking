import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        fullname: text('fullname'),
        phone: text('phone'),
        avatar: text('avatar'),
        gender: text('gender'),
        dob: text('dob'),
        created_at: text('created_at'),
        updated_at: text('updated_at')
});

export const accounts = sqliteTable('accounts', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        user_id: integer('user_id')
                .notNull()
                .references(() => users.id, { onDelete: 'cascade' }),
        email: text('email').notNull().unique(),
        password: text('password'),
        login_type: text('login_type').default('email').notNull(),
        is_active: integer('is_active', { mode: 'boolean' }).default(true),
        created_at: text('created_at'),
        updated_at: text('updated_at')
});

export const tokens = sqliteTable('tokens', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        account_id: integer('account_id')
                .notNull()
                .references(() => accounts.id, { onDelete: 'cascade' }),
        type: text('type').notNull(),
        token: text('token').notNull().unique(),
        expired_at: text('expired_at'),
        created_at: text('created_at').notNull()
});

export const movies = sqliteTable('movies', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        title: text('title').notNull(),
        description: text('description'),
        cover_image: text('cover_image'),
        detail_images: text('detail_images'), // JSON string in SQLite
        genres: text('genres'), // JSON string in SQLite
        rating: real('rating'),
        duration_min: integer('duration_min'),
        branch_id: integer('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
        // NULL => all branches; JSON array => specific branches; "[]" => not configured
        branch_ids: text('branch_ids'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        is_active: integer('is_active', { mode: 'boolean' }).default(true),
        release_date: text('release_date'),
        deleted_at: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const ticket_packages = sqliteTable('ticket_packages', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull(),
        code: text('code').unique(),
        description: text('description'),
        price: real('price').notNull(),
        features: text('features'), // JSON
        type: text('type'),
        combo: text('combo'),
        min_group_size: integer('min_group_size'),
        max_group_size: integer('max_group_size'),
        is_member_only: integer('is_member_only', { mode: 'boolean' }).default(false),
        is_active: integer('is_active', { mode: 'boolean' }).default(true),
        display_order: integer('display_order').default(0),
        branch_id: integer('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
        // NULL => all branches; JSON array => specific branches; "[]" => not configured
        branch_ids: text('branch_ids'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        deleted_at: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' }),
        // ===== VR-specific columns (ignored for type='movie') =====
        cover_image: text('cover_image'),
        duration_min: integer('duration_min'),
        vr_genre: text('vr_genre'),
        min_players: integer('min_players').default(1),
        max_players: integer('max_players').default(1)
});

export const bookings = sqliteTable('bookings', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        // Cho phép null để lưu booking của khách vãng lai (không có user/account)
        user_id: integer('user_id').references(() => users.id, {
                onDelete: 'cascade'
        }),
        ticket_count: integer('ticket_count').default(1).notNull(),
        total_price: real('total_price').notNull(),
        created_at: text('created_at').notNull(),
        paid_at: text('paid_at'),
        payment_method: text('payment_method').default('cash'),
        payment_status: text('payment_status').default('pending'),
        transaction_id: text('transaction_id'),
        updated_at: text('updated_at').notNull(),
        name: text('name').default('').notNull(),
        phone: text('phone').default('').notNull(),
        email: text('email').default('').notNull(),
        booking_code: text('booking_code').unique(),
        pay_txt_code: text('pay_txt_code').unique(),
        combo: text('combo'),
        movie_title: text('movie_title'),
        movie_duration: text('movie_duration'),
        movie_poster: text('movie_poster'),
        ticket_package_name: text('ticket_package_name'),
        ticket_unit_price: real('ticket_unit_price'),
        is_used: integer('is_used', { mode: 'boolean' }).default(false),
        movie_id: integer('movie_id').references(() => movies.id, {
                onDelete: 'cascade'
        }),
        ticket_package_id: integer('ticket_package_id').references(() => ticket_packages.id),
        expiry_date: text('expiry_date'),
        checked_in_at: text('checked_in_at'),
        branch_id: integer('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
        confirmed_by_staff_id: integer('confirmed_by_staff_id').references(() => staffs.id, { onDelete: 'set null' }),
        // ===== VR + Voucher columns =====
        voucher_id: integer('voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
        voucher_code_snapshot: text('voucher_code_snapshot'),
        voucher_discount_amount: real('voucher_discount_amount').default(0),
        booking_type: text('booking_type').default('movie'), // 'movie' | 'vr'
        original_total_price: real('original_total_price')
});

export const toys = sqliteTable('toys', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull(),
        category: text('category'),
        price: real('price').notNull(),
        stock: integer('stock').default(0).notNull(),
        status: text('status').default('active').notNull(),
        image_url: text('image_url'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        deleted_at: text('deleted_at')
});

export const email_logs = sqliteTable('email_logs', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        recipient: text('recipient').notNull(),
        subject: text('subject').notNull(),
        email_type: text('email_type').notNull(), // 'welcome', 'reset_password', 'booking_confirmation'
        status: text('status').notNull().default('pending'), // 'pending', 'sent', 'failed'
        provider: text('provider'), // 'mailtrap', 'brevo', 'mailchannels', 'resend'
        error_message: text('error_message'),
        recipient_type: text('recipient_type').default('user'), // 'user' or 'staff'
        user_id: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
        staff_id: integer('staff_id').references(() => staffs.id, { onDelete: 'set null' }),
        booking_id: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
        metadata: text('metadata'), // JSON string
        sent_at: text('sent_at'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull()
});

export const site_media = sqliteTable('site_media', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        section: text('section').notNull(),
        type: text('type').notNull(),
        // Branch targeting (v2 JSON approach)
        // - NULL => applicable to all branches
        // - JSON array string => applicable to selected branches only
        branch_ids: text('branch_ids'),
        title: text('title'),
        description: text('description'),
        public_id: text('public_id'),
        url: text('url').notNull(),
        format: text('format'),
        width: integer('width'),
        height: integer('height'),
        duration: real('duration'),
        display_order: integer('display_order').default(0),
        is_active: integer('is_active', { mode: 'boolean' }).default(true),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        deleted_at: text('deleted_at')
});

export const branches = sqliteTable('branches', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull(),
        code: text('code').unique().notNull(),
        address: text('address'),
        phone: text('phone'),
        email: text('email'),
        is_default: integer('is_default', { mode: 'boolean' }).default(false),
        is_active: integer('is_active', { mode: 'boolean' }).default(true),
        is_open: integer('is_open', { mode: 'boolean' }).default(true),
        settings: text('settings'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        deleted_at: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const showtimes = sqliteTable('showtimes', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        branch_id: integer('branch_id')
                .notNull()
                .references(() => branches.id, { onDelete: 'restrict' }),
        movie_id: integer('movie_id')
                .notNull()
                .references(() => movies.id, { onDelete: 'restrict' }),
        start_time: text('start_time').notNull(),
        end_time: text('end_time').notNull(),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull()
});

export const posts = sqliteTable('posts', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        title: text('title').notNull(),
        slug: text('slug').unique(),
        content: text('content').notNull(),
        // Branch targeting (v2 JSON approach)
        // - NULL => applicable to all branches
        // - JSON array string => applicable to selected branches only
        branch_ids: text('branch_ids'),
        excerpt: text('excerpt'),
        featured_image: text('featured_image'),
        meta_description: text('meta_description'),
        meta_keywords: text('meta_keywords'),
        seo_title: text('seo_title'),
        og_image: text('og_image'),
        canonical_url: text('canonical_url'),
        schema_type: text('schema_type').default('Article'),
        author_id: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
        status: text('status').default('draft').notNull(),
        is_featured: integer('is_featured', { mode: 'boolean' }).default(false),
        view_count: integer('view_count').default(0),
        published_at: text('published_at'),
        created_at: text('created_at'),
        updated_at: text('updated_at')
});

// ==================== VR + VOUCHER TABLES (migration 0012, 0013) ====================

export const vouchers = sqliteTable('vouchers', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        code: text('code').notNull().unique(),
        name: text('name').notNull(),
        description: text('description'),
        scope: text('scope').notNull().default('vr'), // 'vr' | 'movie' | 'all'
        discount_type: text('discount_type').notNull(), // 'percent' | 'fixed'
        discount_value: real('discount_value').notNull(),
        min_order_value: real('min_order_value').default(0),
        max_discount: real('max_discount'),
        usage_limit: integer('usage_limit'),
        per_user_limit: integer('per_user_limit').default(1),
        used_count: integer('used_count').notNull().default(0),
        is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        valid_from: text('valid_from'),
        valid_until: text('valid_until'),
        applicable_ticket_package_ids: text('applicable_ticket_package_ids'), // JSON array of package IDs | NULL = all
        applicable_user_ids: text('applicable_user_ids'),                 // JSON array | NULL = all
        excluded_ticket_package_ids: text('excluded_ticket_package_ids'), // JSON array
        branch_ids: text('branch_ids'),
        created_at: text('created_at').notNull(),
        updated_at: text('updated_at').notNull(),
        deleted_at: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const voucher_redemption_logs = sqliteTable('voucher_redemption_logs', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        voucher_id: integer('voucher_id').notNull().references(() => vouchers.id, { onDelete: 'restrict' }),
        booking_id: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
        user_id: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
        redeemed_at: text('redeemed_at').notNull(),
        discount_amount_applied: real('discount_amount_applied').notNull(),
        order_total_before_discount: real('order_total_before_discount').notNull(),
        order_total_after_discount: real('order_total_after_discount').notNull(),
        staff_id: integer('staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const booking_vr_items = sqliteTable('booking_vr_items', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        booking_id: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
        vr_ticket_package_id: integer('vr_ticket_package_id').notNull().references(() => ticket_packages.id, { onDelete: 'restrict' }),
        quantity: integer('quantity').notNull().default(1),
        unit_price: real('unit_price').notNull(),
        package_name: text('package_name').notNull(),
        voucher_id: integer('voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
        discounted_unit_price: real('discounted_unit_price'),
        line_total: real('line_total').notNull(),
        voucher_discount_amount: real('voucher_discount_amount').default(0),
        branch_id: integer('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
        created_at: text('created_at')
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
        accounts: many(accounts),
        bookings: many(bookings)
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
        user: one(users, {
                fields: [accounts.user_id],
                references: [users.id]
        }),
        tokens: many(tokens)
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
        account: one(accounts, {
                fields: [tokens.account_id],
                references: [accounts.id]
        })
}));

export const moviesRelations = relations(movies, ({ one, many }) => ({
        bookings: many(bookings),
        showtimes: many(showtimes),
        branch: one(branches, {
                fields: [movies.branch_id],
                references: [branches.id]
        })
}));

export const showtimesRelations = relations(showtimes, ({ one }) => ({
        branch: one(branches, {
                fields: [showtimes.branch_id],
                references: [branches.id]
        }),
        movie: one(movies, {
                fields: [showtimes.movie_id],
                references: [movies.id]
        })
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
        user: one(users, {
                fields: [bookings.user_id],
                references: [users.id]
        }),
        movie: one(movies, {
                fields: [bookings.movie_id],
                references: [movies.id]
        }),
        ticket_package: one(ticket_packages, {
                fields: [bookings.ticket_package_id],
                references: [ticket_packages.id]
        }),
        booking_vr_items: many(booking_vr_items),
        voucher: one(vouchers, {
                fields: [bookings.voucher_id],
                references: [vouchers.id]
        }),
        voucher_redemption_logs: many(voucher_redemption_logs)
}));

export const ticketPackagesRelations = relations(ticket_packages, ({ many }) => ({
        bookings: many(bookings),
        vr_booking_items: many(booking_vr_items)
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
        bookings: many(bookings),
        booking_vr_items: many(booking_vr_items),
        redemption_logs: many(voucher_redemption_logs),
        deleted_by_staff: one(staffs, {
                fields: [vouchers.deleted_by_staff_id],
                references: [staffs.id]
        })
}));

export const voucherRedemptionLogsRelations = relations(voucher_redemption_logs, ({ one }) => ({
        voucher: one(vouchers, {
                fields: [voucher_redemption_logs.voucher_id],
                references: [vouchers.id]
        }),
        booking: one(bookings, {
                fields: [voucher_redemption_logs.booking_id],
                references: [bookings.id]
        }),
        user: one(users, {
                fields: [voucher_redemption_logs.user_id],
                references: [users.id]
        }),
        staff: one(staffs, {
                fields: [voucher_redemption_logs.staff_id],
                references: [staffs.id]
        })
}));

export const bookingVRItemsRelations = relations(booking_vr_items, ({ one }) => ({
        booking: one(bookings, {
                fields: [booking_vr_items.booking_id],
                references: [bookings.id]
        }),
        vr_package: one(ticket_packages, {
                fields: [booking_vr_items.vr_ticket_package_id],
                references: [ticket_packages.id]
        }),
        voucher: one(vouchers, {
                fields: [booking_vr_items.voucher_id],
                references: [vouchers.id]
        }),
        branch: one(branches, {
                fields: [booking_vr_items.branch_id],
                references: [branches.id]
        })
}));

// RBAC Tables
export const staffs = sqliteTable('staffs', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        email: text('email').notNull().unique(),
        password: text('password').notNull(),
        fullname: text('fullname').notNull(),
        phone: text('phone'),
        avatar: text('avatar'),
        isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        forcePasswordChange: integer('force_password_change', { mode: 'boolean' }).notNull().default(false),
        lastLoginAt: text('last_login_at'),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
        deletedAt: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const staffTokens = sqliteTable('staff_tokens', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        staffId: integer('staff_id')
                .notNull()
                .references(() => staffs.id, { onDelete: 'cascade' }),
        token: text('token').notNull().unique(),
        type: text('type').notNull().default('session'),
        expiredAt: text('expired_at').notNull(),
        revokedAt: text('revoked_at'),
        revokeReason: text('revoke_reason'),
        createdAt: text('created_at').notNull()
});

export const roles = sqliteTable('roles', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        name: text('name').notNull().unique(),
        description: text('description'),
        isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
        level: integer('level').notNull().default(0),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
        deleted_at: text('deleted_at'),
        deleted_by_staff_id: integer('deleted_by_staff_id').references(() => staffs.id, { onDelete: 'set null' })
});

export const permissions = sqliteTable('permissions', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        module: text('module').notNull(),
        action: text('action').notNull(),
        description: text('description')
});

export const rolePermissions = sqliteTable('role_permissions', {
        roleId: integer('role_id')
                .notNull()
                .references(() => roles.id, { onDelete: 'cascade' }),
        permissionId: integer('permission_id')
                .notNull()
                .references(() => permissions.id, { onDelete: 'cascade' })
});

export const staffRoles = sqliteTable('staff_roles', {
        staffId: integer('staff_id')
                .notNull()
                .references(() => staffs.id, { onDelete: 'cascade' }),
        roleId: integer('role_id')
                .notNull()
                .references(() => roles.id, { onDelete: 'cascade' })
});

export const staffBranches = sqliteTable('staff_branches', {
        staffId: integer('staff_id')
                .notNull()
                .references(() => staffs.id, { onDelete: 'cascade' }),
        branchId: integer('branch_id')
                .notNull()
                .references(() => branches.id, { onDelete: 'cascade' })
});

export const auditLogs = sqliteTable('audit_logs', {
        id: integer('id').primaryKey({ autoIncrement: true }),
        staffId: integer('staff_id').references(() => staffs.id, { onDelete: 'set null' }),
        staffEmail: text('staff_email'),
        staffFullname: text('staff_fullname'),
        action: text('action').notNull(),
        entityType: text('entity_type').notNull(),
        entityId: integer('entity_id'),
        oldValues: text('old_values'),
        newValues: text('new_values'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        createdAt: text('created_at').notNull()
});

// RBAC Relations
export const staffsRelations = relations(staffs, ({ many }) => ({
        tokens: many(staffTokens),
        roles: many(staffRoles),
        branches: many(staffBranches),
        auditLogs: many(auditLogs)
}));

export const staffTokensRelations = relations(staffTokens, ({ one }) => ({
        staff: one(staffs, {
                fields: [staffTokens.staffId],
                references: [staffs.id]
        })
}));

export const rolesRelations = relations(roles, ({ many }) => ({
        permissions: many(rolePermissions),
        staff: many(staffRoles)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
        roles: many(rolePermissions)
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
        role: one(roles, {
                fields: [rolePermissions.roleId],
                references: [roles.id]
        }),
        permission: one(permissions, {
                fields: [rolePermissions.permissionId],
                references: [permissions.id]
        })
}));

export const staffRolesRelations = relations(staffRoles, ({ one }) => ({
        staff: one(staffs, {
                fields: [staffRoles.staffId],
                references: [staffs.id]
        }),
        role: one(roles, {
                fields: [staffRoles.roleId],
                references: [roles.id]
        })
}));

export const staffBranchesRelations = relations(staffBranches, ({ one }) => ({
        staff: one(staffs, {
                fields: [staffBranches.staffId],
                references: [staffs.id]
        }),
        branch: one(branches, {
                fields: [staffBranches.branchId],
                references: [branches.id]
        })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
        staff: one(staffs, {
                fields: [auditLogs.staffId],
                references: [staffs.id]
        })
}));
