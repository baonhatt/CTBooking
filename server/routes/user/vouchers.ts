import { eq, and, count, isNull, sql } from 'drizzle-orm';
import type { VoucherValidateResponse, VRPackageItem } from '../../../shared/api';
import { formatDateForDb } from '../../lib/date-utils';

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
        },
        args: {
                code: string;
                vr_items?: VRPackageItem[];
                branch_id?: number;
                user_id?: number;
                order_total_before?: number;
        }
): Promise<VoucherValidateResponse> {
        const { code, vr_items = [], branch_id, user_id, order_total_before: _orderArg } = args;

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

        // SCOPE: only accept 'vr' or 'all'
        if (voucher.scope !== 'vr' && voucher.scope !== 'all') {
                return {
                        valid: false,
                        message: 'Mã giảm giá này không áp dụng cho gói trải nghiệm VR',
                        error_code: 'VOUCHER_SCOPE_MISMATCH'
                };
        }

        // DATE validity
        const nowIso = new Date().toISOString();
        if (voucher.valid_from && nowIso < voucher.valid_from) {
                return {
                        valid: false,
                        message: `Mã giảm giá sẽ có hiệu lực từ ${new Date(voucher.valid_from).toLocaleString('vi-VN')}`,
                        error_code: 'VOUCHER_NOT_YET_VALID'
                };
        }
        if (voucher.valid_until && nowIso > voucher.valid_until) {
                return { valid: false, message: 'Mã giảm giá đã hết hạn', error_code: 'VOUCHER_EXPIRED' };
        }

        // Usage limit (global)
        if (voucher.usage_limit !== null && voucher.usage_limit !== undefined) {
                if ((voucher.used_count || 0) >= Number(voucher.usage_limit)) {
                        return {
                                valid: false,
                                message: 'Mã giảm giá đã hết lượt sử dụng',
                                error_code: 'VOUCHER_USAGE_LIMIT_REACHED'
                        };
                }
        }

        // Per-user limit (query redemption_logs)
        if (user_id && (voucher.per_user_limit !== null && voucher.per_user_limit !== undefined)) {
                const [perUserCountRes] = await anyDb
                        .select({ count: count() })
                        .from(tables.voucher_redemption_logs)
                        .where(
                                and(
                                        eq(tables.voucher_redemption_logs.voucher_id, voucher.id),
                                        eq(tables.voucher_redemption_logs.user_id, user_id)
                                )
                        );
                if ((perUserCountRes?.count || 0) >= Number(voucher.per_user_limit)) {
                        return {
                                valid: false,
                                message: `Bạn đã sử dụng mã này ${voucher.per_user_limit} lần (giới hạn)`,
                                error_code: 'VOUCHER_PER_USER_LIMIT_REACHED'
                        };
                }
        }

        // Compute totals (if order_total_before not supplied)
        let order_total = typeof _orderArg === 'number' ? _orderArg : 0;
        if (order_total <= 0 && vr_items && vr_items.length > 0) {
                const vrPackageIds = vr_items.map((i) => i.vr_package_id);
                if (vrPackageIds.length > 0) {
                        const pkgs = await anyDb
                                .select({ id: tables.ticket_packages.id, price: tables.ticket_packages.price })
                                .from(tables.ticket_packages)
                                .where(eq(tables.ticket_packages.id, vrPackageIds[0]));
                        // NOTE: Only using first for rough estimate; real total calculated in createVRBooking flow
                        // This is only for min_order check; actual check happens at booking time too
                        for (const it of vr_items) {
                                const pk = pkgs.find((p: any) => p.id === it.vr_package_id);
                                if (pk) order_total += Number(pk.price) * it.quantity;
                        }
                }
        }

        // Min order value
        const minOrder = Number(voucher.min_order_value || 0);
        if (minOrder > 0 && order_total < minOrder) {
                return {
                        valid: false,
                        message: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để áp mã`,
                        error_code: 'VOUCHER_MIN_ORDER_NOT_REACHED',
                        order_total_before: order_total
                };
        }

        // Applicable ticket_package_ids
        const applicable = parseNullableJsonArray(voucher.applicable_ticket_package_ids);
        const excluded = parseNullableJsonArray(voucher.excluded_ticket_package_ids);
        if (applicable.length > 0 && vr_items.length > 0) {
                for (const it of vr_items) {
                        if (!applicable.includes(it.vr_package_id)) {
                                return {
                                        valid: false,
                                        message: 'Mã giảm giá này không áp dụng cho tất cả gói VR bạn đã chọn',
                                        error_code: 'VOUCHER_PACKAGE_NOT_APPLICABLE'
                                };
                        }
                }
        }
        if (excluded.length > 0 && vr_items.length > 0) {
                for (const it of vr_items) {
                        if (excluded.includes(it.vr_package_id)) {
                                return {
                                        valid: false,
                                        message: 'Gói VR đã chọn bị loại trừ khỏi mã giảm giá này',
                                        error_code: 'VOUCHER_PACKAGE_NOT_APPLICABLE'
                                };
                        }
                }
        }

        // Branch match
        if (!matchesBranch(voucher.branch_ids, branch_id)) {
                return {
                        valid: false,
                        message: 'Mã giảm giá này không áp dụng tại chi nhánh bạn đang chọn',
                        error_code: 'VOUCHER_BRANCH_MISMATCH'
                };
        }

        // CALCULATE DISCOUNT
        let discount_amount = 0;
        const dType = voucher.discount_type;
        const dValue = Number(voucher.discount_value || 0);
        if (dType === 'fixed') {
                discount_amount = dValue;
        } else if (dType === 'percent') {
                discount_amount = Math.round(((order_total * dValue) / 100) * 100) / 100;
                const maxDisc = Number(voucher.max_discount || 0);
                if (maxDisc > 0 && discount_amount > maxDisc) discount_amount = maxDisc;
        }
        if (discount_amount > order_total) discount_amount = order_total;

        return {
                valid: true,
                message: `Áp dụng thành công: Tiết kiệm ${discount_amount.toLocaleString('vi-VN')}đ`,
                discount_amount,
                discount_type: dType as 'percent' | 'fixed',
                order_total_before: order_total,
                order_total_after: order_total - discount_amount,
                voucher_details: {
                        id: voucher.id,
                        code: voucher.code,
                        name: voucher.name,
                        description: voucher.description,
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
 * Actually "redeem" a voucher — increment used_count and insert redemption_log.
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
        const { voucher_id, booking_id, user_id, discount_amount_applied, order_total_before_discount, order_total_after_discount, staff_id } = args;
        if (!voucher_id || !booking_id) return { ok: false, error: 'Missing voucher_id/booking_id' };

        await anyDb
                .update(tables.vouchers)
                .set({ used_count: sql`used_count + 1`, updated_at: formatDateForDb(new Date()) })
                .where(eq(tables.vouchers.id, voucher_id));

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
