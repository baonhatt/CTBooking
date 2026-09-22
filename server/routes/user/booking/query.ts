import { eq, and, isNull, or, inArray, like } from 'drizzle-orm';
import { formatDateForDb } from '../../../lib/date-utils';
import { logAuditAction } from '../../../lib/audit-logger';

export async function getBookingImpl(anyDb: any, id: number, tables: { bookings: any }) {
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, id),
    columns: {
      id: true,
      payment_status: true,
      total_price: true,
      ticket_count: true,
      created_at: true,
      name: true,
      email: true,
      phone: true,
      user_id: true,
      movie_id: true,
      ticket_package_id: true
    }
  });
  if (!booking) return { status: 404, message: 'Không tìm thấy' };
  return {
    status: 200,
    id: booking.id,
    payment_status: booking.payment_status,
    total_price: booking.total_price,
    ticket_count: booking.ticket_count,
    created_at: booking.created_at,
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id
  };
}

export async function getBookingByIdImpl(
  anyDb: any,
  id: number,
  tables: { bookings: any; movies: any; ticket_packages: any; branches: any; vouchers?: any }
) {
  const { bookings, movies, ticket_packages, branches, vouchers } = tables;

  let finalQuery = anyDb
    .select({
      // Booking fields
      id: bookings.id,
      booking_code: bookings.booking_code,
      payment_status: bookings.payment_status,
      user_id: bookings.user_id,
      name: bookings.name,
      phone: bookings.phone,
      email: bookings.email,
      ticket_count: bookings.ticket_count,
      total_price: bookings.total_price,
      original_total_price: bookings.original_total_price,
      voucher_discount_amount: bookings.voucher_discount_amount,
      voucher_code_snapshot: bookings.voucher_code_snapshot,
      booking_type: bookings.booking_type,
      movie_id: bookings.movie_id,
      ticket_package_id: bookings.ticket_package_id,
      expiry_date: bookings.expiry_date,
      checked_in_at: bookings.checked_in_at,
      created_at: bookings.created_at,
      paid_at: bookings.paid_at,
      payment_method: bookings.payment_method,
      // Movie fields
      movie_title: bookings.movie_title,
      movie_image: bookings.movie_poster,
      duration_min: bookings.movie_duration,
      // Package fields
      ticket_package_name: bookings.ticket_package_name,
      // Branch fields
      branch_name: branches.name,
      branch_address: branches.address,
      branch_phone: branches.phone,
      branch_settings: branches.settings,
      // Voucher fields
      voucher_scope: vouchers ? vouchers.scope : null,
      voucher_description: vouchers ? vouchers.description : null,
      voucher_applicable_ids: vouchers ? vouchers.applicable_ticket_package_ids : null
    })
    .from(bookings)
    .leftJoin(branches, eq(bookings.branch_id, branches.id)) as any;

  if (vouchers) {
    finalQuery = finalQuery.leftJoin(vouchers, eq(bookings.voucher_id, vouchers.id));
  }
  const rows = await finalQuery.where(eq(bookings.id, id)).limit(1);

  const booking = rows[0];
  if (!booking) {
    return { status: 404, message: 'Không tìm thấy thông tin đặt vé' };
  }

  let vr_items: any[] = [];
  if ((tables as any).booking_vr_items) {
    try {
      vr_items = await anyDb
        .select()
        .from((tables as any).booking_vr_items)
        .where(eq((tables as any).booking_vr_items.booking_id, id));
    } catch (e) {
      console.warn('Could not load booking_vr_items:', e);
    }
  }

  return {
    status: 200,
    ...booking,
    branch: booking.branch_name
      ? {
          id: booking.branch_id,
          name: booking.branch_name,
          address: booking.branch_address,
          phone: booking.branch_phone,
          settings: booking.branch_settings
        }
      : null,
    voucher_details: booking.voucher_scope
      ? {
          scope: booking.voucher_scope,
          description: booking.voucher_description,
          applicable_ids: booking.voucher_applicable_ids
        }
      : null,
    vr_items
  };
}

