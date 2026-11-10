-- Cinesphere database: complete initial structure and the built-in roles and permissions.
--
-- This single file replaces the old migrations 0001 to 0015. It only uses CREATE ... IF NOT EXISTS and
-- "insert when missing" statements, so running it on a database that already has these tables changes nothing.
-- Structure taken from the production schema; keep shared/schema.ts in line with it when you change a table.
--
-- New database:   npx wrangler d1 migrations apply cinema-db --local --config worker/wrangler.toml
-- Then create the first super admin once:  POST /api/admin/setup/super-admin

PRAGMA defer_foreign_keys = TRUE;

-- ===== TABLES =====
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "login_type" TEXT NOT NULL DEFAULT 'email',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullname" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "gender" TEXT,
    "dob" DATETIME,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expired_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "movies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "detail_images" JSONB,
    "genres" JSONB,
    "rating" DECIMAL,
    "duration_min" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT true,
    "release_date" DATETIME
, branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT, branch_ids TEXT, deleted_at TEXT, deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL);

CREATE TABLE IF NOT EXISTS "toys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "image_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ticket_packages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "price" DECIMAL NOT NULL,
    "features" JSONB,
    "type" TEXT,
    "min_group_size" INTEGER,
    "max_group_size" INTEGER,
    "is_member_only" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "display_order" INTEGER DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
, "combo" TEXT, branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT, deleted_at TEXT, deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL, branch_ids TEXT, cover_image TEXT, duration_min INTEGER, vr_genre TEXT, min_players INTEGER DEFAULT 1, max_players INTEGER DEFAULT 1);

CREATE TABLE IF NOT EXISTS site_media (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL, type TEXT NOT NULL, title TEXT, description TEXT, public_id TEXT, url TEXT NOT NULL, format TEXT, width INTEGER, height INTEGER, duration REAL, display_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, branch_ids TEXT, deleted_at TEXT);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    total_price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    paid_at TEXT,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    booking_code TEXT UNIQUE,
    pay_txt_code TEXT UNIQUE,
    combo TEXT, 
    movie_title TEXT,
    movie_duration TEXT, 
    movie_poster TEXT,
    ticket_package_name TEXT,
    ticket_unit_price REAL,
    is_used INTEGER DEFAULT 0, 
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    ticket_package_id INTEGER REFERENCES ticket_packages(id),
    expiry_date TEXT
, "checked_in_at" TEXT, branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL, confirmed_by_staff_id INTEGER, voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL, voucher_code_snapshot TEXT, voucher_discount_amount REAL DEFAULT 0, booking_type TEXT DEFAULT 'movie', original_total_price REAL, payment_expires_at TEXT);

CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  error_message TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  metadata TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
, recipient_type TEXT DEFAULT 'user', staff_id INTEGER);

CREATE TABLE IF NOT EXISTS `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`content` text NOT NULL,
	`excerpt` text,
	`featured_image` text,
	`author_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_featured` integer DEFAULT false,
	`view_count` integer DEFAULT 0,
	`published_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP), meta_description TEXT, meta_keywords TEXT, seo_title TEXT, og_image TEXT, canonical_url TEXT, schema_type TEXT DEFAULT 'Article', branch_ids TEXT,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE IF NOT EXISTS `branches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL UNIQUE,
	`address` text,
	`phone` text,
	`email` text,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`is_open` integer DEFAULT true,
	`settings` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`deleted_by_staff_id` integer
, banner_images TEXT);

CREATE TABLE IF NOT EXISTS `staffs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL,
	`fullname` text NOT NULL,
	`phone` text,
	`avatar` text,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`force_password_change` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`deleted_by_staff_id` integer
);

CREATE TABLE IF NOT EXISTS `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
, deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL);

CREATE TABLE IF NOT EXISTS `permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`description` text
);

