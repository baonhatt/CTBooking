import { eq, and, or, inArray, isNull, sql } from 'drizzle-orm';
import type { VRBookingRequest, VRBookingResponse, VRPackageLineItem } from '../../../shared/api';
import { formatDateForDb } from '../../lib/date-utils';
import { validateVoucherForVRImpl } from './vouchers';
import { customerBranchId, packageAtBranch, packagesAtBranch } from '../../lib/catalog-scope';
import { allocateVoucherDiscountToVrItems, parseApplicableIds } from '../../../shared/booking-invoice';
import { generatePayTxtCode, isPayCodeCollision } from '../../lib/pay-code';
import { resolveOrderBranchId } from '../../lib/booking-branch';
import { isValidCustomerName, isValidCustomerEmail } from '../../lib/customer-input';
import { releaseVoucherForCancelledBooking } from '../scheduled/booking-expiry';

// =============== 1. List VR Packages for user booking page ===============
/** The VR packages sold at a branch (without a branch: the default branch), with the branch's price. */
export async function listActiveVRPackagesImpl(anyDb: any, _tables: { ticket_packages: any }, branch_id?: number) {
  const branchId = await customerBranchId(anyDb, branch_id);
  if (!branchId) return { items: [] };
  return { items: await packagesAtBranch(anyDb, branchId, 'vr') };
}

// =============== 2. Validate VR booking (pre-checkout) ===============
export async function validateVRBookingInput(
  anyDb: any,
  body: VRBookingRequest,
  tables: {
    ticket_packages: any;
    vouchers: any;
    voucher_redemption_logs: any;
    users: any;
  }
) {
  const { vr_items, voucher_code, branch_id, name, phone, emailBook } = body;

  if (!vr_items || !Array.isArray(vr_items) || vr_items.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 gói trải nghiệm VR');
  }
  if (!name || !name.trim()) throw new Error('Vui lòng nhập họ tên');
  if (!isValidCustomerName(name)) throw new Error('Họ tên không hợp lệ (tối đa 100 ký tự, không chứa < hoặc >)');
  if (!phone || !/^[0-9]{9,11}$/.test(phone.replace(/\D/g, ''))) throw new Error('Số điện thoại không hợp lệ');
  if (!isValidCustomerEmail(emailBook)) throw new Error('Email không hợp lệ');

  const vrPackageIds = vr_items.map((i) => i.vr_package_id);
  const duplicate = vrPackageIds.filter((x, i, arr) => arr.indexOf(x) !== i);
  if (duplicate.length > 0) throw new Error('Có gói VR bị lặp, vui lòng chọn lại');

  for (const it of vr_items) {
    if (!it.quantity || it.quantity <= 0) throw new Error('Số lượng gói VR không hợp lệ');
    if (!Number.isInteger(it.quantity)) throw new Error('Số lượng phải là số nguyên');
  }

  // Each package as sold at the order's branch (its price there); a package not sold there is refused
  const orderBranchId = await customerBranchId(anyDb, branch_id);
  if (!orderBranchId) throw new Error('Vui lòng chọn chi nhánh để đặt vé.');
  const pkgs: any[] = [];
  for (const packageId of vrPackageIds) {
    const pkg = await packageAtBranch(anyDb, Number(packageId), orderBranchId);
    if (!pkg || pkg.type !== 'vr') {
      throw new Error('Có gói VR không tồn tại, đang tạm ngừng bán hoặc không bán tại chi nhánh bạn chọn');
    }
    pkgs.push(pkg);
  }

  for (const p of pkgs) {
    // Member-only packages need a signed-in customer (the route takes it from the session, never from the form)
    if (p.is_member_only && !(Number((body as any).signed_in_account_id) > 0)) {
      throw new Error('Gói này chỉ dành cho thành viên. Vui lòng đăng nhập để đặt.');
    }
  }

  // Tính tiền gốc
  const packagePriceMap = new Map<number, { price: number; name: string }>();
  let original_total = 0;
  for (const p of pkgs) {
    const price = Number(p.price || 0);
    packagePriceMap.set(p.id, { price, name: p.name });
  }
  for (const it of vr_items) {
    const info = packagePriceMap.get(it.vr_package_id);
    if (!info) throw new Error('Gói VR không hợp lệ');
    original_total += info.price * it.quantity;
  }

  // A package priced 0 is a setup mistake: never an order without anything to pay (only a 100% voucher makes 0đ)
  if (!Number.isFinite(original_total) || original_total <= 0) {
    throw new Error('Giá gói VR không hợp lệ');
  }

  // Voucher (nếu có)
  let voucher_result: any = { valid: false };
  if (voucher_code && voucher_code.trim()) {
    // Build vr_price_map from already-fetched package data to avoid duplicate DB queries
    const vrPriceMap = new Map<number, number>();
    for (const p of pkgs) vrPriceMap.set(p.id, Number(p.price || 0));

    voucher_result = await validateVoucherForVRImpl(anyDb, tables, {
      code: voucher_code,
      vr_items,
      vr_subtotal: original_total,
      vr_price_map: vrPriceMap,
      branch_id: orderBranchId,
      // The customer's email, so the per-customer limit (paid + still-pending orders) is checked here too
      email: emailBook,
      order_total_before: original_total
    });
    if (!voucher_result.valid) {
      throw new Error(voucher_result.message || 'Mã giảm giá không hợp lệ');
    }
  }

  const discount_amount = voucher_result.valid ? Number(voucher_result.discount_amount || 0) : 0;
  const final_total = Math.max(0, original_total - discount_amount);
  const total_items_quantity = vr_items.reduce((s, it) => s + it.quantity, 0);

  return {
    vr_items_resolved: vr_items.map((it) => {
      const info = packagePriceMap.get(it.vr_package_id)!;
      return { ...it, unit_price: info.price, package_name: info.name };
    }),
    original_total_price: original_total,
    voucher_discount_amount: discount_amount,
    total_price: final_total,
    total_quantity: total_items_quantity,
    voucher_result: voucher_result.valid ? voucher_result : null,
    customer: { name: name.trim(), phone: phone.trim(), email: emailBook.trim() }
  };
}

