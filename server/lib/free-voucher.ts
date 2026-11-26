import { eq } from 'drizzle-orm';

/**
 * 100% vouchers (used for testing): a voucher that takes the whole price off ("percent" with a value of 100).
 *
 * Rules:
 *  - Only a Super Admin may save one, and its "Sales" person must be a Super Admin (admin vouchers.ts).
 *  - When a customer uses it, the Sales person is checked again (it may have changed since): not a Super Admin, the
 *    voucher is refused (user vouchers.ts).
 *  - An order can only become 0đ through such a voucher; any other voucher that would take the whole price off is
 *    refused. A 0đ order is paid at once, without a bank transfer (free-order.ts).
 */
export function isFullDiscountVoucher(voucher: { discount_type?: string | null; discount_value?: any }): boolean {
  return voucher?.discount_type === 'percent' && Number(voucher?.discount_value) >= 100;
}

/** Whether the staff member with this id exists, is active and is a Super Admin. */
export async function isSuperAdminStaff(anyDb: any, staffsTable: any, staffId: number | null | undefined): Promise<boolean> {
  if (!staffId || !staffsTable || !anyDb?.query?.staffs) return false;
  const staff = await anyDb.query.staffs.findFirst({ where: eq(staffsTable.id, Number(staffId)) });
  return Boolean(staff && staff.isSuperAdmin && staff.isActive !== false && !staff.deletedAt);
}

export const FULL_DISCOUNT_SALES_MESSAGE =
  'Voucher giảm 100% chỉ dùng để test: chỉ Super Admin được tạo, và mục Sales phải chọn một Super Admin.';
