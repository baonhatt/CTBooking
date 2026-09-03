import { eq, and, or, count, isNull, sql, inArray } from 'drizzle-orm';
import type { VoucherValidateResponse, VRPackageItem } from '../../../shared/api';
import { formatDateForDb } from '../../lib/date-utils';
import { parseVoucherMetadata } from '../admin/vouchers';

function parseNullableJsonArray(val: any): number[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function matchesBranch(branchIdsJson: any, targetBranchId?: number): boolean {
  if (!targetBranchId) return true; // No branch specified, assume matches
  const branchIds = parseNullableJsonArray(branchIdsJson);
  if (branchIds.length === 0) return true; // NULL / empty = all branches
  return branchIds.includes(targetBranchId);
}

/**
 * Validate a voucher for VR booking (scope=vr or scope=all)
 * Called BEFORE creating a booking (user clicks "Áp dụng mã" on UI)
 */
export async function validateVoucherForVRImpl(
  anyDb: any,
  tables: {
    vouchers: any;
    voucher_redemption_logs: any;
    ticket_packages: any;
    bookings?: any;
  },
  args: {
    code: string;
    /** VR packages in cart: { vr_package_id, quantity } */
    vr_items?: VRPackageItem[];
    /** Movie ticket package id (if booking includes film tickets) */
    ticket_package_id?: number;
    /** Pre-computed movie subtotal (price × qty). If supplied, DB lookup is skipped */
    movie_subtotal?: number;
    /** Pre-computed VR subtotal (sum of all vr_items × qty). If supplied, DB lookup is skipped */
    vr_subtotal?: number;
    /** Pre-fetched VR package price map: packageId → unit price. Avoids duplicate DB round-trips */
    vr_price_map?: Map<number, number>;
    branch_id?: number;
    user_id?: number;
    email?: string;
    order_total_before?: number;
  }
): Promise<VoucherValidateResponse> {
  const {
    code,
    vr_items = [],
    ticket_package_id,
    branch_id,
    user_id,
    email,
    order_total_before: _orderArg,
    vr_price_map
  } = args;

  if (!code || !code.trim()) {
    return { valid: false, message: 'Vui lòng nhập mã giảm giá', error_code: 'VOUCHER_NOT_FOUND' };
  }

  const cleanCode = code.trim().toUpperCase();
  const voucher = await anyDb.query.vouchers.findFirst({
    where: and(eq(tables.vouchers.code, cleanCode), isNull(tables.vouchers.deleted_at))
  });

  if (!voucher) {
    return { valid: false, message: 'Mã giảm giá không tồn tại', error_code: 'VOUCHER_NOT_FOUND' };
  }

  if (!voucher.is_active) {
    return { valid: false, message: 'Mã giảm giá chưa được kích hoạt', error_code: 'VOUCHER_INACTIVE' };
  }

  // 1. DATE validity (Timestamp numerical comparison)
  const nowMs = Date.now();
  if (voucher.valid_from) {
    const validFromMs = new Date(voucher.valid_from).getTime();
    if (!isNaN(validFromMs) && nowMs < validFromMs) {
      return {
        valid: false,
        message: `Mã giảm giá sẽ có hiệu lực từ ${new Date(voucher.valid_from).toLocaleString('vi-VN')}`,
        error_code: 'VOUCHER_NOT_YET_VALID'
      };
    }
  }
  if (voucher.valid_until) {
    const validUntilMs = new Date(voucher.valid_until).getTime();
    if (!isNaN(validUntilMs) && nowMs > validUntilMs) {
      return { valid: false, message: 'Mã giảm giá đã hết hạn', error_code: 'VOUCHER_EXPIRED' };
    }
  }

  // 2. Usage limit (global)
  if (voucher.usage_limit !== null && voucher.usage_limit !== undefined) {
    if ((voucher.used_count || 0) >= Number(voucher.usage_limit)) {
      return {
        valid: false,
        message: 'Mã giảm giá đã hết lượt sử dụng',
        error_code: 'VOUCHER_USAGE_LIMIT_REACHED'
      };
    }
  }

  // 3. Per-user limit (supports logged in user_id OR guest email)
  if (voucher.per_user_limit !== null && voucher.per_user_limit !== undefined) {
    let perUserCount = 0;
    if (user_id) {
      const [perUserCountRes] = await anyDb
        .select({ count: count() })
        .from(tables.voucher_redemption_logs)
        .where(
          and(
            eq(tables.voucher_redemption_logs.voucher_id, voucher.id),
            eq(tables.voucher_redemption_logs.user_id, user_id)
          )
        );
      perUserCount = perUserCountRes?.count || 0;
    } else if (email && email.trim() && tables.bookings) {
      const [perEmailCountRes] = await anyDb
        .select({ count: count() })
        .from(tables.voucher_redemption_logs)
        .innerJoin(tables.bookings, eq(tables.voucher_redemption_logs.booking_id, tables.bookings.id))
        .where(
          and(
            eq(tables.voucher_redemption_logs.voucher_id, voucher.id),
            sql`LOWER(${tables.bookings.email}) = LOWER(${email.trim()})`
          )
        );
      perUserCount = perEmailCountRes?.count || 0;
    }

    if (perUserCount >= Number(voucher.per_user_limit)) {
      return {
        valid: false,
        message: `Mã giảm giá đã đạt giới hạn sử dụng (${voucher.per_user_limit} lần/khách hàng)`,
        error_code: 'VOUCHER_PER_USER_LIMIT_REACHED'
      };
    }
  }

  // 4. Build package price map and compute item subtotals (movie vs vr)
  // Use pre-fetched map if available to avoid duplicate DB queries
  const resolvedVrPriceMap: Map<number, number> = new Map();
  if (vr_price_map && vr_price_map.size > 0) {
    for (const [id, price] of vr_price_map.entries()) resolvedVrPriceMap.set(id, price);
  } else if (vr_items && vr_items.length > 0) {
    const vrPackageIds = vr_items.map((i) => i.vr_package_id);
    if (vrPackageIds.length > 0) {
      const pkgs = await anyDb
        .select({ id: tables.ticket_packages.id, price: tables.ticket_packages.price })
        .from(tables.ticket_packages)
        .where(inArray(tables.ticket_packages.id, vrPackageIds));
      for (const p of pkgs) resolvedVrPriceMap.set(p.id, Number(p.price || 0));
    }
  }

  let computed_vr_subtotal = args.vr_subtotal || 0;
  if (computed_vr_subtotal <= 0) {
    for (const it of vr_items) {
      const price = resolvedVrPriceMap.get(it.vr_package_id) || 0;
      computed_vr_subtotal += price * it.quantity;
    }
  }

  let computed_movie_subtotal = args.movie_subtotal || 0;
  // track movie unit price for partial applicable calculation
  let movieUnitPrice = 0;
  if (computed_movie_subtotal <= 0 && ticket_package_id) {
    const moviePkg = await anyDb
      .select({ id: tables.ticket_packages.id, price: tables.ticket_packages.price })
      .from(tables.ticket_packages)
      .where(eq(tables.ticket_packages.id, ticket_package_id));
    if (moviePkg[0]) {
      movieUnitPrice = Number(moviePkg[0].price || 0);
      computed_movie_subtotal = movieUnitPrice;
    }
  } else if (computed_movie_subtotal > 0) {
    movieUnitPrice = computed_movie_subtotal;
  }

  let order_total = typeof _orderArg === 'number' && _orderArg > 0
    ? _orderArg
    : computed_vr_subtotal + computed_movie_subtotal;

  // 5. SCOPE validation and eligible subtotal computation
  let eligible_subtotal = order_total;
  if (voucher.scope === 'vr') {
    if (!vr_items || vr_items.length === 0) {
      return {
        valid: false,
        message: 'Mã giảm giá này chỉ áp dụng cho gói trải nghiệm VR',
        error_code: 'VOUCHER_SCOPE_MISMATCH'
      };
    }
    eligible_subtotal = computed_vr_subtotal > 0 ? computed_vr_subtotal : order_total;
  } else if (voucher.scope === 'movie') {
    const hasMovie = (ticket_package_id && ticket_package_id > 0) || computed_movie_subtotal > 0 || (order_total > computed_vr_subtotal);
    if (!hasMovie) {
      return {
        valid: false,
        message: 'Mã giảm giá này chỉ áp dụng cho vé xem phim',
        error_code: 'VOUCHER_SCOPE_MISMATCH'
      };
    }
    eligible_subtotal = computed_movie_subtotal > 0 ? computed_movie_subtotal : (order_total - computed_vr_subtotal);
    if (eligible_subtotal <= 0) eligible_subtotal = order_total;
  }

  // 6. Min order value (checked against total order or eligible subtotal)
  const minOrder = Number(voucher.min_order_value || 0);
  if (minOrder > 0 && order_total < minOrder) {
    return {
      valid: false,
      message: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để áp mã`,
      error_code: 'VOUCHER_MIN_ORDER_NOT_REACHED',
      order_total_before: order_total
    };
  }

  // 7. Applicable / Excluded ticket_package_ids
  //
  // EXCLUDED (hard block): if any item in cart is in excluded list → reject entire voucher
  // APPLICABLE (soft whitelist): voucher discount only applies to the subtotal of packages in the list.
  //   Packages NOT in the list remain at full price and are NOT blocked from booking.
  const applicable = parseNullableJsonArray(voucher.applicable_ticket_package_ids);
  const excluded = parseNullableJsonArray(voucher.excluded_ticket_package_ids);

  // --- Hard block: excluded packages ---
  if (excluded.length > 0) {
    if (vr_items && vr_items.length > 0) {
      for (const it of vr_items) {
        if (excluded.includes(it.vr_package_id)) {
          return {
            valid: false,
            message: 'Một số gói VR trong giỏ hàng bị loại trừ khỏi mã giảm giá này',
            error_code: 'VOUCHER_PACKAGE_EXCLUDED'
          };
        }
      }
    }
    if (ticket_package_id && excluded.includes(ticket_package_id)) {
      return {
        valid: false,
        message: 'Gói vé phim đã chọn bị loại trừ khỏi mã giảm giá này',
        error_code: 'VOUCHER_PACKAGE_EXCLUDED'
      };
    }
  }

  // --- Soft whitelist: applicable packages → narrow eligible_subtotal ---
  // If applicable list is set, recalculate eligible_subtotal as only the sum of packages in the list.
  // IMPORTANT: applicable packages are also constrained by scope:
  //   - scope=vr → only VR items from applicable list count
  //   - scope=movie → only movie ticket from applicable list counts
  //   - scope=all → both VR and movie from applicable list count
  if (applicable.length > 0) {
    let partial_eligible = 0;

    // VR items eligible (only if scope allows VR)
    if (voucher.scope === 'vr' || voucher.scope === 'all') {
      for (const it of vr_items) {
        if (applicable.includes(it.vr_package_id)) {
          const price = resolvedVrPriceMap.get(it.vr_package_id) || 0;
          partial_eligible += price * it.quantity;
        }
      }
    }

    // Movie ticket eligible (only if scope allows movie)
    if ((voucher.scope === 'movie' || voucher.scope === 'all') && ticket_package_id && applicable.includes(ticket_package_id)) {
      partial_eligible += movieUnitPrice;
    }

    if (partial_eligible <= 0) {
      // None of the cart items matching scope are in the applicable list → voucher cannot be used
      return {
        valid: false,
        message: 'Mã giảm giá này không áp dụng cho các gói trong giỏ hàng của bạn',
        error_code: 'VOUCHER_PACKAGE_NOT_APPLICABLE'
      };
    }

    // Override eligible_subtotal with the partial amount
    eligible_subtotal = partial_eligible;
  }

  // 8. Branch match
  if (!matchesBranch(voucher.branch_ids, branch_id)) {
    return {
      valid: false,
      message: 'Mã giảm giá này không áp dụng tại chi nhánh bạn đang chọn',
      error_code: 'VOUCHER_BRANCH_MISMATCH'
    };
  }

  // 9. CALCULATE DISCOUNT (applied to eligible_subtotal)
  let discount_amount = 0;
  const dType = voucher.discount_type;
  const dValue = Number(voucher.discount_value || 0);
  if (dType === 'fixed') {
    discount_amount = Math.min(dValue, eligible_subtotal);
  } else if (dType === 'percent') {
    discount_amount = Math.round(((eligible_subtotal * dValue) / 100) * 100) / 100;
    const maxDisc = Number(voucher.max_discount || 0);
    if (maxDisc > 0 && discount_amount > maxDisc) discount_amount = maxDisc;
  }
  if (discount_amount > order_total) discount_amount = order_total;

  const meta = parseVoucherMetadata(voucher.description);

  return {
    valid: true,
    message: meta.sale_name
      ? `Áp dụng mã của Sale ${meta.sale_name} thành công: Tiết kiệm ${discount_amount.toLocaleString('vi-VN')}đ`
      : `Áp dụng thành công: Tiết kiệm ${discount_amount.toLocaleString('vi-VN')}đ`,
    discount_amount,
    discount_type: dType as 'percent' | 'fixed',
    order_total_before: order_total,
    order_total_after: order_total - discount_amount,
    voucher_details: {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      description: meta.note || voucher.description,
      sale_staff_id: meta.sale_staff_id,
      sale_name: meta.sale_name,
      sale_email: meta.sale_email,
      scope: voucher.scope,
      discount_type: voucher.discount_type,
      discount_value: dValue,
      min_order_value: minOrder,
      max_discount: voucher.max_discount,
      usage_limit: voucher.usage_limit,
      per_user_limit: voucher.per_user_limit,
      used_count: voucher.used_count || 0,
      is_active: voucher.is_active ? true : false,
      valid_from: voucher.valid_from,
      valid_until: voucher.valid_until,
      applicable_ticket_package_ids: voucher.applicable_ticket_package_ids,
      branch_ids: voucher.branch_ids
    }
  };
}

/**
 * Actually "redeem" a voucher — increment used_count atomically and insert redemption_log.
 * Called ONLY AFTER booking payment confirmed successful (updatePaymentImpl).
 */
export async function redeemVoucherAfterPaymentImpl(
  anyDb: any,
  tables: {
    vouchers: any;
    voucher_redemption_logs: any;
    bookings: any;
  },
  args: {
    voucher_id: number;
    booking_id: number;
    user_id?: number;
    discount_amount_applied: number;
    order_total_before_discount: number;
    order_total_after_discount: number;
    staff_id?: number;
  }
) {
  const {
    voucher_id,
    booking_id,
    user_id,
    discount_amount_applied,
    order_total_before_discount,
    order_total_after_discount
  } = args;
  let staff_id = args.staff_id;
  if (!voucher_id || !booking_id) return { ok: false, error: 'Missing voucher_id/booking_id' };

  const voucher = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, voucher_id) });

  if (!staff_id && voucher?.description) {
    const meta = parseVoucherMetadata(voucher.description);
    if (meta.sale_staff_id) {
      staff_id = meta.sale_staff_id;
    }
  }

  // used_count was already atomically incremented when the booking was CREATED (voucher slot locked).
  // Here we only write the audit log to record that the voucher was successfully redeemed with payment.
  // DO NOT increment used_count again here.
  await anyDb.insert(tables.voucher_redemption_logs).values({
    voucher_id,
    booking_id,
    user_id: user_id || null,
    redeemed_at: formatDateForDb(new Date()),
    discount_amount_applied: String(discount_amount_applied),
    order_total_before_discount: String(order_total_before_discount),
    order_total_after_discount: String(order_total_after_discount),
    staff_id: staff_id || null
  });

  return { ok: true };
}
