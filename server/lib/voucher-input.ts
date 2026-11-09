// Checks for voucher input, shared by create and edit, and the branch rule for staff who are limited to some branches.

export const VOUCHER_DISCOUNT_TYPES = ['percent', 'fixed'];
export const VOUCHER_SCOPES = ['vr', 'movie', 'all'];

/** A deliberate refusal. statusCode is read by the routes. */
function refusal(statusCode: number, message: string): Error {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** The voucher values as they will be after the change: for an edit, the saved values with the new ones laid over. */
export interface VoucherFields {
  discount_type?: unknown;
  discount_value?: unknown;
  scope?: unknown;
  min_order_value?: unknown;
  max_discount?: unknown;
  usage_limit?: unknown;
  per_user_limit?: unknown;
  valid_from?: unknown;
  valid_until?: unknown;
}

const isMissing = (value: unknown) => value === undefined || value === null || value === '';

/** A number that is given must be a real number, not below zero. */
function assertNotNegative(value: unknown, label: string) {
  if (isMissing(value)) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw refusal(400, label + ' không hợp lệ');
}

/** A count that is given must be a whole number, not below zero. */
function assertWholeNotNegative(value: unknown, label: string) {
  if (isMissing(value)) return;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw refusal(400, label + ' không hợp lệ');
}

function parseDate(value: unknown, label: string): number | null {
  if (isMissing(value)) return null;
  const time = new Date(String(value)).getTime();
  if (Number.isNaN(time)) throw refusal(400, label + ' không hợp lệ');
  return time;
}

/** Throws a 400 when the voucher values make no sense. */
export function validateVoucherFields(fields: VoucherFields) {
  if (!VOUCHER_DISCOUNT_TYPES.includes(String(fields.discount_type))) {
    throw refusal(400, 'Loại giảm giá không hợp lệ');
  }
  if (!VOUCHER_SCOPES.includes(String(fields.scope))) {
    throw refusal(400, 'Phạm vi áp dụng không hợp lệ');
  }

  const discountValue = Number(fields.discount_value);
  if (isMissing(fields.discount_value) || !Number.isFinite(discountValue) || discountValue <= 0) {
    throw refusal(400, 'Giá trị giảm giá không hợp lệ');
  }
  if (fields.discount_type === 'percent' && discountValue > 100) {
    throw refusal(400, 'Phần trăm giảm không được vượt quá 100%');
  }

  assertNotNegative(fields.min_order_value, 'Giá trị đơn tối thiểu');
  assertNotNegative(fields.max_discount, 'Mức giảm tối đa');
  assertWholeNotNegative(fields.usage_limit, 'Số lượt dùng tối đa');
  assertWholeNotNegative(fields.per_user_limit, 'Số lượt dùng mỗi khách');

  const validFrom = parseDate(fields.valid_from, 'Ngày bắt đầu');
  const validUntil = parseDate(fields.valid_until, 'Ngày kết thúc');
  if (validFrom !== null && validUntil !== null && validUntil <= validFrom) {
    throw refusal(400, 'Ngày kết thúc phải sau ngày bắt đầu');
  }
}

/** The branch list as sent by the screen: an array, a JSON text, null (all branches) or not sent (undefined). */
export function readBranchIdsInput(value: unknown): number[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  let list: unknown = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      throw refusal(400, 'Danh sách chi nhánh không hợp lệ');
    }
    if (list === null) return null;
  }
  if (!Array.isArray(list)) throw refusal(400, 'Danh sách chi nhánh không hợp lệ');
  const ids = list.map((item) => Number(item));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw refusal(400, 'Danh sách chi nhánh không hợp lệ');
  return ids;
}

/**
 * The branches a voucher is saved for, checked against who is saving it.
 * restrictToBranchIds is null for the Super Admin and the staff member's branches for everyone else.
 *  - An empty list is never saved: choose at least one branch, or "all branches" (null, Super Admin only).
 *  - A limited staff member must name branches, and only branches of their own. They cannot save "all branches".
 * Returns the list to save, or null for "all branches". Undefined means "not sent": keep what is saved.
 */
export function checkVoucherBranches(
  branchIdsInput: unknown,
  restrictToBranchIds: number[] | null | undefined,
  options: { required: boolean }
): number[] | null | undefined {
  const ids = readBranchIdsInput(branchIdsInput);
  const limited = restrictToBranchIds !== null && restrictToBranchIds !== undefined;

  if (limited && restrictToBranchIds.length === 0) {
    throw refusal(403, 'Bạn chưa được gán chi nhánh nào nên không thể tạo hoặc sửa voucher');
  }

  if (ids === undefined) {
    // Nothing sent. A new voucher for a limited staff member must say which branches.
    if (options.required && limited) throw refusal(400, 'Vui lòng chọn ít nhất một chi nhánh');
    return undefined;
  }
  if (ids === null) {
    if (limited) throw refusal(403, 'Chỉ Super Admin được tạo voucher cho tất cả chi nhánh');
    return null;
  }
  if (ids.length === 0) throw refusal(400, 'Vui lòng chọn ít nhất một chi nhánh hoặc chọn tất cả chi nhánh');
  if (limited && ids.some((id) => !restrictToBranchIds.includes(id))) {
    throw refusal(403, 'Bạn không có quyền tạo voucher cho chi nhánh ngoài phạm vi quản lý');
  }
  return Array.from(new Set(ids));
}