CREATE TABLE IF NOT EXISTS `role_permissions` (
	`role_id` integer NOT NULL,
	`permission_id` integer NOT NULL,
	PRIMARY KEY (`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `staff_roles` (
	`staff_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	PRIMARY KEY (`staff_id`, `role_id`),
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `staff_branches` (
	`staff_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	PRIMARY KEY (`staff_id`, `branch_id`),
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `staff_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`type` text DEFAULT 'session' NOT NULL,
	`expired_at` text NOT NULL,
	`revoked_at` text,
	`revoke_reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer,
	`staff_email` text,
	`staff_fullname` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_values` text,
	`new_values` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `showtimes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`movie_id` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `booking_vr_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `booking_id` integer NOT NULL,
  `vr_ticket_package_id` integer NOT NULL,
  `quantity` integer NOT NULL DEFAULT 1,
  `unit_price` real NOT NULL,
  `package_name` text NOT NULL,
  `voucher_id` integer,
  `discounted_unit_price` real,
  `line_total` real NOT NULL,
  `voucher_discount_amount` real DEFAULT 0,
  `branch_id` integer,
  `created_at` text DEFAULT (datetime('now')),
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`vr_ticket_package_id`) REFERENCES `ticket_packages`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS `vouchers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `description` text,
  `scope` text NOT NULL DEFAULT 'vr',
  `discount_type` text NOT NULL,
  `discount_value` real NOT NULL,
  `min_order_value` real DEFAULT 0,
  `max_discount` real,
  `usage_limit` integer,
  `per_user_limit` integer DEFAULT 1,
  `used_count` integer NOT NULL DEFAULT 0,
  `is_active` integer NOT NULL DEFAULT 1,
  `valid_from` text,
  `valid_until` text,
  `applicable_ticket_package_ids` text,
  `applicable_user_ids` text,
  `excluded_ticket_package_ids` text,
  `branch_ids` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now')),
  `deleted_at` text,
  `deleted_by_staff_id` integer,
  FOREIGN KEY (`deleted_by_staff_id`) REFERENCES `staffs`(`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `voucher_redemption_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `voucher_id` integer NOT NULL,
  `booking_id` integer NOT NULL,
  `user_id` integer,
  `redeemed_at` text NOT NULL DEFAULT (datetime('now')),
  `discount_amount_applied` real NOT NULL,
  `order_total_before_discount` real NOT NULL,
  `order_total_after_discount` real NOT NULL,
  `staff_id` integer,
  FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON DELETE SET NULL
);

-- ===== INDEXES =====
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_key" ON "accounts"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "tokens_token_key" ON "tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_packages_code_key" ON "ticket_packages"("code");
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS `posts_slug_unique` ON `posts` (`slug`);

-- ===== BUILT-IN PERMISSIONS (60) =====
INSERT INTO permissions (module, action, description) SELECT 'dashboard', 'view', 'Xem dashboard' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'dashboard' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'dashboard', 'view_revenue', 'Xem doanh thu' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'dashboard' AND action = 'view_revenue');
INSERT INTO permissions (module, action, description) SELECT 'movies', 'view', 'Xem danh sách phim' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'movies' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'movies', 'create', 'Thêm phim mới' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'movies' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'movies', 'edit', 'Sửa thông tin phim' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'movies' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'movies', 'delete', 'Xóa phim' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'movies' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'movies', 'toggle_status', 'Bật/tắt trạng thái phim' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'movies' AND action = 'toggle_status');
INSERT INTO permissions (module, action, description) SELECT 'tickets', 'view', 'Xem gói vé' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'tickets' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'tickets', 'create', 'Thêm gói vé' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'tickets' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'tickets', 'edit', 'Sửa gói vé' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'tickets' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'tickets', 'delete', 'Xóa gói vé' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'tickets' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'toys', 'view', 'Xem merchandise' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'toys' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'toys', 'create', 'Thêm merchandise' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'toys' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'toys', 'edit', 'Sửa merchandise' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'toys' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'toys', 'delete', 'Xóa merchandise' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'toys' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'transactions', 'view', 'Xem giao dịch' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'transactions' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'transactions', 'refund', 'Hoàn tiền' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'transactions' AND action = 'refund');
INSERT INTO permissions (module, action, description) SELECT 'transactions', 'export', 'Xuất báo cáo' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'transactions' AND action = 'export');
INSERT INTO permissions (module, action, description) SELECT 'branches', 'view', 'Xem chi nhánh' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'branches' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'branches', 'create', 'Thêm chi nhánh' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'branches' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'branches', 'edit', 'Sửa chi nhánh' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'branches' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'branches', 'delete', 'Xóa chi nhánh' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'branches' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'posts', 'view', 'Xem bài viết' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'posts' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'posts', 'create', 'Thêm bài viết' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'posts' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'posts', 'edit', 'Sửa bài viết' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'posts' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'posts', 'delete', 'Xóa bài viết' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'posts' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'posts', 'publish', 'Xuất bản bài viết' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'posts' AND action = 'publish');
INSERT INTO permissions (module, action, description) SELECT 'users', 'view', 'Xem danh sách khách hàng' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'users' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'users', 'view_detail', 'Xem chi tiết khách hàng' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'users' AND action = 'view_detail');
INSERT INTO permissions (module, action, description) SELECT 'staff', 'view', 'Xem danh sách nhân viên' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'staff' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'staff', 'create', 'Thêm nhân viên' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'staff' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'staff', 'edit', 'Sửa thông tin nhân viên' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'staff' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'staff', 'delete', 'Xóa nhân viên' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'staff' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'staff', 'reset_password', 'Reset mật khẩu nhân viên' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'staff' AND action = 'reset_password');
INSERT INTO permissions (module, action, description) SELECT 'roles', 'view', 'Xem danh sách roles' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'roles' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'roles', 'create', 'Tạo role mới' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'roles' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'roles', 'edit', 'Sửa role' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'roles' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'roles', 'delete', 'Xóa role' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'roles' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'settings', 'view', 'Xem cài đặt' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'settings' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'settings', 'manage', 'Quản lý cài đặt hệ thống' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'settings' AND action = 'manage');
INSERT INTO permissions (module, action, description) SELECT 'email_logs', 'view', 'Xem log email' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'email_logs' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'email_logs', 'resend', 'Gửi lại email' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'email_logs' AND action = 'resend');
INSERT INTO permissions (module, action, description) SELECT 'uploads', 'view', 'Xem file upload' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'uploads' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'uploads', 'upload', 'Upload file' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'uploads' AND action = 'upload');
INSERT INTO permissions (module, action, description) SELECT 'uploads', 'delete', 'Xóa file' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'uploads' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'ticket_check', 'scan', 'Quét vé' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'ticket_check' AND action = 'scan');
INSERT INTO permissions (module, action, description) SELECT 'ticket_check', 'validate', 'Xác nhận vé hợp lệ' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'ticket_check' AND action = 'validate');
INSERT INTO permissions (module, action, description) SELECT 'ticket_check', 'history', 'Xem lịch sử check-in' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'ticket_check' AND action = 'history');
INSERT INTO permissions (module, action, description) SELECT 'audit', 'view', 'Xem audit logs' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'audit' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'showtimes', 'view', 'Xem lịch chiếu' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'showtimes' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'showtimes', 'create', 'Thêm suất chiếu' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'showtimes' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'showtimes', 'edit', 'Sửa suất chiếu' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'showtimes' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'showtimes', 'delete', 'Xóa suất chiếu' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'showtimes' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'view', 'Xem danh sách voucher' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'view');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'create', 'Tạo voucher mới' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'create');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'edit', 'Sửa thông tin voucher' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'edit');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'delete', 'Xóa voucher (soft delete)' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'delete');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'restore', 'Phục hồi voucher đã xóa' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'restore');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'toggle_status', 'Bật/tắt trạng thái voucher' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'toggle_status');
INSERT INTO permissions (module, action, description) SELECT 'vouchers', 'view_deleted', 'Xem danh sách voucher đã xóa (thùng rác)' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE module = 'vouchers' AND action = 'view_deleted');

-- ===== BUILT-IN ROLES (3) =====
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) SELECT 'staff', 'Nhân viên cơ bản', 1, 0, '2026-08-19 06:55:55', '2026-08-19 06:55:55' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'staff');
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) SELECT 'manager', 'Quản lý chi nhánh', 1, 1, '2026-08-19 06:55:55', '2026-10-01T10:35:25.196Z' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'manager');
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) SELECT 'admin', 'Quản trị viên', 1, 2, '2026-08-19 06:55:55', '2026-08-19 06:55:55' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

-- ===== BUILT-IN ROLE PERMISSIONS (90) =====
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module = 'dashboard' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module = 'transactions' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module = 'ticket_check' AND p.action = 'scan' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module = 'ticket_check' AND p.action = 'validate' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module = 'ticket_check' AND p.action = 'history' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'dashboard' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'dashboard' AND p.action = 'view_revenue' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'movies' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'movies' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'movies' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'movies' AND p.action = 'toggle_status' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'tickets' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'tickets' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'tickets' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'toys' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'toys' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'toys' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'transactions' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'transactions' AND p.action = 'export' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'posts' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'posts' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'posts' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'posts' AND p.action = 'publish' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'users' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'users' AND p.action = 'view_detail' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'staff' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'uploads' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'uploads' AND p.action = 'upload' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'ticket_check' AND p.action = 'scan' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'ticket_check' AND p.action = 'validate' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'ticket_check' AND p.action = 'history' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'showtimes' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'showtimes' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'showtimes' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'vouchers' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'vouchers' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'vouchers' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module = 'vouchers' AND p.action = 'toggle_status' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'dashboard' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'dashboard' AND p.action = 'view_revenue' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'movies' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'movies' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'movies' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'movies' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'movies' AND p.action = 'toggle_status' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'tickets' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'tickets' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'tickets' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'tickets' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'toys' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'toys' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'toys' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'toys' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'transactions' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'transactions' AND p.action = 'refund' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'transactions' AND p.action = 'export' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'branches' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'posts' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'posts' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'posts' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'posts' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'posts' AND p.action = 'publish' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'users' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'users' AND p.action = 'view_detail' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'staff' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'staff' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'staff' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'staff' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'staff' AND p.action = 'reset_password' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'roles' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'email_logs' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'email_logs' AND p.action = 'resend' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'uploads' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'uploads' AND p.action = 'upload' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'uploads' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'ticket_check' AND p.action = 'scan' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'ticket_check' AND p.action = 'validate' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'ticket_check' AND p.action = 'history' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'audit' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'showtimes' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'showtimes' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'showtimes' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'showtimes' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'view' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'create' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'edit' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'delete' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'restore' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'toggle_status' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module = 'vouchers' AND p.action = 'view_deleted' AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);
