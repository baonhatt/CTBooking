-- Seed Permissions
INSERT INTO permissions (module, action, description) VALUES ('dashboard', 'view', 'Xem dashboard');
INSERT INTO permissions (module, action, description) VALUES ('dashboard', 'view_revenue', 'Xem doanh thu');
INSERT INTO permissions (module, action, description) VALUES ('movies', 'view', 'Xem danh sách phim');
INSERT INTO permissions (module, action, description) VALUES ('movies', 'create', 'Thêm phim mới');
INSERT INTO permissions (module, action, description) VALUES ('movies', 'edit', 'Sửa thông tin phim');
INSERT INTO permissions (module, action, description) VALUES ('movies', 'delete', 'Xóa phim');
INSERT INTO permissions (module, action, description) VALUES ('movies', 'toggle_status', 'Bật/tắt trạng thái phim');
INSERT INTO permissions (module, action, description) VALUES ('tickets', 'view', 'Xem gói vé');
INSERT INTO permissions (module, action, description) VALUES ('tickets', 'create', 'Thêm gói vé');
INSERT INTO permissions (module, action, description) VALUES ('tickets', 'edit', 'Sửa gói vé');
INSERT INTO permissions (module, action, description) VALUES ('tickets', 'delete', 'Xóa gói vé');
INSERT INTO permissions (module, action, description) VALUES ('toys', 'view', 'Xem merchandise');
INSERT INTO permissions (module, action, description) VALUES ('toys', 'create', 'Thêm merchandise');
INSERT INTO permissions (module, action, description) VALUES ('toys', 'edit', 'Sửa merchandise');
INSERT INTO permissions (module, action, description) VALUES ('toys', 'delete', 'Xóa merchandise');
INSERT INTO permissions (module, action, description) VALUES ('transactions', 'view', 'Xem giao dịch');
INSERT INTO permissions (module, action, description) VALUES ('transactions', 'refund', 'Hoàn tiền');
INSERT INTO permissions (module, action, description) VALUES ('transactions', 'export', 'Xuất báo cáo');
INSERT INTO permissions (module, action, description) VALUES ('branches', 'view', 'Xem chi nhánh');
INSERT INTO permissions (module, action, description) VALUES ('branches', 'create', 'Thêm chi nhánh');
INSERT INTO permissions (module, action, description) VALUES ('branches', 'edit', 'Sửa chi nhánh');
INSERT INTO permissions (module, action, description) VALUES ('branches', 'delete', 'Xóa chi nhánh');
INSERT INTO permissions (module, action, description) VALUES ('posts', 'view', 'Xem bài viết');
INSERT INTO permissions (module, action, description) VALUES ('posts', 'create', 'Thêm bài viết');
INSERT INTO permissions (module, action, description) VALUES ('posts', 'edit', 'Sửa bài viết');
INSERT INTO permissions (module, action, description) VALUES ('posts', 'delete', 'Xóa bài viết');
INSERT INTO permissions (module, action, description) VALUES ('posts', 'publish', 'Xuất bản bài viết');
INSERT INTO permissions (module, action, description) VALUES ('users', 'view', 'Xem danh sách khách hàng');
INSERT INTO permissions (module, action, description) VALUES ('users', 'view_detail', 'Xem chi tiết khách hàng');
INSERT INTO permissions (module, action, description) VALUES ('staff', 'view', 'Xem danh sách nhân viên');
INSERT INTO permissions (module, action, description) VALUES ('staff', 'create', 'Thêm nhân viên');
INSERT INTO permissions (module, action, description) VALUES ('staff', 'edit', 'Sửa thông tin nhân viên');
INSERT INTO permissions (module, action, description) VALUES ('staff', 'delete', 'Xóa nhân viên');
INSERT INTO permissions (module, action, description) VALUES ('staff', 'reset_password', 'Reset mật khẩu nhân viên');
INSERT INTO permissions (module, action, description) VALUES ('roles', 'view', 'Xem danh sách roles');
INSERT INTO permissions (module, action, description) VALUES ('roles', 'create', 'Tạo role mới');
INSERT INTO permissions (module, action, description) VALUES ('roles', 'edit', 'Sửa role');
INSERT INTO permissions (module, action, description) VALUES ('roles', 'delete', 'Xóa role');
INSERT INTO permissions (module, action, description) VALUES ('settings', 'view', 'Xem cài đặt');
INSERT INTO permissions (module, action, description) VALUES ('settings', 'manage', 'Quản lý cài đặt hệ thống');
INSERT INTO permissions (module, action, description) VALUES ('email_logs', 'view', 'Xem log email');
INSERT INTO permissions (module, action, description) VALUES ('email_logs', 'resend', 'Gửi lại email');
INSERT INTO permissions (module, action, description) VALUES ('uploads', 'view', 'Xem file upload');
INSERT INTO permissions (module, action, description) VALUES ('uploads', 'upload', 'Upload file');
INSERT INTO permissions (module, action, description) VALUES ('uploads', 'delete', 'Xóa file');
INSERT INTO permissions (module, action, description) VALUES ('ticket_check', 'scan', 'Quét vé');
INSERT INTO permissions (module, action, description) VALUES ('ticket_check', 'validate', 'Xác nhận vé hợp lệ');
INSERT INTO permissions (module, action, description) VALUES ('ticket_check', 'history', 'Xem lịch sử check-in');
INSERT INTO permissions (module, action, description) VALUES ('audit', 'view', 'Xem audit logs');

-- Seed Roles
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) VALUES ('staff', 'Nhân viên cơ bản', 1, 0, datetime('now'), datetime('now'));
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) VALUES ('manager', 'Quản lý chi nhánh', 1, 1, datetime('now'), datetime('now'));
INSERT INTO roles (name, description, is_system, level, created_at, updated_at) VALUES ('admin', 'Quản trị viên', 1, 2, datetime('now'), datetime('now'));

-- Seed Role Permissions (Staff)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'staff' AND p.module || ':' || p.action IN ('dashboard:view', 'transactions:view', 'ticket_check:scan', 'ticket_check:validate', 'ticket_check:history');

-- Seed Role Permissions (Manager)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'manager' AND p.module || ':' || p.action IN ('dashboard:view', 'dashboard:view_revenue', 'movies:view', 'movies:create', 'movies:edit', 'movies:toggle_status', 'tickets:view', 'tickets:create', 'tickets:edit', 'toys:view', 'toys:create', 'toys:edit', 'transactions:view', 'posts:view', 'posts:create', 'posts:edit', 'posts:publish', 'users:view', 'users:view_detail', 'staff:view', 'uploads:view', 'uploads:upload', 'ticket_check:scan', 'ticket_check:validate', 'ticket_check:history');

-- Seed Role Permissions (Admin)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin' AND p.module || ':' || p.action IN ('dashboard:view', 'dashboard:view_revenue', 'movies:view', 'movies:create', 'movies:edit', 'movies:delete', 'movies:toggle_status', 'tickets:view', 'tickets:create', 'tickets:edit', 'tickets:delete', 'toys:view', 'toys:create', 'toys:edit', 'toys:delete', 'transactions:view', 'transactions:refund', 'transactions:export', 'branches:view', 'posts:view', 'posts:create', 'posts:edit', 'posts:delete', 'posts:publish', 'users:view', 'users:view_detail', 'staff:view', 'staff:create', 'staff:edit', 'staff:delete', 'staff:reset_password', 'roles:view', 'email_logs:view', 'email_logs:resend', 'uploads:view', 'uploads:upload', 'uploads:delete', 'ticket_check:scan', 'ticket_check:validate', 'ticket_check:history', 'audit:view');
