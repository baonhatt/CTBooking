import { describe, it, expect } from 'vitest';
import {
  auditChanges,
  auditNote,
  describeListChange,
  formatAuditValue,
  isAuditRecord,
  readableAuditJson,
  EMPTY_AUDIT_VALUE
} from './audit-diff';

// The branch update from the admin log: settings saved as JSON text, email from null to ""
const BRANCH_BEFORE = JSON.stringify({ id: 4, name: 'HCM | CN Tân Phú', email: null, settings: null, updated_at: '2026-11-24' });
const BRANCH_AFTER = JSON.stringify({
  id: 4,
  name: 'HCM | CN Tân Phú',
  email: '',
  updated_at: '2026-11-25',
  settings: JSON.stringify({
    company_name: '',
    hotline: '',
    show_zalo_button: true,
    payment_config: { bank_name: 'VCB', account_number: '1071994917', qr_code_url: '' },
    extra_info: [
      { label: 'Tên người đại diện', value: '' },
      { label: 'Số ĐKKD', value: '0319157654' }
    ]
  })
});

describe('auditChanges: one row per changed field', () => {
  it('opens JSON text columns and keeps only the fields that changed', () => {
    const changes = auditChanges(BRANCH_BEFORE, BRANCH_AFTER);
    expect(changes.map((change) => change.label)).toEqual([
      'Cấu hình › Nút chat Zalo',
      'Cấu hình › Thanh toán › Tên ngân hàng',
      'Cấu hình › Thanh toán › Số tài khoản',
      'Cấu hình › Thông tin pháp lý › Số ĐKKD'
    ]);
    const bank = changes.find((change) => change.path === 'settings.payment_config.bank_name');
    expect(bank?.oldValue).toBeUndefined();
    expect(bank?.newValue).toBe('VCB');
  });

  it('null, "" and a missing field are the same empty value', () => {
    const changes = auditChanges(BRANCH_BEFORE, BRANCH_AFTER);
    expect(changes.some((change) => change.path === 'email')).toBe(false);
    expect(changes.some((change) => change.path === 'settings.company_name')).toBe(false);
  });

  it('bookkeeping fields (id, created_at, updated_at ...) never show', () => {
    const changes = auditChanges(BRANCH_BEFORE, BRANCH_AFTER);
    expect(changes.some((change) => change.path === 'updated_at' || change.path === 'id')).toBe(false);
  });

  it('a sentence ("Tạo phim: ...") is a note, not a record: it adds no change rows', () => {
    expect(auditNote('Tạo phim: Núi tuyết')).toBe('Tạo phim: Núi tuyết');
    expect(isAuditRecord('Tạo phim: Núi tuyết')).toBe(false);
    expect(auditNote('{"title":"Núi tuyết"}')).toBe('');
    expect(auditChanges('Tạo phim: Núi tuyết', '{"title":"Núi tuyết"}')).toEqual([
      { path: 'title', label: 'Tiêu đề', field: 'title', oldValue: undefined, newValue: 'Núi tuyết' }
    ]);
  });

  it('a switch off on one side and not written on the other is no change (check-in log)', () => {
    const changes = auditChanges('{"is_used":false,"expired":false}', '{"is_used":true}');
    expect(changes.map((change) => change.label)).toEqual(['Đã dùng']);
  });

  it('branch ids in a note read as branch names', () => {
    expect(auditNote('Sao chép 24 suất từ chi nhánh #2 sang #1', { 2: 'HCM | Vạn Hạnh', 1: 'HN | Hà Đông' })).toBe(
      'Sao chép 24 suất từ chi nhánh HCM | Vạn Hạnh sang HN | Hà Đông'
    );
    expect(auditNote('Tạo suất chiếu 10:00-10:30 (phim #34) chi nhánh #9', {})).toBe('Tạo suất chiếu 10:00-10:30 (phim #34) chi nhánh #9');
  });

  it('1/0 and true/false are the same switch', () => {
    expect(auditChanges('{"is_active":1}', '{"is_active":true}')).toEqual([]);
    expect(auditChanges('{"is_active":1}', '{"is_active":false}')).toHaveLength(1);
  });

  it('lists are compared as a whole value', () => {
    const changes = auditChanges('{"branch_ids":[1,2]}', '{"branch_ids":[1,3]}');
    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe('Chi nhánh áp dụng');
  });
});