function buildCodeSearchConditions(normalizedCode: string, bookingsTable: any) {
  const conditions = [
    eq(bookingsTable.booking_code, normalizedCode),
    eq(bookingsTable.pay_txt_code, normalizedCode),
    like(bookingsTable.booking_code, `%${normalizedCode}%`),
    like(bookingsTable.pay_txt_code, `%${normalizedCode}%`)
  ];

  if (normalizedCode.startsWith('BK')) {
    const idStr = normalizedCode.slice(2);
    if (/^\d+$/.test(idStr)) {
      conditions.push(eq(bookingsTable.id, Number(idStr)));
    }
  }

  const digitsMatch = normalizedCode.match(/\d{6,}/);
  if (digitsMatch) {
    const digits = digitsMatch[0];
    conditions.push(
      like(bookingsTable.booking_code, `%${digits}%`),
      like(bookingsTable.pay_txt_code, `%${digits}%`),
      inArray(bookingsTable.pay_txt_code, [
        normalizedCode,
        `CS${digits}`,
        `CP${digits}`,
        `CINESPHERE${digits}`,
        digits
      ]),
      inArray(bookingsTable.booking_code, [normalizedCode, `CS${digits}`, `CP${digits}`, `CINESPHERE${digits}`, digits])
    );
  }

  return or(...conditions);
}

export async function getBookingByCodeImpl(anyDb: any, codeRaw: string, tables: { bookings: any }) {
  const code = String(codeRaw || '');
  if (!code || code.trim() === '') return { status: 400, message: 'Thiếu mã vé' };
  const normalizedCode = code.trim().toUpperCase();
  const bookingsTable = tables.bookings;

  const booking = await anyDb.query.bookings.findFirst({
    where: buildCodeSearchConditions(normalizedCode, bookingsTable),
    with: {
      user: {
        columns: {
          fullname: true
        }
      }
    }
  });
  if (!booking) return { status: 404, message: 'Không tìm thấy vé' };
  const now = new Date();
  const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
  const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
  const can_use = Boolean(valid);
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  let vr_items: any[] = [];
  if ((tables as any).booking_vr_items) {
    try {
      vr_items = await anyDb
        .select()
        .from((tables as any).booking_vr_items)
        .where(eq((tables as any).booking_vr_items.booking_id, booking.id));
    } catch {}
  }

  let branch_name = null;
  if (booking.branch_id && (tables as any).branches) {
    try {
      const br = await anyDb.query.branches.findFirst({
        where: eq((tables as any).branches.id, booking.branch_id)
      });
      branch_name = br?.name || null;
    } catch {}
  }

  let voucher_details: { scope: string; description: string | null; applicable_ids: any } | null = null;
  if (booking.voucher_id && (tables as any).vouchers) {
    try {
      const v = await anyDb.query.vouchers.findFirst({
        where: eq((tables as any).vouchers.id, booking.voucher_id)
      });
      if (v) {
        voucher_details = {
          scope: v.scope || 'all',
          description: v.description || null,
          applicable_ids: v.applicable_ticket_package_ids ?? null
        };
      }
    } catch {}
  }

  return {
    status: 200,
    id: booking.id,
    booking_code: booking.booking_code,
    payment_status: booking.payment_status,
    user_id: booking.user_id,
    branch_id: booking.branch_id || null,
    branch_name: branch_name || (booking.branch_id ? `Chi nhánh #${booking.branch_id}` : null),
    name: booking.name,
    phone: booking.phone,
    email: booking.email,
    ticket_count: Number(booking.ticket_count),
    total_price: Number(booking.total_price),
    original_total_price: booking.original_total_price,
    voucher_discount_amount: booking.voucher_discount_amount,
    voucher_code_snapshot: booking.voucher_code_snapshot,
    booking_type: booking.booking_type,
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id,
    created_at: booking.created_at,
    paid_at: booking.paid_at,
    expiry_date: booking.expiry_date,
    payment_method: booking.payment_method,
    userName: booking.user?.fullname || '',
    is_used: Boolean(booking.is_used),
    movie_title: booking.movie_title || '',
    movie_duration: booking.movie_duration || '',
    movie_poster: booking.movie_poster || '',
    ticket_package_name: booking.ticket_package_name || '',
    ticket_unit_price: Number(booking.ticket_unit_price) || 0,
    valid,
    can_use,
    pay_txt_code: booking.pay_txt_code,
    validity_days: daysLeft,
    expired,
    checked_in_at: booking.checked_in_at,
    vr_items,
    voucher_details
  };
}

