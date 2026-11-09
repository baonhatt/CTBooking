import { eq } from 'drizzle-orm';
import { getBookingEmailTemplate } from '../../../lib/booking-utils';
import { escapeHtml } from '../../../lib/email-templates';
import { mailQueue } from '../../../lib/mail-queue';
import { isLineDiscounted, voucherScopeLabel, parseApplicableIds, vrPackageId } from '@shared/booking-invoice';

/** The booking row with the fields the confirmation email needs from other tables. */
export interface BookingEmailSource {
  booking: any;
  package_name?: string | null;
  branch_name?: string | null;
  branch_address?: string | null;
  branch_phone?: string | null;
  branch_settings?: string | null;
}

/**
 * Builds the "booking confirmed" email for a paid booking and puts it in the mail queue.
 * It is used when a booking becomes paid and when staff send the email again. The queue writes an email log row
 * (status pending, then sent or failed) for every call.
 */
export function queueBookingConfirmationEmail(args: {
  anyDb: any;
  tables: any;
  source: BookingEmailSource;
  /** The saved booking, for the expiry date */
  updatedBooking: any;
  bookingCode: string | null;
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>;
  getBookingEmailHtml?: (data: any) => string;
  context?: { waitUntil: (promise: Promise<any>) => void };
}) {
  const { anyDb, tables, source, updatedBooking, bookingCode, sendMailFn, getBookingEmailHtml, context } = args;
  const result = source;
  const booking = source.booking;
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
                    <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(pkgName)}${badgeHtml}</td>
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
                      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.package_name || 'Gói VR')}${badgeHtml}</td>
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
              ${discountAmt > 0 ? `<p style="margin:4px 0;color:#16a34a;">${voucherScopeLabel(voucherScope)} ${voucherCode ? `(${escapeHtml(voucherCode)})` : ''}: <b>- ${discountAmt.toLocaleString('vi-VN')}đ</b></p>` : ''}
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
