-- Migration 0013: VR package columns + Voucher system + booking_type
-- Applies to: Cloudflare D1 / SQLite (local dev)

-- ========== A. Thêm cột VR vào bảng ticket_packages ==========
ALTER TABLE ticket_packages ADD COLUMN cover_image TEXT;        -- Ảnh bìa trò chơi/trải nghiệm VR
ALTER TABLE ticket_packages ADD COLUMN duration_min INTEGER;   -- Thời gian trải nghiệm (phút)
ALTER TABLE ticket_packages ADD COLUMN vr_genre TEXT;          -- Thể loại VR: "Horror", "Adventure", "Racing", "Educational" ...
ALTER TABLE ticket_packages ADD COLUMN min_players INTEGER DEFAULT 1; -- Số người tối thiểu
ALTER TABLE ticket_packages ADD COLUMN max_players INTEGER DEFAULT 1; -- Số người tối đa / 1 lần chơi

-- ========== B. Thêm cột voucher + booking_type vào bảng bookings ==========
ALTER TABLE bookings ADD COLUMN voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN voucher_code_snapshot TEXT;     -- Snapshot mã voucher (để lịch sử luôn có ngay cả khi voucher bị xóa/sửa)
ALTER TABLE bookings ADD COLUMN voucher_discount_amount REAL DEFAULT 0; -- Tổng giảm giá từ voucher trên toàn đơn
ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'movie'; -- 'movie' (default, keep old) | 'vr'
ALTER TABLE bookings ADD COLUMN original_total_price REAL;      -- Tổng trước khi áp dụng voucher (để đối chiếu)

-- ========== C. Tạo bảng Vouchers (chính) - scope flexible cho tương lai ==========
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- Không phân biệt hoa thường
  name TEXT NOT NULL,                         -- Tên chương trình voucher (hiển thị admin)
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'vr',           -- 'vr' | 'movie' | 'all' (hiện tại hardcode = 'vr')
  discount_type TEXT NOT NULL,                -- 'percent' | 'fixed'
  discount_value REAL NOT NULL,               -- 20 (cho percent) hoặc 50000 (cho fixed)
  min_order_value REAL DEFAULT 0,             -- Tổng đơn tối thiểu để áp dụng
  max_discount REAL,                          -- Giới hạn giảm tối đa (chỉ cho percent). NULL = không giới hạn
  usage_limit INTEGER,                        -- NULL = unlimited. VD 100 lượt toàn hệ thống
  per_user_limit INTEGER DEFAULT 1,           -- Số lượt tối đa / 1 user (NULL = unlimited)
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,       -- boolean
  valid_from TEXT,                            -- ISO date
  valid_until TEXT,                           -- ISO date
  applicable_ticket_package_ids TEXT,         -- JSON array [id1,id2] - NULL = tất cả trong scope
  applicable_user_ids TEXT,                   -- JSON array - NULL = không giới hạn user
  excluded_ticket_package_ids TEXT,           -- JSON array - loại trừ
  branch_ids TEXT,                            -- NULL = all branches | JSON array - chỉ áp tại chi nhánh nào
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_scope ON vouchers(scope);
CREATE INDEX IF NOT EXISTS idx_vouchers_is_active ON vouchers(is_active);

-- ========== D. Tạo bảng voucher_redemption_logs (chống gian lận, lịch sử sử dụng) ==========
CREATE TABLE IF NOT EXISTS voucher_redemption_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  discount_amount_applied REAL NOT NULL,
  order_total_before_discount REAL NOT NULL,
  order_total_after_discount REAL NOT NULL,
  staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL -- Nhân viên áp mã offline
);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_voucher_id ON voucher_redemption_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_booking_id ON voucher_redemption_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_user_id ON voucher_redemption_logs(user_id);

-- ========== E. Seed Voucher permissions (RBAC) ==========
-- Thêm permissions cho module Vouchers
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'view', 'Xem danh sách voucher');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'create', 'Tạo voucher mới');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'edit', 'Sửa thông tin voucher');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'delete', 'Xóa voucher (soft delete)');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'restore', 'Phục hồi voucher đã xóa');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'toggle_status', 'Bật/tắt trạng thái voucher');
INSERT OR IGNORE INTO permissions (module, action, description) VALUES ('vouchers', 'view_deleted', 'Xem danh sách voucher đã xóa (thùng rác)');

-- Assign cho Admin (full quyền vouchers)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.module || ':' || p.action IN (
    'vouchers:view', 'vouchers:create', 'vouchers:edit', 'vouchers:delete',
    'vouchers:restore', 'vouchers:toggle_status', 'vouchers:view_deleted'
  );

-- Assign cho Manager (view/create/edit/toggle_status)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.module || ':' || p.action IN (
    'vouchers:view', 'vouchers:create', 'vouchers:edit', 'vouchers:toggle_status'
  );