export async function confirmUseTicketImpl(
  anyDb: any,
  codeRaw: string,
  tables: { bookings: any; auditLogs?: any },
  restrictToBranchIds: number[] | null = null,
  allowExpired: boolean = false,
  staffInfo?: { id: number; email: string; fullname: string } | null
) {
  try {
    const code = String(codeRaw || '');
    if (!code || !code.trim()) return { status: 400, message: 'Vui lòng nhập mã vé' };
    const normalizedCode = code.trim().toUpperCase();
    const bookingsTable = tables.bookings;
    const searchCondition = buildCodeSearchConditions(normalizedCode, bookingsTable);

    const booking = await anyDb.query.bookings.findFirst({
      where:
        restrictToBranchIds && restrictToBranchIds.length > 0
          ? and(searchCondition, inArray(bookingsTable.branch_id, restrictToBranchIds))
          : searchCondition
    });

    if (!booking) return { status: 404, message: 'Không tìm thấy vé' };

    // Kiểm tra chi nhánh (RBAC)
    if (restrictToBranchIds && restrictToBranchIds.length > 0) {
      if (!booking.branch_id || !restrictToBranchIds.includes(booking.branch_id)) {
        return { status: 403, message: 'Bạn không có quyền xác nhận vé thuộc chi nhánh khác' };
      }
    }
    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
    if (!isPaid) return { status: 400, message: 'Vé chưa được thanh toán thành công' };
    if (booking.is_used) return { status: 400, message: 'Vé này đã được sử dụng trước đó' };

    const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
    const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
    const expired = Boolean(expiryAt && Date.now() > expiryAt.getTime());

    if (expired && !allowExpired) {
      return { status: 400, message: 'Vé đã hết hạn sử dụng. Vui lòng bấm "Duyệt quá hạn" nếu muốn cho khách vào.' };
    }

    // Update booking (tương thích với D1/SQLite không hỗ trợ .returning())
    const updatedRes = await anyDb
      .update(bookingsTable)
      .set({
        is_used: true,
        updated_at: formatDateForDb(new Date()),
        checked_in_at: formatDateForDb(new Date())
      })
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    const updated = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    if (!updated) return { status: 500, message: 'Không thể cập nhật trạng thái vé' };

    // Log audit log if this check-in was forced for an expired ticket
    if (expired && allowExpired && staffInfo && tables.auditLogs) {
      try {
        await logAuditAction(
          anyDb,
          tables.auditLogs,
          'force_checkin',
          'booking',
          booking.id,
          `Duyệt du di cho vé quá hạn vào cổng (Mã: ${booking.booking_code})`,
          staffInfo.id,
          staffInfo.email,
          staffInfo.fullname,
          JSON.stringify({ is_used: false, expired: true }),
          JSON.stringify({ is_used: true, forced_by: staffInfo.email })
        );
      } catch (err) {
        console.error('Audit log error on force check-in:', err);
      }
    }

    return {
      status: 200,
      message: expired && allowExpired ? 'Đã duyệt du di cho vé quá hạn vào cổng' : 'Xác nhận sử dụng vé thành công',
      booking: { id: updated.id, is_used: updated.is_used }
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
