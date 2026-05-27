export const PERMISSIONS_SEED = [
	// Dashboard
	{ module: 'dashboard', action: 'view', description: 'Xem dashboard' },
	{ module: 'dashboard', action: 'view_revenue', description: 'Xem doanh thu' },

	// Movies
	{ module: 'movies', action: 'view', description: 'Xem danh sách phim' },
	{ module: 'movies', action: 'create', description: 'Thêm phim mới' },
	{ module: 'movies', action: 'edit', description: 'Sửa thông tin phim' },
	{ module: 'movies', action: 'delete', description: 'Xóa phim' },
	{ module: 'movies', action: 'toggle_status', description: 'Bật/tắt trạng thái phim' },

	// Tickets
	{ module: 'tickets', action: 'view', description: 'Xem gói vé' },
	{ module: 'tickets', action: 'create', description: 'Thêm gói vé' },
	{ module: 'tickets', action: 'edit', description: 'Sửa gói vé' },
	{ module: 'tickets', action: 'delete', description: 'Xóa gói vé' },

	// Toys
	{ module: 'toys', action: 'view', description: 'Xem merchandise' },
	{ module: 'toys', action: 'create', description: 'Thêm merchandise' },
	{ module: 'toys', action: 'edit', description: 'Sửa merchandise' },
	{ module: 'toys', action: 'delete', description: 'Xóa merchandise' },

	// Transactions
	{ module: 'transactions', action: 'view', description: 'Xem giao dịch' },
	{ module: 'transactions', action: 'refund', description: 'Hoàn tiền' },
	{ module: 'transactions', action: 'export', description: 'Xuất báo cáo' },

	// Branches
	{ module: 'branches', action: 'view', description: 'Xem chi nhánh' },
	{ module: 'branches', action: 'create', description: 'Thêm chi nhánh' },
	{ module: 'branches', action: 'edit', description: 'Sửa chi nhánh' },
	{ module: 'branches', action: 'delete', description: 'Xóa chi nhánh' },

	// Posts
	{ module: 'posts', action: 'view', description: 'Xem bài viết' },
	{ module: 'posts', action: 'create', description: 'Thêm bài viết' },
	{ module: 'posts', action: 'edit', description: 'Sửa bài viết' },
	{ module: 'posts', action: 'delete', description: 'Xóa bài viết' },
	{ module: 'posts', action: 'publish', description: 'Xuất bản bài viết' },

	// Users (khách hàng)
	{ module: 'users', action: 'view', description: 'Xem danh sách khách hàng' },
	{ module: 'users', action: 'view_detail', description: 'Xem chi tiết khách hàng' },

	// Staff
	{ module: 'staff', action: 'view', description: 'Xem danh sách nhân viên' },
	{ module: 'staff', action: 'create', description: 'Thêm nhân viên' },
	{ module: 'staff', action: 'edit', description: 'Sửa thông tin nhân viên' },
	{ module: 'staff', action: 'delete', description: 'Xóa nhân viên' },
	{ module: 'staff', action: 'reset_password', description: 'Reset mật khẩu nhân viên' },

	// Roles
	{ module: 'roles', action: 'view', description: 'Xem danh sách roles' },
	{ module: 'roles', action: 'create', description: 'Tạo role mới' },
	{ module: 'roles', action: 'edit', description: 'Sửa role' },
	{ module: 'roles', action: 'delete', description: 'Xóa role' },

	// Settings
	{ module: 'settings', action: 'view', description: 'Xem cài đặt' },
	{ module: 'settings', action: 'manage', description: 'Quản lý cài đặt hệ thống' },

	// Email Logs
	{ module: 'email_logs', action: 'view', description: 'Xem log email' },
	{ module: 'email_logs', action: 'resend', description: 'Gửi lại email' },

	// Uploads
	{ module: 'uploads', action: 'view', description: 'Xem file upload' },
	{ module: 'uploads', action: 'upload', description: 'Upload file' },
	{ module: 'uploads', action: 'delete', description: 'Xóa file' },

	// Ticket Check
	{ module: 'ticket_check', action: 'scan', description: 'Quét vé' },
	{ module: 'ticket_check', action: 'validate', description: 'Xác nhận vé hợp lệ' },
	{ module: 'ticket_check', action: 'history', description: 'Xem lịch sử check-in' },

	// Audit
	{ module: 'audit', action: 'view', description: 'Xem audit logs' },
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
			'ticket_check:history',
		],
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
			'tickets:view',
			'tickets:create',
			'tickets:edit',
			'toys:view',
			'toys:create',
			'toys:edit',
			'transactions:view',
			'posts:view',
			'posts:create',
			'posts:edit',
			'posts:publish',
			'users:view',
			'users:view_detail',
			'staff:view',
			'uploads:view',
			'uploads:upload',
			'ticket_check:scan',
			'ticket_check:validate',
			'ticket_check:history',
		],
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
			'tickets:view',
			'tickets:create',
			'tickets:edit',
			'tickets:delete',
			'toys:view',
			'toys:create',
			'toys:edit',
			'toys:delete',
			'transactions:view',
			'transactions:refund',
			'transactions:export',
			'branches:view',
			'posts:view',
			'posts:create',
			'posts:edit',
			'posts:delete',
			'posts:publish',
			'users:view',
			'users:view_detail',
			'staff:view',
			'staff:create',
			'staff:edit',
			'staff:delete',
			'staff:reset_password',
			'roles:view',
			'email_logs:view',
			'email_logs:resend',
			'uploads:view',
			'uploads:upload',
			'uploads:delete',
			'ticket_check:scan',
			'ticket_check:validate',
			'ticket_check:history',
			'audit:view',
		],
	},
];
