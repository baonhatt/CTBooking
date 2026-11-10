export const MODULES = [
  'staff',
  'roles',
  'dashboard',
  'users',
  'movies',
  'showtimes',
  'toys',
  'tickets',
  'vouchers',
  'posts',
  'ticket_check',
  'branches',
  'uploads',
  'email_logs',
  'audit_logs',
  'settings',
  'transactions'
];

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'view_detail',
  'view_revenue',
  'manage',
  'upload',
  'reset_password',
  'view_deleted',
  'restore',
  'toggle_status',
  'scan',
  'validate',
  'history'
];

export const MODULE_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  roles: 'Vai trò',
  dashboard: 'Bảng điều khiển',
  users: 'Người dùng',
  movies: 'Phim',
  showtimes: 'Lịch chiếu',
  toys: 'Đồ chơi',
  tickets: 'Vé',
  vouchers: 'Mã giảm giá (Voucher)',
  posts: 'Bài viết',
  ticket_check: 'Kiểm tra vé',
  branches: 'Chi nhánh',
  uploads: 'Tải lên & media',
  email_logs: 'Nhật ký email',
  audit_logs: 'Nhật ký hệ thống',
  settings: 'Cài đặt',
  transactions: 'Giao dịch'
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'Xem',
  create: 'Tạo',
  edit: 'Sửa',
  delete: 'Xóa',
  export: 'Xuất dữ liệu',
  view_detail: 'Xem chi tiết',
  view_revenue: 'Xem doanh thu',
  manage: 'Quản lý',
  upload: 'Tải lên',
  reset_password: 'Đặt lại mật khẩu',
  view_deleted: 'Xem đã xóa',
  restore: 'Khôi phục',
  toggle_status: 'Bật/tắt trạng thái',
  scan: 'Quét vé',
  validate: 'Xác nhận vé',
  history: 'Lịch sử check-in'
};

// Khớp requirePermission trong worker/src/index.ts + route/guard trên client
export const APPLICABLE_ACTIONS: Record<string, string[]> = {
  staff: ['view', 'create', 'edit', 'delete', 'reset_password', 'view_deleted', 'restore'],
  roles: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
  dashboard: ['view', 'view_revenue'],
  users: ['view', 'view_detail'],
  movies: ['view', 'create', 'edit', 'delete', 'toggle_status', 'view_deleted', 'restore'],
  showtimes: ['view', 'create', 'edit', 'delete'],
  toys: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
  tickets: ['view', 'create', 'edit', 'delete', 'toggle_status', 'view_deleted', 'restore'],
  vouchers: ['view', 'create', 'edit', 'delete', 'toggle_status', 'view_deleted', 'restore'],
  posts: ['view', 'create', 'edit', 'delete'],
  ticket_check: ['scan', 'validate', 'history'],
  branches: ['view', 'create', 'edit', 'delete', 'toggle_status', 'view_deleted', 'restore'],
  uploads: ['view', 'upload', 'delete'],
  email_logs: ['view'],
  audit_logs: ['view'],
  settings: ['view', 'manage'],
  transactions: ['view', 'export']
};

// One wording for the role level, used by the create form, the list and the detail page
export const ROLE_LEVEL_LABELS: Record<number, string> = {
  0: 'Nhân viên',
  1: 'Quản lý',
  2: 'Quản trị'
};

export function roleLevelLabel(level: number): string {
  return ROLE_LEVEL_LABELS[level] || `Cấp ${level}`;
}

// How many permissions can be granted at all (the "M" in "Quyền: N/M")
export const TOTAL_APPLICABLE_PERMISSIONS = Object.values(APPLICABLE_ACTIONS).reduce(
  (total, actions) => total + actions.length,
  0
);

// How many of a role's permissions are in the matrix (older rows may hold permissions the matrix no longer shows)
export function countGrantedPermissions(permissionList: { module: string; action: string }[] = []): number {
  return permissionList.filter((item) => APPLICABLE_ACTIONS[item.module]?.includes(item.action)).length;
}
