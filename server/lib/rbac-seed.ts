export const PERMISSIONS_SEED = [
  // Staff
  { module: 'staff', action: 'view', description: 'Xem danh sách nhân viên' },
  { module: 'staff', action: 'create', description: 'Thêm nhân viên' },
  { module: 'staff', action: 'edit', description: 'Sửa thông tin nhân viên' },
  { module: 'staff', action: 'delete', description: 'Xóa nhân viên' },
  { module: 'staff', action: 'reset_password', description: 'Reset mật khẩu nhân viên' },
  { module: 'staff', action: 'view_deleted', description: 'Xem nhân viên đã xóa' },
  { module: 'staff', action: 'restore', description: 'Khôi phục nhân viên đã xóa' },

  // Roles
  { module: 'roles', action: 'view', description: 'Xem danh sách roles' },
  { module: 'roles', action: 'create', description: 'Tạo role mới' },
  { module: 'roles', action: 'edit', description: 'Sửa role' },
  { module: 'roles', action: 'delete', description: 'Xóa role' },
  { module: 'roles', action: 'view_deleted', description: 'Xem role đã xóa' },
  { module: 'roles', action: 'restore', description: 'Khôi phục role đã xóa' },

  // Dashboard
  { module: 'dashboard', action: 'view', description: 'Xem dashboard' },
  { module: 'dashboard', action: 'view_revenue', description: 'Xem doanh thu' },

  // Users (khách hàng)
  { module: 'users', action: 'view', description: 'Xem danh sách khách hàng' },
  { module: 'users', action: 'view_detail', description: 'Xem chi tiết khách hàng' },

  // Movies
  { module: 'movies', action: 'view', description: 'Xem danh sách phim' },
  { module: 'movies', action: 'create', description: 'Thêm phim mới' },
  { module: 'movies', action: 'edit', description: 'Sửa thông tin phim' },
  { module: 'movies', action: 'delete', description: 'Xóa phim' },
  { module: 'movies', action: 'toggle_status', description: 'Bật/tắt trạng thái phim' },
  { module: 'movies', action: 'view_deleted', description: 'Xem phim đã xóa' },
  { module: 'movies', action: 'restore', description: 'Khôi phục phim đã xóa' },

  // Showtimes
  { module: 'showtimes', action: 'view', description: 'Xem lịch chiếu' },
  { module: 'showtimes', action: 'create', description: 'Thêm suất chiếu' },
  { module: 'showtimes', action: 'edit', description: 'Sửa suất chiếu' },
  { module: 'showtimes', action: 'delete', description: 'Xóa suất chiếu' },

  // Toys
  { module: 'toys', action: 'view', description: 'Xem merchandise' },
  { module: 'toys', action: 'create', description: 'Thêm merchandise' },
  { module: 'toys', action: 'edit', description: 'Sửa merchandise' },
  { module: 'toys', action: 'delete', description: 'Xóa merchandise' },
  { module: 'toys', action: 'view_deleted', description: 'Xem merchandise đã xóa' },
  { module: 'toys', action: 'restore', description: 'Khôi phục merchandise đã xóa' },

  // Tickets
  { module: 'tickets', action: 'view', description: 'Xem gói vé' },
  { module: 'tickets', action: 'create', description: 'Thêm gói vé' },
  { module: 'tickets', action: 'edit', description: 'Sửa gói vé' },
  { module: 'tickets', action: 'toggle_status', description: 'Bật/tắt trạng thái gói vé' },
  { module: 'tickets', action: 'delete', description: 'Xóa gói vé' },
  { module: 'tickets', action: 'view_deleted', description: 'Xem gói vé đã xóa' },
  { module: 'tickets', action: 'restore', description: 'Khôi phục gói vé đã xóa' },

  // Posts
  { module: 'posts', action: 'view', description: 'Xem bài viết' },
  { module: 'posts', action: 'create', description: 'Thêm bài viết' },
  { module: 'posts', action: 'edit', description: 'Sửa bài viết' },
  { module: 'posts', action: 'delete', description: 'Xóa bài viết' },

  // Ticket check
  { module: 'ticket_check', action: 'scan', description: 'Quét vé' },
  { module: 'ticket_check', action: 'validate', description: 'Xác nhận vé hợp lệ' },
  { module: 'ticket_check', action: 'history', description: 'Xem lịch sử check-in' },

  // Branches
  { module: 'branches', action: 'view', description: 'Xem chi nhánh' },
  { module: 'branches', action: 'create', description: 'Thêm chi nhánh' },
  { module: 'branches', action: 'edit', description: 'Sửa chi nhánh (đóng/mở cửa, sửa thông tin)' },
  { module: 'branches', action: 'toggle_status', description: 'Bật/tắt trạng thái chi nhánh (ẩn/kích hoạt)' },
  { module: 'branches', action: 'delete', description: 'Xóa chi nhánh' },
  { module: 'branches', action: 'view_deleted', description: 'Xem chi nhánh đã xóa' },
  { module: 'branches', action: 'restore', description: 'Khôi phục chi nhánh đã xóa' },

  // Uploads
  { module: 'uploads', action: 'view', description: 'Xem file upload' },
  { module: 'uploads', action: 'upload', description: 'Upload file' },
  { module: 'uploads', action: 'delete', description: 'Xóa file' },

  // Email logs
  { module: 'email_logs', action: 'view', description: 'Xem log email' },

  // Audit logs (khớp worker: audit_logs)
  { module: 'audit_logs', action: 'view', description: 'Xem audit logs' },

  // Settings
  { module: 'settings', action: 'view', description: 'Xem cài đặt' },
  { module: 'settings', action: 'manage', description: 'Quản lý cài đặt hệ thống' },

  // Transactions
  { module: 'transactions', action: 'view', description: 'Xem giao dịch' },

  // Vouchers (VR / giảm giá)
  { module: 'vouchers', action: 'view', description: 'Xem danh sách vouchers' },
  { module: 'vouchers', action: 'create', description: 'Tạo voucher mới' },
  { module: 'vouchers', action: 'edit', description: 'Sửa voucher' },
  { module: 'vouchers', action: 'toggle_status', description: 'Bật/tắt trạng thái voucher' },
  { module: 'vouchers', action: 'delete', description: 'Xóa voucher' },
  { module: 'vouchers', action: 'view_deleted', description: 'Xem voucher đã xóa' },
  { module: 'vouchers', action: 'restore', description: 'Khôi phục voucher đã xóa' }
];