export async function validateVRBookingImpl(anyDb: any, payload: VRBookingRequest, tables: any) {
  try {
    const res = await validateVRBookingInput(anyDb, payload, tables);
    // Only the prices go back to the browser: the voucher's internal details (Sales person, usage counters) stay here
    return {
      status: 200,
      original_total_price: res.original_total_price,
      voucher_discount_amount: res.voucher_discount_amount,
      total_price: res.total_price
    };
  } catch (err: any) {
    return { status: err.statusCode || 400, message: err.message || 'Lỗi validate' };
  }
}

// =============== 3. Create VR Booking (actually insert) ===============
/** How many fresh random pay_txt_code values are tried if one happens to collide with an existing order. */
const PAY_CODE_MAX_ATTEMPTS = 5;

export async function createVRBookingImpl(
  anyDb: any,
  payload: VRBookingRequest,
  tables: {
    ticket_packages: any;
    vouchers: any;
    voucher_redemption_logs: any;
    users: any;
    accounts?: any;
    bookings: any;
    booking_vr_items: any;
    branches: any;
  }
): Promise<VRBookingResponse & { status?: number }> {
  // Set once the voucher slot is taken. If anything later fails, the slot is given back.
  let lockedVoucherId: number | null = null;

  async function giveBackVoucherSlot() {
    // Clear first, so a second call (for example from the outer catch) cannot give the slot back twice
    const voucherId = lockedVoucherId;
    lockedVoucherId = null;
    if (voucherId) {
      try {
        await releaseVoucherForCancelledBooking(
          anyDb,
          { vouchers: tables.vouchers },
          { voucher_id: voucherId, previous_payment_status: 'pending' }
        );
      } catch (releaseError) {
        console.error('[createVRBooking] Could not give back the voucher slot:', releaseError);
      }
    }
  }

  try {
    // Every order belongs to a branch: the one asked for, or the default branch (never empty)
    const branch_id = await resolveOrderBranchId(anyDb, tables.branches, payload.branch_id);
    const orderPayload = { ...payload, branch_id };

    const validated = await validateVRBookingInput(anyDb, orderPayload, tables);
    // The payment reference is generated here. Any pay_txt_code sent by the browser is ignored.
    const { name, phone, emailBook, paymentMethod } = orderPayload;
    const booking_type = 'vr';

    const nowIso = new Date();
    // The customer's account, found by email like movie orders do (the email lives on accounts, not users)
    let user_id: number | null = null;
    if (tables.accounts) {
      const accountEmail = String((orderPayload as any).email || emailBook || '').trim();
      const [account] = await anyDb
        .select({ user_id: tables.accounts.user_id })
        .from(tables.accounts)
        .where(sql`LOWER(${tables.accounts.email}) = LOWER(${accountEmail})`)
        .limit(1);
      if (account?.user_id) user_id = Number(account.user_id);
    }

    const voucher_applied = validated.voucher_result;

    // Payment expires in 10 minutes from booking creation
    const paymentExpiresAt = formatDateForDb(new Date(nowIso.getTime() + 10 * 60 * 1000));

    // Lock voucher usage slot atomically BEFORE creating the booking
    if (voucher_applied?.voucher_details?.id) {
      const lockResult = await anyDb
        .update(tables.vouchers)
        .set({ used_count: sql`used_count + 1`, updated_at: formatDateForDb(nowIso) })
        .where(
          and(
            eq(tables.vouchers.id, voucher_applied.voucher_details.id),
            or(
              isNull(tables.vouchers.usage_limit),
              sql`${tables.vouchers.used_count} < ${tables.vouchers.usage_limit}`
            )
          )
        )
        .returning({ used_count: tables.vouchers.used_count });

      if (!lockResult || (Array.isArray(lockResult) && lockResult.length === 0)) {
        return { success: false, error: 'Mã giảm giá vừa hết lượt sử dụng, vui lòng đặt lại không dùng mã.', status: 409 };
      }
      lockedVoucherId = Number(voucher_applied.voucher_details.id);
    }

    // Insert the booking. The random pay_txt_code is the only value that can collide, so only that is retried.
    let bookingRow: any = null;
    for (let attempt = 1; attempt <= PAY_CODE_MAX_ATTEMPTS && !bookingRow; attempt++) {
      try {
        const inserted = await anyDb
          .insert(tables.bookings)
          .values({
            user_id,
            booking_type,
            movie_id: null,
            ticket_package_id: null, // multi VR items → bảng phụ
            ticket_count: validated.total_quantity,
            original_total_price: String(validated.original_total_price),
            voucher_id: voucher_applied?.voucher_details?.id || null,
            voucher_code_snapshot: voucher_applied?.voucher_details?.code || null,
            voucher_discount_amount: String(validated.voucher_discount_amount),
            total_price: String(validated.total_price),
            payment_method: (paymentMethod || 'cash').toLowerCase(),
            phone: phone.trim(),
            name: name.trim(),
            email: emailBook.trim(),
            combo: null,
            movie_title: null,
            movie_duration: null,
            movie_poster: null,
            ticket_package_name: `VR Booking (${validated.total_quantity} gói)`,
            ticket_unit_price: null,
            branch_id,
            pay_txt_code: generatePayTxtCode(),
            payment_expires_at: paymentExpiresAt,
            created_at: formatDateForDb(nowIso),
            updated_at: formatDateForDb(nowIso)
          })
          .returning();
        bookingRow = Array.isArray(inserted) ? inserted[0] : inserted;
      } catch (insertError) {
        if (!isPayCodeCollision(insertError) || attempt === PAY_CODE_MAX_ATTEMPTS) {
          await giveBackVoucherSlot();
          throw insertError;
        }
      }
    }

    if (!bookingRow) {
      await giveBackVoucherSlot();
      return { success: false, error: 'Không thể tạo đặt VR', status: 500 };
    }

    // Insert booking_vr_items using standard pro-rata discount allocation
    const applicableIds = parseApplicableIds(voucher_applied?.voucher_details?.applicable_ids);
    const allocatedItems = allocateVoucherDiscountToVrItems({
      vrItems: validated.vr_items_resolved.map((it) => ({
        vr_package_id: it.vr_package_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        package_name: it.package_name,
        branch_id
      })),
      voucherScope: voucher_applied?.voucher_details?.scope || 'vr',
      applicablePackageIds: applicableIds,
      voucherDiscountAmount: Number(validated.voucher_discount_amount || 0)
    });

    const itemsToSave: VRPackageLineItem[] = allocatedItems.map((it) => ({
      booking_id: bookingRow.id,
      vr_ticket_package_id: it.vr_ticket_package_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      package_name: it.package_name || '',
      voucher_id: voucher_applied?.voucher_details?.id || null,
      discounted_unit_price: it.discounted_unit_price,
      line_total: it.line_total,
      voucher_discount_amount: it.voucher_discount_amount,
      branch_id
    }));
    const insertedItemsArr: any[] = [];
    try {
      for (const row of itemsToSave) {
        const r = await anyDb.insert(tables.booking_vr_items).values(row).returning();
        if (r) insertedItemsArr.push(Array.isArray(r) ? r[0] : r);
      }
    } catch (itemError) {
      // An order that pays for VR packages but has no VR lines is wrong. Cancel it instead of returning "created".
      console.error('Insert vr item lỗi', itemError);
      try {
        await anyDb
          .update(tables.bookings)
          .set({ payment_status: 'failed', updated_at: formatDateForDb(new Date()) })
          .where(eq(tables.bookings.id, bookingRow.id));
      } catch (cancelError) {
        console.error('[createVRBooking] Could not cancel the half-created booking:', cancelError);
      }
      await giveBackVoucherSlot();
      return { success: false, error: 'Không thể lưu chi tiết đặt vé. Vui lòng thử lại.', status: 500 };
    }

    const finalItems = insertedItemsArr.length > 0 ? insertedItemsArr : itemsToSave;
    return {
      success: true,
      status: 201,
      booking: {
        id: bookingRow.id,
        booking_code: bookingRow.booking_code || '',
        booking_type: 'vr',
        total_price: Number(bookingRow.total_price || validated.total_price),
        original_total_price: validated.original_total_price,
        voucher_discount_amount: validated.voucher_discount_amount,
        voucher_code_snapshot: voucher_applied?.voucher_details?.code || null,
        voucher_id: voucher_applied?.voucher_details?.id || null,
        payment_status: bookingRow.payment_status || 'pending',
        payment_method: bookingRow.payment_method || paymentMethod,
        // The reference the customer types into the bank transfer, and the payment deadline (both set by the server)
        pay_txt_code: bookingRow.pay_txt_code,
        payment_expires_at: bookingRow.payment_expires_at,
        vr_items: finalItems as any
      } as any
    };
  } catch (err: any) {
    await giveBackVoucherSlot();
    return { success: false, error: err.message || 'Lỗi tạo VR booking', status: err.statusCode || err.status || 400 };
  }
}

// The public lookup of a VR booking by id was removed: it returned every column of the booking to anyone.
// The payment page now reads a minimal status through bookingStatusPayload (see booking/access.ts).
