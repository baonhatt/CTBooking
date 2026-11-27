import { formatVnd, formatVnDateTime } from '@/lib/format';

/**
 * Field-by-field changes of one audit log line, as people read them.
 *
 * The log keeps the record before and after as JSON (old_values / new_values). Some columns hold JSON themselves
 * (branch "settings", lists of ids), so comparing whole columns showed one long block for a one-field change.
 * Here both sides are flattened into leaf fields ("settings › Thanh toán › Ngân hàng"), only the fields that really
 * changed are kept (null, "" and a missing field count as the same empty value), and each value is written the way
 * the admin screens write it (Có/Không, money, dates, branch names).
 *
 * In this file, in order: CONSTANTS (ignored fields, labels), FLATTEN, COMPARE, FORMAT.
 */

// ================================================================================================================
// CONSTANTS
// ================================================================================================================

/** Bookkeeping fields that change on every save and say nothing about what the person did */
const IGNORED_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'createdAt',
  'updatedAt',
  'deleted_at',
  'deletedAt',
  'deleted_by_staff_id',
  'lastLoginAt',
  'view_count',
  'used_count'
]);

/** Field names in Vietnamese. One table for every module: the same column name means the same thing everywhere. */
const FIELD_LABELS: Record<string, string> = {
  // common
  name: 'Tên',
  title: 'Tiêu đề',
  code: 'Mã',
  description: 'Mô tả',
  email: 'Email',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  is_active: 'Đang hoạt động',
  isActive: 'Đang hoạt động',
  is_default: 'Chi nhánh mặc định',
  is_open: 'Đang mở cửa',
  branch_id: 'Chi nhánh',
  branch_ids: 'Chi nhánh áp dụng',
  branchIds: 'Chi nhánh',
  all_branches: 'Tất cả chi nhánh',
  display_order: 'Thứ tự hiển thị',
  cover_image: 'Ảnh bìa',
  type: 'Loại',
  status: 'Trạng thái',
  price: 'Giá',
  // branch
  banner_images: 'Ảnh banner',
  settings: 'Cấu hình',
  company_name: 'Tên công ty',
  company_address: 'Địa chỉ công ty',
  hotline: 'Hotline',
  map_query: 'Địa điểm bản đồ',
  map_coords: 'Link / tọa độ Google Maps',
  show_zalo_button: 'Nút chat Zalo',
  show_phone_button: 'Nút gọi điện',
  ticket_expiry_days: 'Thời hạn sử dụng vé (ngày)',
  payment_config: 'Thanh toán',
  qr_code_url: 'Link ảnh QR',
  bank_name: 'Tên ngân hàng',
  bank_code: 'Mã ngân hàng',
  account_number: 'Số tài khoản',
  account_name: 'Chủ tài khoản',
  extra_info: 'Thông tin pháp lý',
  // movie
  genres: 'Thể loại',
  duration_min: 'Thời lượng (phút)',
  rating: 'Đánh giá',
  release_date: 'Ngày phát hành',
  detail_images: 'Ảnh chi tiết',
  // ticket package (combo: old log rows from before movie_scope / movie_ids)
  combo: 'Combo',
  movie_scope: 'Phim áp dụng',
  movie_ids: 'Phim',
  features: 'Đặc điểm',
  is_member_only: 'Chỉ dành cho hội viên',
  min_group_size: 'Số người tối thiểu',
  max_group_size: 'Số người tối đa',
  min_players: 'Số người chơi tối thiểu',
  max_players: 'Số người chơi tối đa',
  vr_genre: 'Thể loại VR',
  // voucher
  discount_type: 'Kiểu giảm',
  discount_value: 'Mức giảm',
  max_discount: 'Giảm tối đa',
  min_order_value: 'Đơn tối thiểu',
  usage_limit: 'Số lượt dùng tối đa',
  per_user_limit: 'Số lượt mỗi khách',
  valid_from: 'Hiệu lực từ',
  valid_until: 'Hiệu lực đến',
  scope: 'Phạm vi',
  // applicable_ticket_package_ids: old log rows from before all_packages / package_ids
  applicable_ticket_package_ids: 'Gói vé áp dụng',
  package_ids: 'Gói áp dụng',
  all_packages: 'Tất cả gói',
  excluded_ticket_package_ids: 'Gói vé loại trừ',
  applicable_user_ids: 'Khách hàng áp dụng',
  // post
  slug: 'Đường dẫn',
  excerpt: 'Tóm tắt',
  content: 'Nội dung',
  featured_image: 'Ảnh đại diện',
  is_featured: 'Bài nổi bật',
  published_at: 'Ngày đăng',
  seo_title: 'Tiêu đề SEO',
  meta_description: 'Mô tả SEO',
  meta_keywords: 'Từ khóa SEO',
  canonical_url: 'Link canonical',
  og_image: 'Ảnh chia sẻ',
  schema_type: 'Kiểu schema',
  author_id: 'Tác giả',
  // staff and role
  fullname: 'Họ tên',
  avatar: 'Ảnh đại diện',
  isSuperAdmin: 'Siêu quản trị',
  forcePasswordChange: 'Bắt đổi mật khẩu',
  roleIds: 'Vai trò',
  permissionIds: 'Quyền',
  isSystem: 'Vai trò hệ thống',
  level: 'Cấp',
  // site media
  section: 'Vị trí',
  url: 'Đường dẫn file',
  public_id: 'Mã file',
  format: 'Định dạng',
  width: 'Chiều rộng',
  height: 'Chiều cao',
  duration: 'Thời lượng',
  // booking, payment and bank transfers
  payment_status: 'Trạng thái thanh toán',
  confirmed_by_staff_id: 'Nhân viên xác nhận',
  forced_by: 'Duyệt bởi',
  pay_txt_code: 'Mã thanh toán',
  booking_id: 'Đơn',
  amount: 'Số tiền',
  amount_received: 'Số tiền nhận',
  amount_needed: 'Số tiền cần',
  bank_ref: 'Mã giao dịch ngân hàng',
  reason: 'Lý do',
  note: 'Ghi chú',
  how: 'Cách xử lý',
  list: 'Danh sách',
  // OTP settings
  otp_settings: 'OTP khách hàng',
  admin_otp_settings: 'OTP nhân viên',
  enable_2fa: 'Xác thực 2 lớp',
  otp_expiry_minutes: 'Hiệu lực mã (phút)',
  otp_length: 'Số chữ số của mã',
  otp_resend_cooldown_seconds: 'Chờ gửi lại (giây)',
  max_otp_attempts: 'Số lần nhập sai tối đa',
  // booking and showtimes
  is_used: 'Đã dùng',
  expired: 'Hết hạn',
  movie_id: 'Phim',
  start_time: 'Giờ bắt đầu',
  end_time: 'Giờ kết thúc'
};

