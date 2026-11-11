// Design tokens shared by every admin module. Change a value here and all modules follow.
// Rule: buttons rounded-xl, cards rounded-xl, modals rounded-2xl, primary colour = blue-600.

// Toolbar buttons (search, add, refresh) - 40px high
export const ADMIN_BTN_PRIMARY =
  'h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all';
export const ADMIN_BTN_OUTLINE =
  'h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all';
export const ADMIN_BTN_DANGER =
  'h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm shadow-red-500/20 hover:bg-red-700 active:scale-95 transition-all';
export const ADMIN_BTN_GHOST = 'h-10 rounded-xl px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 transition-all';

// Cards and tables
export const ADMIN_CARD = 'rounded-xl border border-slate-200 bg-white shadow-sm';
export const ADMIN_TABLE_HEAD = 'bg-slate-50 border-b border-slate-200';
export const ADMIN_TH = 'text-xs font-bold uppercase tracking-wide text-slate-500';

// Form controls inside modals
export const ADMIN_INPUT =
  'h-10 rounded-xl border-slate-300 text-sm focus-visible:ring-2 focus-visible:ring-blue-600/20 focus-visible:border-blue-600';

// Standard wording so every module says the same thing
export const ADMIN_TEXT = {
  cancel: 'Hủy',
  save: 'Lưu',
  create: 'Tạo mới',
  close: 'Đóng',
  edit: 'Chỉnh sửa',
  view: 'Xem chi tiết',
  delete: 'Xóa',
  restore: 'Khôi phục',
  refresh: 'Làm mới',
  search: 'Tìm kiếm',
  actionColumn: 'Thao tác',
  busy: 'Đang xử lý...',
  loading: 'Đang tải dữ liệu...',
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
} as const;
