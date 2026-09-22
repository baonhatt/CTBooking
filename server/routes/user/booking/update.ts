import { eq, and, isNull } from 'drizzle-orm';
import { generateBookingCode, getBookingEmailTemplate } from '../../../lib/booking-utils';
import { mailQueue } from '../../../lib/mail-queue';
import { formatDateForDb } from '../../../lib/date-utils';
import { redeemVoucherAfterPaymentImpl } from '../vouchers';
import { releaseVoucherForCancelledBooking } from '../../scheduled/booking-expiry';
import { isLineDiscounted, voucherScopeLabel, parseApplicableIds, vrPackageId } from '@shared/booking-invoice';

export async function updatePaymentImpl(
  anyDb: any,
  payload: {
    user_id?: number;
    payment_id?: number;
    payment_status?: string;
    transaction_id?: string;
    paid_at?: string | Date;
  },
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  tables?: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    branches: any;
    email_logs?: any;
    vouchers?: any;
    voucher_redemption_logs?: any;
    booking_vr_items?: any;
  },
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  try {
    const { user_id, payment_id, payment_status, transaction_id, paid_at } = payload;
    if (!payment_id || !payment_status) {
      return { status: 400, message: 'Vui lòng nhập đầy đủ thông tin hợp lệ.' };
    }

    const {
      bookings: bookingsTable,
      movies: moviesTable,
      ticket_packages: pkgsTable,
      branches: branchesTable,
      vouchers: vouchersTable,
      voucher_redemption_logs: logsTable,
      booking_vr_items: vrItemsTable
    } = tables || ({} as any);
    if (!bookingsTable || !moviesTable || !pkgsTable || !branchesTable)
      return { status: 500, message: 'Missing tables definition' };

    // 1. Tối ưu Query đầu tiên: Sử dụng Join thay vì 'with' để lấy data gửi mail sau này
    const whereClause =
      user_id && Number(user_id) !== 0
        ? and(eq(bookingsTable.id, Number(payment_id)), eq(bookingsTable.user_id, Number(user_id)))
        : eq(bookingsTable.id, Number(payment_id));

    const rows = await anyDb
      .select({
        booking: bookingsTable,
        duration_min: moviesTable.duration_min,
        package_name: pkgsTable.name,
        movie_title: bookingsTable.movie_title,
        movie_duration: bookingsTable.movie_duration,
        // Branch fields for email
        branch_name: branchesTable.name,
        branch_address: branchesTable.address,
        branch_phone: branchesTable.phone,
        branch_settings: branchesTable.settings
      })
      .from(bookingsTable)
      .leftJoin(moviesTable, eq(bookingsTable.movie_id, moviesTable.id))
      .leftJoin(pkgsTable, eq(bookingsTable.ticket_package_id, pkgsTable.id))
      .leftJoin(branchesTable, eq(bookingsTable.branch_id, branchesTable.id))
      .where(whereClause)
      .limit(1);

    const result = rows[0];
    if (!result) return { status: 404, message: 'Không tìm thấy đặt vé.' };

    const { booking } = result;
    let bookingCode = booking.booking_code;
    const isPaid = String(payment_status).toLowerCase() === 'paid';
    const isAlreadyPaid = String(booking.payment_status).toLowerCase() === 'paid';

    // 2. Logic tạo mã vé
    if (isPaid && !bookingCode) {
      bookingCode = await generateBookingCode(anyDb);
    }

    // Bảo vệ: Nếu đơn đã thanh toán (isAlreadyPaid) mà request gửi lên là failed
    // => Chặn update, trả về thông báo để Client xử lý (Alert "Đã thanh toán" thay vì "Đã hủy")
    if (isAlreadyPaid && payment_status === 'failed') {
      return {
        status: 409, // Conflict
        message: 'Giao dịch đã được thanh toán thành công',
        booking: booking
      };
    }

    // 3. Chuẩn bị payload update
    const now = new Date();
    const updatePayload: any = {
      payment_status,
      updated_at: formatDateForDb(now),
      transaction_id: transaction_id ?? booking.transaction_id
    };

    if (isPaid) {
      const paidAtDate = paid_at ? new Date(paid_at) : new Date();
      const validPaidAt = isNaN(paidAtDate.getTime()) ? new Date() : paidAtDate;

      // Fetch branch settings for ticket expiry days
      let branchSettings: any = {};
      if (booking.branch_id) {
        const branch = await anyDb.query.branches.findFirst({
          where: and(eq(branchesTable.id, booking.branch_id), isNull(branchesTable.deleted_at))
        });
        if (branch) {
          try {
            branchSettings = branch.settings ? JSON.parse(branch.settings) : {};
          } catch (e) {
            branchSettings = {};
          }
        }
      }

      // Use branch ticket_expiry_days setting, default to 10 days if not set
      const expiryDays = branchSettings.ticket_expiry_days || 10;
      updatePayload.paid_at = formatDateForDb(validPaidAt);
      updatePayload.expiry_date = formatDateForDb(new Date(validPaidAt.getTime() + expiryDays * 24 * 60 * 60 * 1000));
      updatePayload.booking_code = bookingCode;
      // Clear the payment deadline — booking is now confirmed paid
      updatePayload.payment_expires_at = null;
    }

    // 4. Update và lấy kết quả mới nhất
    const updatedRes = await anyDb
      .update(bookingsTable)
      .set(updatePayload)
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    const updatedBooking = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    // 5b. Redeem Voucher + VR booking logic (only if paid)
    if (isPaid && !isAlreadyPaid) {
      // Redeem voucher (if used)
      if (booking.voucher_id && vouchersTable && logsTable) {
        try {
          const originalTotal = Number(booking.original_total_price || booking.total_price || 0);
          const finalTotal = Number(booking.total_price || 0);
          const discAmt = Number(booking.voucher_discount_amount || 0);
          await redeemVoucherAfterPaymentImpl(
            anyDb,
            { vouchers: vouchersTable, voucher_redemption_logs: logsTable, bookings: bookingsTable },
            {
              voucher_id: Number(booking.voucher_id),
              booking_id: booking.id,
              user_id: booking.user_id ? Number(booking.user_id) : undefined,
              discount_amount_applied: discAmt > 0 ? discAmt : Math.max(0, originalTotal - finalTotal),
              order_total_before_discount: originalTotal > 0 ? originalTotal : finalTotal + discAmt,
              order_total_after_discount: finalTotal
            }
          );
        } catch (e) {
          console.error('[updatePayment] Redeem voucher lỗi (không rollback, booking đã paid)', e);
        }
      }
    } else if (payment_status === 'failed' || payment_status === 'cancelled' || payment_status === 'expired') {
      // If payment failed/cancelled and booking had locked a voucher while pending, release it
      if (booking.voucher_id && vouchersTable) {
        try {
          await releaseVoucherForCancelledBooking(
            anyDb,
            { vouchers: vouchersTable },
            {
              voucher_id: Number(booking.voucher_id),
              previous_payment_status: String(booking.payment_status || 'pending').toLowerCase()
            }
          );
        } catch (e) {
          console.error('[updatePayment] Release voucher error:', e);
        }
      }
    }

    // 5. Gửi mail (Chỉ khi thanh toán thành công)
    if (isPaid) {
      // Determine booking_type
      const bookingType = booking.booking_type || 'movie';
      const isVR = bookingType === 'vr';
      const isComboVR = bookingType === 'combo_vr';

      // Sử dụng mailQueue để gửi mail ngầm, không chặn response
      mailQueue.add(
        async () => {
          try {
            let vr_items: any[] = [];
            if ((isVR || isComboVR || (tables as any).booking_vr_items) && (tables as any).booking_vr_items) {
              try {
                vr_items = await anyDb
                  .select()
                  .from((tables as any).booking_vr_items)
                  .where(eq((tables as any).booking_vr_items.booking_id, booking.id));
              } catch (e) {
                console.warn('[updatePayment] Error fetching booking_vr_items for mail:', e);
              }
            }

            const originalTotal = Number(booking.original_total_price || booking.total_price || 0);
            const discountAmt = Number(booking.voucher_discount_amount || 0);
            const totalPrice = Number(booking.total_price || 0);
            const voucherCode = booking.voucher_code_snapshot || null;

            let voucherScope = 'all';
            let applicableIds: number[] = [];
            if (booking.voucher_id && (tables as any).vouchers) {
              try {
                const vt = (tables as any).vouchers;
                const v = await anyDb
                  .select({ scope: vt.scope, applicable_ticket_package_ids: vt.applicable_ticket_package_ids })
                  .from(vt)
                  .where(eq(vt.id, booking.voucher_id))
                  .limit(1);
                if (v && v.length > 0) {
                  voucherScope = v[0].scope || 'all';
                  applicableIds = parseApplicableIds(v[0].applicable_ticket_package_ids);
                }
              } catch (e) {
                console.warn('[updatePayment] Error fetching voucher scope for mail:', e);
              }
            }

            // 1. Parse movie packages into table rows
            let parsedPackages: any[] = [];
            const rawPkg = booking.ticket_package_name || result.package_name;
            if (rawPkg) {
              try {
                if (typeof rawPkg === 'string' && (rawPkg.startsWith('[') || rawPkg.startsWith('{'))) {
                  const p = JSON.parse(rawPkg);
                  parsedPackages = Array.isArray(p) ? p : [p];
                }
              } catch {}
            }
            if (parsedPackages.length === 0 && rawPkg) {
              parsedPackages = [{ name: rawPkg, quantity: booking.ticket_count || 1 }];
            }

            // Build Movie Packages HTML Table
            let moviePackagesTableHtml = '';
            if (parsedPackages.length > 0 && !isVR) {
              const rowsHtml = parsedPackages
                .map((pkg: any) => {
                  const pkgName = pkg.name || pkg.package_name || rawPkg || 'Gói vé';
                  const qty = Number(pkg.quantity || booking.ticket_count || 1);
                  const unitPrice = Number(pkg.unit_price || pkg.price || booking.ticket_unit_price || 0);
                  const lineTotal = unitPrice > 0 ? unitPrice * qty : 0;
                  const discounted = isLineDiscounted({
                    discountAmount: discountAmt,
                    scope: voucherScope,
                    applicableIds,
                    kind: 'movie',
                    packageId: pkg.package_id || pkg.id || booking.ticket_package_id
                  });
                  const badgeHtml = discounted
                    ? `<span style="color:#e11d48;font-size:10px;font-weight:bold;margin-left:6px;border:1px solid #fda4af;padding:1px 4px;border-radius:3px;background-color:#fff1f2;">ĐƯỢC GIẢM</span>`
                    : '';
                  return `
                    <tr>
                      <td style="padding:10px;border-bottom:1px solid #eee;">${pkgName}${badgeHtml}</td>
                      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
                      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${unitPrice > 0 ? unitPrice.toLocaleString('vi-VN') + 'đ' : '--'}</td>
                      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${lineTotal > 0 ? lineTotal.toLocaleString('vi-VN') + 'đ' : '--'}</td>
                    </tr>
                  `;
                })
                .join('');

              moviePackagesTableHtml = `
                <h3 style="margin-top:20px;color:#2563eb;font-size:14px;text-transform:uppercase;">Danh sách gói vé đã chọn</h3>
                <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
                  <thead>
                    <tr style="background:#f1f5f9;color:#475569;">
                      <th style="padding:10px;text-align:left;">Gói vé</th>
                      <th style="padding:10px;text-align:center;">SL</th>
                      <th style="padding:10px;text-align:right;">Đơn giá</th>
                      <th style="padding:10px;text-align:right;">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              `;
            }

            // 2. Build VR items HTML Table
            let vrTableHtml = '';
            if (isVR || isComboVR || vr_items.length > 0) {
              let vrRowsHtml = '';
              if (vr_items.length > 0) {
                vrRowsHtml = vr_items
                  .map((it: any) => {
                    const discounted = isLineDiscounted({
                      discountAmount: discountAmt,
                      scope: voucherScope,
                      applicableIds,
                      kind: 'vr',
                      packageId: vrPackageId(it)
                    });
                    const badgeHtml = discounted
                      ? `<span style="color:#e11d48;font-size:10px;font-weight:bold;margin-left:6px;border:1px solid #fda4af;padding:1px 4px;border-radius:3px;background-color:#fff1f2;">ĐƯỢC GIẢM</span>`
                      : '';
                    return `
                      <tr>
                        <td style="padding:10px;border-bottom:1px solid #eee;">${it.package_name || 'Gói VR'}${badgeHtml}</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${it.quantity || 1}</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${Number(it.unit_price || it.discounted_unit_price || 0).toLocaleString('vi-VN')}đ</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${Number(it.line_total || Number(it.unit_price || 0) * (it.quantity || 1)).toLocaleString('vi-VN')}đ</td>
                      </tr>
                    `;
                  })
                  .join('');
              } else if (isComboVR) {
                // Orphan fallback notice
                vrRowsHtml = `
                  <tr>
                    <td colspan="4" style="padding:12px;border-bottom:1px solid #eee;text-align:center;color:#94a3b8;font-style:italic;">
                      Không có chi tiết gói VR
                    </td>
                  </tr>
                `;
              }

              if (vrRowsHtml) {
                vrTableHtml = `
                  <h3 style="margin-top:20px;color:#7c3aed;font-size:14px;text-transform:uppercase;">🎮 Trải nghiệm VR kèm theo</h3>
                  <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
                    <thead>
                      <tr style="background:#f1f5f9;color:#475569;">
                        <th style="padding:10px;text-align:left;">Gói VR</th>
                        <th style="padding:10px;text-align:center;">SL</th>
                        <th style="padding:10px;text-align:right;">Đơn giá</th>
                        <th style="padding:10px;text-align:right;">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${vrRowsHtml}
                    </tbody>
                  </table>
                `;
              }
            }

            // 3. Build consistent price breakdown HTML block
            const priceBreakdownHtml = `
              <div style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:8px;text-align:right;font-size:14px;">
                ${discountAmt > 0 ? `<p style="margin:4px 0;color:#64748b;">Tạm tính (Giá gốc): <b>${originalTotal.toLocaleString('vi-VN')}đ</b></p>` : ''}
                ${discountAmt > 0 ? `<p style="margin:4px 0;color:#16a34a;">${voucherScopeLabel(voucherScope)} ${voucherCode ? `(${voucherCode})` : ''}: <b>- ${discountAmt.toLocaleString('vi-VN')}đ</b></p>` : ''}
                <h3 style="margin:8px 0 0;color:#2563eb;font-size:18px;">Tổng thực tế thanh toán: ${totalPrice.toLocaleString('vi-VN')}đ</h3>
              </div>
            `;

            // Clean formatted ticket package name string for legacy template summary
            const cleanPackageName =
              parsedPackages.length > 0
                ? parsedPackages.map((p: any) => `${p.name || p.package_name || rawPkg} x${p.quantity || 1}`).join(', ')
                : rawPkg || 'Vé đơn';

            // === UNIFIED EMAIL DISPATCH FOR ALL BOOKING TYPES ===
            const templateData = {
                bookingCode: bookingCode || '',
                customerName: booking.name || 'Khách hàng',
                movieTitle: booking.movie_title || '',
                ticketCount: booking.ticket_count,
                totalPrice: Number(booking.total_price).toLocaleString('vi-VN'),
                durationMin: booking.movie_duration,
                ticketPackageName: cleanPackageName,
                expiryDate: updatedBooking?.expiry_date,
                branchName: result.branch_name,
                branchAddress: result.branch_address,
                branchPhone: result.branch_phone,
                branchSettings: result.branch_settings,
                moviePackagesTableHtml,
                vrTableHtml,
                originalTotal,
                discountAmt,
                voucherCode,
                bookingType: booking.booking_type
              };

              const emailTemplate = getBookingEmailHtml
                ? getBookingEmailHtml(templateData)
                : getBookingEmailTemplate(templateData);
              const mailer = sendMailFn;
              const effectiveOrderCode = bookingCode || booking.pay_txt_code || booking.id;
              const confirmSubject = `Xác nhận đặt vé thành công cho đơn #${effectiveOrderCode}`;

              if (mailer) {
                await mailer(booking.email, confirmSubject, emailTemplate);
                console.log(`[MailQueue] Đã gửi mail xác nhận cho booking ${booking.id} (${bookingType})`);
              } else {
                console.warn('[Payments] No mailer provided, skipping confirmation email');
              }
          } catch (err) {
            console.error(`[MailQueue] Lỗi gửi mail cho booking ${booking.id}:`, err);
            throw err;
          }
        },
        {
          db: anyDb,
          recipient: booking.email,
          subject: `Xác nhận đặt vé thành công cho đơn #${bookingCode || booking.pay_txt_code || booking.id}`,
          emailType: 'booking_confirmation',
          userId: booking.user_id || undefined,
          bookingId: booking.id,
          emailLogsTable: tables?.email_logs
        },
        context
      );
    }

    return {
      status: 200,
      message:
        payment_status === 'failed'
          ? 'Giao dịch đã được hủy thành công'
          : 'Giao dịch đã xử lý xong (Mail đã được gửi tới khách hàng)',
      booking: updatedBooking
    };
  } catch (err: any) {
    return {
      status: err?.status || 500,
      message: err?.message || 'Lỗi máy chủ nội bộ'
    };
  }
}
