import { eq } from 'drizzle-orm';
import { getBookingEmailTemplate } from '../../../lib/booking-utils';
import { EMAIL_SUBJECTS } from '../../../lib/email-templates';
import type { ItemLine } from '../../../lib/email-layout';
import { mailQueue } from '../../../lib/mail-queue';
import { isLineDiscounted, parseApplicableIds, vrPackageId } from '@shared/booking-invoice';

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

          // Movie package lines for the confirmation mail
          const packageLines: ItemLine[] = [];
          if (parsedPackages.length > 0 && !isVR) {
            for (const pkg of parsedPackages) {
              const quantity = Number(pkg.quantity || booking.ticket_count || 1);
              const unitPrice = Number(pkg.unit_price || pkg.price || booking.ticket_unit_price || 0);
              packageLines.push({
                name: String(pkg.name || pkg.package_name || rawPkg || 'Gói vé'),
                quantity,
                unitPrice,
                lineTotal: unitPrice > 0 ? unitPrice * quantity : 0,
                discounted: isLineDiscounted({
                  discountAmount: discountAmt,
                  scope: voucherScope,
                  applicableIds,
                  kind: 'movie',
                  packageId: pkg.package_id || pkg.id || booking.ticket_package_id
                })
              });
            }
          }

          // VR lines for the confirmation mail
          const vrLines: ItemLine[] = vr_items.map((item: any) => {
            const quantity = Number(item.quantity || 1);
            const unitPrice = Number(item.unit_price || item.discounted_unit_price || 0);
            return {
              name: String(item.package_name || 'Gói VR'),
              quantity,
              unitPrice,
              lineTotal: Number(item.line_total || unitPrice * quantity),
              discounted: isLineDiscounted({
                discountAmount: discountAmt,
                scope: voucherScope,
                applicableIds,
                kind: 'vr',
                packageId: vrPackageId(item)
              })
            };
          });
          const vrEmptyNotice = isComboVR && vrLines.length === 0;

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
              packageLines,
              vrLines,
              vrEmptyNotice,
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
            const confirmSubject = EMAIL_SUBJECTS.bookingConfirmation(effectiveOrderCode);

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
        subject: EMAIL_SUBJECTS.bookingConfirmation(bookingCode || booking.pay_txt_code || booking.id),
        emailType: 'booking_confirmation',
        userId: booking.user_id || undefined,
        bookingId: booking.id,
        emailLogsTable: tables?.email_logs
      },
      context
    );
}