/** Code values shown in words (the same code can mean different things in different fields) */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  type: { movie: 'Phim', vr: 'VR' },
  scope: { all: 'Tất cả', movie: 'Gói phim', vr: 'Gói VR' },
  movie_scope: { selected: 'Phim đã chọn', all_at_branch: 'Mọi phim của chi nhánh' },
  discount_type: { percent: 'Phần trăm', fixed: 'Số tiền cố định' },
  status: { draft: 'Nháp', published: 'Đã đăng', archived: 'Lưu trữ' },
  payment_status: {
    paid: 'Đã thanh toán',
    pending: 'Chờ thanh toán',
    cancelled: 'Đã hủy',
    expired: 'Hết hạn',
    failed: 'Thất bại',
    refunded: 'Đã hoàn tiền'
  },
  how: {
    handled: 'Đã xử lý',
    confirmed: 'Xác nhận vé',
    resent: 'Gửi lại email',
    paid: 'Đơn đã thanh toán',
    sent_later: 'Đã gửi lại thành công'
  }
};

/** Money fields, written as 200.000 đ */
const MONEY_FIELDS = new Set(['price', 'max_discount', 'min_order_value', 'total_price', 'amount', 'amount_received', 'amount_needed']);

/** Date-time fields, written as 10/11/2026 14:05 */
const DATE_FIELDS = new Set(['valid_from', 'valid_until', 'published_at', 'release_date']);

/** Switches that are shown as Bật/Tắt rather than Có/Không */
const SWITCH_FIELDS = new Set(['show_zalo_button', 'show_phone_button', 'enable_2fa']);

/** Fields that hold branch ids, shown as branch names when the names are known */
const BRANCH_FIELDS = new Set(['branch_id', 'branch_ids', 'branchIds']);

/** Long text is cut here in the table; the full value is in "Xem dữ liệu gốc" */
const LONG_TEXT_LIMIT = 300;

const PATH_SEPARATOR = ' › ';

// ================================================================================================================
// FLATTEN
// ================================================================================================================

