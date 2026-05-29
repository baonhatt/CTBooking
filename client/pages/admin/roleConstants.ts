export const MODULES = [
        'staff',
        'roles',
        'dashboard',
        'users',
        'movies',
        'toys',
        'tickets',
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
        'view_detail',
        'view_revenue',
        'manage',
        'upload',
        'reset_password',
        'view_deleted',
        'restore'
];

export const MODULE_LABELS: Record<string, string> = {
        staff: 'Nhân viên',
        roles: 'Vai trò',
        dashboard: 'Dashboard',
        users: 'Người dùng',
        movies: 'Phim',
        toys: 'Đồ chơi',
        tickets: 'Vé',
        branches: 'Chi nhánh',
        uploads: 'Upload',
        email_logs: 'Email logs',
        audit_logs: 'Audit logs',
        settings: 'Cài đặt',
        transactions: 'Giao dịch'
};

export const ACTION_LABELS: Record<string, string> = {
        view: 'Xem',
        create: 'Tạo',
        edit: 'Sửa',
        delete: 'Xóa',
        view_detail: 'Xem chi tiết',
        view_revenue: 'Xem doanh thu',
        manage: 'Quản lý',
        upload: 'Upload',
        reset_password: 'Đặt lại mật khẩu',
        view_deleted: 'Xem đã xóa',
        restore: 'Khôi phục'
};

// Define which actions are applicable to which modules
export const APPLICABLE_ACTIONS: Record<string, string[]> = {
        staff: ['view', 'create', 'edit', 'delete', 'reset_password', 'view_deleted', 'restore'],
        roles: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
        dashboard: ['view', 'view_revenue'],
        users: ['view', 'view_detail'],
        movies: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
        toys: ['view', 'create', 'edit', 'delete'],
        tickets: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
        branches: ['view', 'create', 'edit', 'delete', 'view_deleted', 'restore'],
        uploads: ['upload', 'delete'],
        email_logs: ['view'],
        audit_logs: ['view'],
        settings: ['view', 'manage'],
        transactions: ['view']
};