describe('formatAuditValue', () => {
  it('writes values the way the admin screens do', () => {
    expect(formatAuditValue('is_active', true)).toBe('Có');
    expect(formatAuditValue('is_member_only', 0)).toBe('Không');
    expect(formatAuditValue('show_zalo_button', false)).toBe('Tắt');
    expect(formatAuditValue('price', 200000)).toBe(`${(200000).toLocaleString('vi-VN')} đ`);
    expect(formatAuditValue('email', '')).toBe(EMPTY_AUDIT_VALUE);
    expect(formatAuditValue('genres', ['Hành động', 'Khoa học'])).toBe('Hành động, Khoa học');
    expect(formatAuditValue('type', 'vr')).toBe('VR');
    expect(formatAuditValue('discount_type', 'fixed')).toBe('Số tiền cố định');
    expect(formatAuditValue('status', 'published')).toBe('Đã đăng');
  });

  it('shows branch names for branch ids, and #id when the name is unknown', () => {
    expect(formatAuditValue('branch_ids', [2, 9], { 2: 'HCM | CN Vạn Hạnh Mall' })).toBe('HCM | CN Vạn Hạnh Mall, #9');
  });

  it('reads the branch, movie and package scope fields of packages and vouchers', () => {
    expect(formatAuditValue('all_branches', 1)).toBe('Có');
    expect(formatAuditValue('all_packages', false)).toBe('Không');
    expect(formatAuditValue('movie_scope', 'all_at_branch')).toBe('Mọi phim của chi nhánh');
    expect(formatAuditValue('movie_scope', 'selected')).toBe('Phim đã chọn');
    const changes = auditChanges(
      '{"all_branches":false,"movie_scope":"selected"}',
      '{"all_branches":true,"movie_scope":"all_at_branch"}'
    );
    expect(changes.map((change) => change.label)).toEqual(['Tất cả chi nhánh', 'Phim áp dụng']);
    const labels = auditChanges(
      '{"movie_ids":[1],"package_ids":[2],"all_packages":true}',
      '{"movie_ids":[1,3],"package_ids":[2,4],"all_packages":false}'
    ).map((change) => change.label);
    expect(labels).toEqual(['Phim', 'Gói áp dụng', 'Tất cả gói']);
  });

  it('keeps the labels of fields that only old log rows have', () => {
    const labels = auditChanges('{"combo":[1],"applicable_ticket_package_ids":null}', '{"combo":[1,2],"applicable_ticket_package_ids":[3]}').map(
      (change) => change.label
    );
    expect(labels).toEqual(['Combo', 'Gói vé áp dụng']);
  });

  it('cuts long text', () => {
    const text = 'a'.repeat(400);
    expect(formatAuditValue('content', text).length).toBe(301);
  });
});

describe('every kind of log line the server writes', () => {
  it('payment confirmation: status in words, staff shown by field name', () => {
    const changes = auditChanges('{"payment_status":"pending"}', '{"payment_status":"paid","confirmed_by_staff_id":3}');
    expect(changes.map((change) => change.label)).toEqual(['Trạng thái thanh toán', 'Nhân viên xác nhận']);
    expect(formatAuditValue('payment_status', 'paid')).toBe('Đã thanh toán');
  });

  it('SePay warning: a sentence note plus amounts in money format', () => {
    const before = 'Đơn #5 nhận 300000, cần 350000 (mã giao dịch FT1).';
    const after = '{"pay_txt_code":"CS482913057741","amount_received":300000,"amount_needed":350000,"bank_ref":"FT1"}';
    expect(auditNote(before)).toContain('Đơn #5');
    const labels = auditChanges(before, after).map((change) => change.label);
    expect(labels).toEqual(['Mã thanh toán', 'Số tiền nhận', 'Số tiền cần', 'Mã giao dịch ngân hàng']);
    expect(formatAuditValue('amount_received', 300000)).toBe(`${(300000).toLocaleString('vi-VN')} đ`);
  });

  it('OTP settings: nested settings opened, switch in words', () => {
    const before = '{"admin_otp_settings":{"enable_2fa":true,"otp_length":6}}';
    const after = '{"admin_otp_settings":{"enable_2fa":false,"otp_length":6}}';
    const changes = auditChanges(before, after);
    expect(changes.map((change) => change.label)).toEqual(['OTP nhân viên › Xác thực 2 lớp']);
    expect(formatAuditValue('enable_2fa', false)).toBe('Tắt');
  });

  it('showtimes copy: the replaced list reads as times', () => {
    const replaced = '[{"id":1,"start_time":"10:00","end_time":"10:30"},{"id":2,"start_time":"11:00","end_time":"11:30"}]';
    expect(isAuditRecord(replaced)).toBe(true);
    const [change] = auditChanges(replaced, null);
    expect(change.label).toBe('Danh sách');
    expect(formatAuditValue(change.field, change.oldValue)).toBe('10:00–10:30, 11:00–11:30');
    expect(readableAuditJson(replaced)).toContain('"start_time": "10:00"');
  });

  it('resolved action item: how in words', () => {
    const [how] = auditChanges('Đã xử lý (confirmed): Nhân viên xác nhận vé', '{"note":"Nhân viên xác nhận vé","how":"confirmed"}').filter(
      (change) => change.field === 'how'
    );
    expect(formatAuditValue(how.field, how.newValue)).toBe('Xác nhận vé');
  });

  it('customer lock: reason and switch', () => {
    const changes = auditChanges('{"fullname":"Lan","is_active":true}', '{"fullname":"Lan","is_active":false,"reason":"spam"}');
    expect(changes.map((change) => change.label)).toEqual(['Đang hoạt động', 'Lý do']);
  });

  it('list of ids: what was added and removed', () => {
    expect(describeListChange('permissionIds', [1, 2, 3], [2, 3, 5, 7])).toBe('Thêm: #5, #7 · Bỏ: #1');
    expect(describeListChange('branch_ids', [2], [2, 3], { 3: 'BD' })).toBe('Thêm: BD');
    expect(describeListChange('name', 'a', 'b')).toBe('');
  });
});

describe('readableAuditJson', () => {
  it('opens JSON text columns in the raw view', () => {
    const raw = readableAuditJson(BRANCH_AFTER);
    expect(raw).toContain('"bank_name": "VCB"');
    expect(raw).not.toContain('\\"bank_name\\"');
  });
});