export type AuditChange = {
  /** Stable key of the field, e.g. settings.payment_config.bank_name */
  path: string;
  /** The same path in Vietnamese, e.g. Cấu hình › Thanh toán › Tên ngân hàng */
  label: string;
  oldValue: unknown;
  newValue: unknown;
  /** The last field name, used to pick the value format */
  field: string;
};

type Leaf = { label: string; field: string; value: unknown };

/** A JSON column is sometimes saved as text ("{...}" or "[...]"): read it as the object it is */
function readJsonText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!(text.startsWith('{') || text.startsWith('['))) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

/** True when a saved before/after value is a record (JSON object or list); some logs keep a sentence there instead */
export function isAuditRecord(text?: string | null): boolean {
  if (!text) return false;
  const parsed = readJsonText(text);
  return Boolean(parsed && typeof parsed === 'object');
}

/**
 * The sentence a log keeps instead of a record ("Tạo phim: Núi tuyết"), or '' when it holds a record.
 * Branch ids written in it ("chi nhánh #2") are replaced by the branch names when known.
 */
export function auditNote(text?: string | null, branchNames: Record<number, string> = {}): string {
  if (!text || isAuditRecord(text)) return '';
  // "chi nhánh #2", and "sang #1" in "Sao chép ... từ chi nhánh #2 sang #1"
  return text
    .trim()
    .replace(/(chi nhánh|sang) #(\d+)/gi, (whole, word, id) => (branchNames[Number(id)] ? `${word} ${branchNames[Number(id)]}` : whole));
}

/** The saved before/after value of a log line as a record; a sentence counts as no record (see auditNote) */
export function parseAuditValues(text?: string | null): Record<string, unknown> {
  if (!isAuditRecord(text)) return {};
  const parsed = readJsonText(text);
  // A list saved on its own (the showtimes a copy replaced) becomes one "Danh sách" field
  return Array.isArray(parsed) ? { list: parsed } : (parsed as Record<string, unknown>);
}

function labelOf(field: string): string {
  return FIELD_LABELS[field] || field;
}

/** A list of {label, value} rows (legal info) is keyed by its own labels, which are already Vietnamese */
function isLabelledRows(value: unknown[]): value is Array<{ label: string; value: unknown }> {
  return value.length > 0 && value.every((row) => row && typeof row === 'object' && typeof (row as any).label === 'string');
}

function flattenInto(leaves: Map<string, Leaf>, path: string, label: string, field: string, rawValue: unknown) {
  const value = readJsonText(rawValue);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [childField, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (IGNORED_FIELDS.has(childField)) continue;
      flattenInto(
        leaves,
        path ? `${path}.${childField}` : childField,
        label ? `${label}${PATH_SEPARATOR}${labelOf(childField)}` : labelOf(childField),
        childField,
        childValue
      );
    }
    return;
  }
  if (Array.isArray(value) && isLabelledRows(value)) {
    for (const row of value) {
      const rowLabel = row.label.trim() || '(không tên)';
      flattenInto(leaves, `${path}[${rowLabel}]`, `${label}${PATH_SEPARATOR}${rowLabel}`, 'value', row.value);
    }
    return;
  }
  leaves.set(path, { label, field, value });
}

function flatten(values: Record<string, unknown>): Map<string, Leaf> {
  const leaves = new Map<string, Leaf>();
  for (const [field, value] of Object.entries(values)) {
    if (IGNORED_FIELDS.has(field)) continue;
    flattenInto(leaves, field, labelOf(field), field, value);
  }
  return leaves;
}

// ================================================================================================================
// COMPARE
// ================================================================================================================

/** null, undefined, "" and [] are all "nothing there", so null -> "" is not a change */
function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

function sameValue(first: unknown, second: unknown): boolean {
  if (isEmptyValue(first) && isEmptyValue(second)) return true;
  // A switch that is off on one side and not written on the other did not change (a check-in log only writes is_used)
  if ((first === false && second === undefined) || (first === undefined && second === false)) return true;
  // 1/0 and true/false are the same switch (some tables store booleans as numbers)
  if (typeof first === 'boolean' || typeof second === 'boolean') {
    const asBool = (value: unknown) => (value === 1 || value === '1' ? true : value === 0 || value === '0' ? false : value);
    return asBool(first) === asBool(second);
  }
  return JSON.stringify(first) === JSON.stringify(second);
}