export const ROLES_SEED = [
  {
    name: 'staff',
    description: 'Nhân viên cơ bản — chỉ check vé và xem giao dịch',
    isSystem: true,
    level: 0,
    permissions: [
      'dashboard:view',
      'transactions:view',
      'ticket_check:scan',
      'ticket_check:validate',
      'ticket_check:history'
    ]
  },
  {
    name: 'manager',
    description: 'Quản lý chi nhánh — quản lý nội dung, xem báo cáo',
    isSystem: true,
    level: 1,
    permissions: [
      'dashboard:view',
      'dashboard:view_revenue',
      'movies:view',
      'movies:create',
      'movies:edit',
      'movies:toggle_status',
      'showtimes:view',
      'showtimes:create',
      'showtimes:edit',
      'tickets:view',
      'tickets:create',
      'tickets:edit',
      'tickets:toggle_status',
      'toys:view',
      'toys:create',
      'toys:edit',
      'vouchers:view',
      'vouchers:create',
      'vouchers:edit',
      'vouchers:toggle_status',
      'transactions:view',
      'posts:view',
      'posts:create',
      'posts:edit',
      'users:view',
      'users:view_detail',
      'staff:view',
      'branches:view',
      'branches:edit',
      'uploads:view',
      'uploads:upload',
      'ticket_check:scan',
      'ticket_check:validate',
      'ticket_check:history'
    ]
  },
  {
    name: 'admin',
    description: 'Quản trị viên — toàn quyền trừ system settings và xóa branches',
    isSystem: true,
    level: 2,
    permissions: [
      'dashboard:view',
      'dashboard:view_revenue',
      'movies:view',
      'movies:create',
      'movies:edit',
      'movies:delete',
      'movies:toggle_status',
      'movies:view_deleted',
      'movies:restore',
      'showtimes:view',
      'showtimes:create',
      'showtimes:edit',
      'showtimes:delete',
      'tickets:view',
      'tickets:create',
      'tickets:edit',
      'tickets:toggle_status',
      'tickets:delete',
      'tickets:view_deleted',
      'tickets:restore',
      'toys:view',
      'toys:create',
      'toys:edit',
      'toys:delete',
      'toys:view_deleted',
      'toys:restore',
      'vouchers:view',
      'vouchers:create',
      'vouchers:edit',
      'vouchers:toggle_status',
      'vouchers:delete',
      'vouchers:view_deleted',
      'vouchers:restore',
      'transactions:view',
      'branches:view',
      'branches:edit',
      'branches:toggle_status',
      'branches:view_deleted',
      'branches:restore',
      'posts:view',
      'posts:create',
      'posts:edit',
      'posts:delete',
      'users:view',
      'users:view_detail',
      'staff:view',
      'staff:create',
      'staff:edit',
      'staff:delete',
      'staff:reset_password',
      'staff:view_deleted',
      'staff:restore',
      'roles:view',
      'roles:view_deleted',
      'roles:restore',
      'email_logs:view',
      'uploads:view',
      'uploads:upload',
      'uploads:delete',
      'ticket_check:scan',
      'ticket_check:validate',
      'ticket_check:history',
      'audit_logs:view'
    ]
  }
];
