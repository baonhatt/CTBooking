import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import type { VRBookingRequest, VRBookingResponse, VRPackageLineItem } from '../../../shared/api';
import { formatDateForDb } from '../../lib/date-utils';
import { validateVoucherForVRImpl, matchesBranch } from './vouchers';
import { sqlBranchIdsMatchFilter } from '../../lib/branch-ids';

// =============== 1. List VR Packages for user booking page ===============
export async function listActiveVRPackagesImpl(anyDb: any, tables: { ticket_packages: any }, branch_id?: number) {
  const pkgs = tables.ticket_packages;
  // Safe version using OR logic fallback in case SQL stringify is tricky:
  const whereClause = branch_id
    ? and(
        eq(pkgs.is_active, true),
        isNull(pkgs.deleted_at),
        eq(pkgs.type, 'vr'),
        sqlBranchIdsMatchFilter(pkgs.branch_ids, pkgs.branch_id, branch_id)
      )
    : and(eq(pkgs.is_active, true), isNull(pkgs.deleted_at), eq(pkgs.type, 'vr'));

  const items = await anyDb.query.ticket_packages.findMany({
    where: whereClause,
    orderBy: [sql`CAST(${pkgs.display_order} AS INTEGER) ASC`, sql`CAST(${pkgs.price} AS REAL) ASC`]
  });

  // Enrich with branch_ids_parsed for backward compat
  const enriched = items.map((it: any) => {
    let bIds: number[] | null = null;
    if (it.branch_ids) {
      try {
        const parsed = JSON.parse(it.branch_ids);
        if (Array.isArray(parsed)) bIds = parsed.map((x: any) => Number(x)).filter((x: number) => !isNaN(x));
      } catch {}
    }
    return { ...it, branch_ids: bIds, branch_ids_parsed: bIds };
  });

  return { items: enriched };
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
  if (!phone || !/^[0-9]{9,11}$/.test(phone.replace(/\D/g, ''))) throw new Error('Số điện thoại không hợp lệ');
  if (!emailBook || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBook)) throw new Error('Email không hợp lệ');

  const vrPackageIds = vr_items.map((i) => i.vr_package_id);
  const duplicate = vrPackageIds.filter((x, i, arr) => arr.indexOf(x) !== i);
  if (duplicate.length > 0) throw new Error('Có gói VR bị lặp, vui lòng chọn lại');

  for (const it of vr_items) {
    if (!it.quantity || it.quantity <= 0) throw new Error('Số lượng gói VR không hợp lệ');
    if (!Number.isInteger(it.quantity)) throw new Error('Số lượng phải là số nguyên');
  }

  const pkgs = await anyDb.query.ticket_packages.findMany({
    where: and(
      inArray(tables.ticket_packages.id, vrPackageIds),
      eq(tables.ticket_packages.type, 'vr'),
      eq(tables.ticket_packages.is_active, true),
      isNull(tables.ticket_packages.deleted_at)
    )
  });

  if (pkgs.length !== vrPackageIds.length) {
    throw new Error('Có gói VR không tồn tại hoặc đang tạm ngừng bán');
  }

  for (const p of pkgs) {
    if (!matchesBranch(p.branch_ids, branch_id)) {
      throw new Error(`Gói "${p.name}" không bán tại chi nhánh bạn chọn`);
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
      branch_id,
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
    return {
      status: 200,
      original_total_price: res.original_total_price,
      voucher_discount_amount: res.voucher_discount_amount,
      total_price: res.total_price,
      total_quantity: res.total_quantity,
      vr_items_resolved: res.vr_items_resolved,
      voucher_applied: res.voucher_result
    };
  } catch (err: any) {
    return { status: err.statusCode || 400, message: err.message || 'Lỗi validate' };
  }
}

// =============== 3. Create VR Booking (actually insert) ===============
export async function createVRBookingImpl(
  anyDb: any,
  payload: VRBookingRequest,
  tables: {
    ticket_packages: any;
    vouchers: any;
    voucher_redemption_logs: any;
    users: any;
    bookings: any;
    booking_vr_items: any;
  }
): Promise<VRBookingResponse & { status?: number }> {
  try {
    const validated = await validateVRBookingInput(anyDb, payload, tables);
    const { name, phone, emailBook, paymentMethod, pay_txt_code, branch_id } = payload;
    const booking_type = 'vr';

    const nowIso = new Date();
    // Tìm user_id nếu có đăng nhập (từ email hoặc phone)
    let user_id: number | null = null;
    try {
      const matchUser = await anyDb.query.users.findFirst({
        where: sql`LOWER(${tables.users.email}) = LOWER(${emailBook})`
      });
      if (matchUser) user_id = matchUser.id;
    } catch {}

    const voucher_applied = validated.voucher_result;
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
        branch_id: branch_id || null,
        pay_txt_code: pay_txt_code || null,
        created_at: formatDateForDb(nowIso),
        updated_at: formatDateForDb(nowIso)
      })
      .returning();

    let bookingRow: any = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!bookingRow) {
      // Fallback find last
      bookingRow = await anyDb.query.bookings.findFirst({
        where: sql`${tables.bookings.booking_type} = 'vr'`,
        orderBy: sql`${tables.bookings.id} DESC`
      });
    }
    if (!bookingRow) {
      return { success: false, error: 'Không thể tạo đặt VR', status: 500 };
    }

    // Insert booking_vr_items
    const itemsToSave: VRPackageLineItem[] = validated.vr_items_resolved.map((it) => {
      const disc_unit = voucher_applied
        ? it.unit_price -
          (validated.voucher_discount_amount > 0
            ? +(
                (it.unit_price * it.quantity * validated.voucher_discount_amount) /
                validated.original_total_price /
                it.quantity
              ).toFixed(2)
            : 0)
        : it.unit_price;
      const line_disc = it.unit_price * it.quantity - disc_unit * it.quantity;
      return {
        booking_id: bookingRow.id,
        vr_ticket_package_id: it.vr_package_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        package_name: it.package_name,
        voucher_id: voucher_applied?.voucher_details?.id || null,
        discounted_unit_price: +disc_unit.toFixed(2),
        line_total: +(disc_unit * it.quantity).toFixed(2),
        voucher_discount_amount: +line_disc.toFixed(2),
        branch_id: branch_id || null
      };
    });
    const insertedItemsArr: any[] = [];
    for (const row of itemsToSave) {
      try {
        const r = await anyDb.insert(tables.booking_vr_items).values(row).returning();
        if (r) insertedItemsArr.push(Array.isArray(r) ? r[0] : r);
      } catch (err: any) {
        console.error('Insert vr item lỗi', err);
      }
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
        vr_items: finalItems as any
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi tạo VR booking', status: err.statusCode || 400 };
  }
}

// =============== 4. Get VR Booking by ID (join vr_items) ===============
export async function getVRBookingByIdImpl(
  anyDb: any,
  tables: { bookings: any; booking_vr_items: any; voucher_redemption_logs: any },
  id: number
) {
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(tables.bookings.id, id)
  });
  if (!booking) return null;

  const vr_items = await anyDb.query.booking_vr_items.findMany({
    where: eq(tables.booking_vr_items.booking_id, id),
    orderBy: sql`${tables.booking_vr_items.id} ASC`
  });

  return {
    ...booking,
    booking_type: booking.booking_type || 'movie',
    vr_items
  };
}