/** The fields that changed between the saved "before" and "after", in the order they appear in the record */
export function auditChanges(oldText?: string | null, newText?: string | null): AuditChange[] {
  const before = flatten(parseAuditValues(oldText));
  const after = flatten(parseAuditValues(newText));
  const paths = [...new Set([...before.keys(), ...after.keys()])];
  const changes: AuditChange[] = [];
  for (const path of paths) {
    const oldLeaf = before.get(path);
    const newLeaf = after.get(path);
    if (sameValue(oldLeaf?.value, newLeaf?.value)) continue;
    const leaf = (newLeaf || oldLeaf) as Leaf;
    changes.push({ path, label: leaf.label, field: leaf.field, oldValue: oldLeaf?.value, newValue: newLeaf?.value });
  }
  return changes;
}

/** Both sides with JSON text columns opened up, for the "Xem dữ liệu gốc" view */
export function readableAuditJson(text?: string | null): string {
  if (!text) return '';
  const parsed = readJsonText(text);
  if (!parsed || typeof parsed !== 'object') return text;
  if (Array.isArray(parsed)) return JSON.stringify(parsed, null, 2);
  const opened = Object.fromEntries(Object.entries(parsed).map(([field, value]) => [field, readJsonText(value)]));
  return JSON.stringify(opened, null, 2);
}

// ================================================================================================================
// FORMAT
// ================================================================================================================

export const EMPTY_AUDIT_VALUE = '(trống)';

/** One item of a list: a showtime as "10:00–10:30", a record by its name/title/code, an id as #id, text as it is */
function listItemText(item: unknown): string {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    if (record.start_time && record.end_time) return `${record.start_time}–${record.end_time}`;
    const name = record.name || record.title || record.code || record.label;
    return name ? String(name) : JSON.stringify(item);
  }
  return typeof item === 'number' ? `#${item}` : String(item);
}

/**
 * For a list of ids or words that changed (permissions, roles, packages, genres): what was added and what was
 * removed, e.g. "Thêm: #5, #7 · Bỏ: #3". Empty when either side is not such a list. Branch lists use branch names.
 */
export function describeListChange(field: string, oldValue: unknown, newValue: unknown, branchNames: Record<number, string> = {}): string {
  const asList = (value: unknown) => (isEmptyValue(value) ? [] : Array.isArray(value) ? value : null);
  const before = asList(oldValue);
  const after = asList(newValue);
  if (!before || !after || before.length + after.length === 0) return '';
  if ([...before, ...after].some((item) => item && typeof item === 'object')) return '';
  const name = (item: unknown) =>
    BRANCH_FIELDS.has(field) ? branchNames[Number(item)] || `#${item}` : typeof item === 'number' ? `#${item}` : String(item);
  const beforeKeys = new Set(before.map(String));
  const afterKeys = new Set(after.map(String));
  const added = after.filter((item) => !beforeKeys.has(String(item))).map(name);
  const removed = before.filter((item) => !afterKeys.has(String(item))).map(name);
  return [added.length ? `Thêm: ${added.join(', ')}` : '', removed.length ? `Bỏ: ${removed.join(', ')}` : '']
    .filter(Boolean)
    .join(' · ');
}

/**
 * One value as text for the change table. branchNames maps branch id -> name; unknown ids keep "#id".
 * Long text is cut (the full value is in the raw view).
 */
export function formatAuditValue(field: string, value: unknown, branchNames: Record<number, string> = {}): string {
  if (isEmptyValue(value)) return EMPTY_AUDIT_VALUE;

  if (BRANCH_FIELDS.has(field)) {
    const ids = Array.isArray(value) ? value : [value];
    return ids.map((id) => branchNames[Number(id)] || `#${id}`).join(', ');
  }
  if (typeof value === 'boolean' || ((value === 0 || value === 1) && /^(is_|show_|is[A-Z]|force|all_)/.test(field))) {
    const on = value === true || value === 1;
    if (SWITCH_FIELDS.has(field)) return on ? 'Bật' : 'Tắt';
    return on ? 'Có' : 'Không';
  }
  if (MONEY_FIELDS.has(field) && Number.isFinite(Number(value))) return formatVnd(Number(value));
  if (typeof value === 'string' && VALUE_LABELS[field]?.[value]) return VALUE_LABELS[field][value];
  if (DATE_FIELDS.has(field) && typeof value === 'string') {
    const formatted = formatVnDateTime(value);
    return formatted === '-' ? value : formatted;
  }
  if (Array.isArray(value)) {
    return value.map((item) => listItemText(item)).join(', ');
  }
  if (value && typeof value === 'object') return JSON.stringify(value);

  const text = String(value);
  return text.length > LONG_TEXT_LIMIT ? `${text.slice(0, LONG_TEXT_LIMIT)}…` : text;
}
