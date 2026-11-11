'use client';

import { Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  parseMoviePackages,
  parseApplicableIds,
  isLineDiscounted,
  moviePackageLineTotal,
  vrLineTotal,
  vrPackageId,
  bookingTypeBadge,
  hasVrContent,
  voucherScopeLabel
} from '@shared/booking-invoice';
import { parseData, formatDateTime, getBookingCode, formatMoney } from '@/lib/account-format';

interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The order shown; null while it loads
  tx: any | null;
  onCopy: (text: string) => void;
}

/** The ticket of one order (code, items, branch, totals), opened from the history list of the account page. */
export default function TicketDetailDialog({ open, onOpenChange, tx, onCopy }: TicketDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0b1426] border border-white/10 text-white w-[95vw] sm:max-w-md rounded-[2.5rem] p-[1px] overflow-hidden max-h-[92dvh] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] focus:outline-none duration-500 animate-in fade-in zoom-in-95 slide-in-from-bottom-10">
            <DialogHeader className="sr-only">
                <DialogTitle>Chi tiết vé</DialogTitle>
                <DialogDescription>Chi tiết thông tin vé và mã xác nhận của bạn.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[92dvh] custom-scrollbar rounded-[2.5rem]">
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.3);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(59, 130, 246, 0.5);
    }
  `
                    }}
                />

                {tx ? (
                    <div className="relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none" />

                        <div className="p-6 sm:p-8 pb-4 pr-16 sm:pr-20 relative">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter italic uppercase">
                                        Cinesphere{' '}
                                        <span className="text-blue-500 font-light underline underline-offset-4 decoration-1 opacity-80">
                                            Ticket
                                        </span>
                                    </h2>
                                </div>

                                {tx.payment_status === 'paid' ? (
                                    <span
                                        className={`text-xs px-2.5 py-1 rounded-full border font-bold tracking-tight ${tx.is_used
                                                ? 'border-gray-500/30 text-gray-500 bg-gray-500/5'
                                                : tx.isExpired
                                                    ? 'border-rose-500/30 text-rose-500 bg-rose-500/5'
                                                    : 'border-green-500/50 text-green-400 bg-green-500/10 animate-pulse'
                                            }`}
                                    >
                                        {tx.is_used ? 'Đã dùng' : tx.isExpired ? 'Đã hết hạn' : 'Còn hiệu lực'}
                                    </span>
                                ) : tx.payment_status === 'expired' ? (
                                    <span className="text-xs px-2.5 py-1 rounded-full border font-bold tracking-tight border-slate-500/30 text-slate-400 bg-slate-500/5">
                                        Hết hạn thanh toán
                                    </span>
                                ) : tx.payment_status === 'failed' || tx.payment_status === 'cancelled' ? (
                                    <span className="text-xs px-2.5 py-1 rounded-full border font-bold tracking-tight border-rose-500/30 text-rose-400 bg-rose-500/5">
                                        Đã hủy thanh toán
                                    </span>
                                ) : (
                                    <span className="text-xs px-2.5 py-1 rounded-full border font-bold tracking-tight border-amber-500/30 text-amber-400 bg-amber-500/5">
                                        Chờ thanh toán
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="px-5 sm:px-8 pb-10 space-y-5 sm:space-y-6">
                            <div>
                                <div
                                    className={`rounded-[1.5rem] p-[1px] bg-gradient-to-b ${tx.is_used ? 'from-white/20 to-white/5' : 'from-blue-500/50 to-blue-500/20'}`}
                                >
                                    <div className="bg-[#0b1426] rounded-[1.4rem] p-6 text-center">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-4 tracking-[0.3em]">
                                            Mã đặt vé: đưa mã này cho nhân viên tại rạp
                                        </p>

                                        <div className="flex items-center justify-center gap-4 relative">
                                            {tx.is_used && (
                                                <div className="absolute rotate-[-12deg] border-4 border-red-500/40 text-red-500/40 px-4 py-1 font-black text-2xl z-20 pointer-events-none rounded-xl">
                                                    ĐÃ DÙNG
                                                </div>
                                            )}

                                            <span
                                                onClick={() => {
                                                    if (tx.payment_status === 'paid' && !tx.is_used) {
                                                        onCopy(getBookingCode(tx));
                                                    }
                                                }}
                                                className={`text-2xl sm:text-4xl font-mono font-black tracking-[0.2em] transition-all ${tx.is_used ? 'text-gray-800 line-through blur-[1px]' : 'text-white text-glow-blue cursor-pointer hover:opacity-80'}`}
                                                title={tx.payment_status === 'paid' && !tx.is_used ? 'Bấm để sao chép' : ''}
                                            >
                                                {tx.payment_status === 'paid' ? getBookingCode(tx) : '••••••'}
                                            </span>

                                            {tx.payment_status === 'paid' && !tx.is_used && (
                                                <button
                                                    onClick={() => onCopy(getBookingCode(tx))}
                                                    aria-label="Sao chép mã đặt vé"
                                                    className="h-11 w-11 shrink-0 flex items-center justify-center bg-blue-500 hover:bg-blue-400 text-white rounded-xl shadow-lg shadow-blue-500/20 active:scale-90 transition-all"
                                                >
                                                    <Copy size={20} />
                                                </button>
                                            )}
                                        </div>

                                        <p className="mt-6 text-xs text-gray-500 font-medium italic">
                                            {tx.is_used
                                                ? 'Cảm ơn bạn đã sử dụng dịch vụ!'
                                                : 'Vui lòng không chia sẻ mã này với bất kỳ ai.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[#0b1426] rounded-full -translate-y-1/2 z-10 border-r border-white/10" />
                                <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[#0b1426] rounded-full -translate-y-1/2 z-10 border-l border-white/10" />

                                <div
                                    className={`bg-gradient-to-br from-white/10 to-white/[0.02] rounded-2xl p-4 sm:p-6 border border-white/10 shadow-inner transition-all duration-500 ${tx.is_used ? 'grayscale opacity-50' : ''}`}
                                >
                                    {(() => {
                                        const discountAmount = Number(tx.discount_amount || 0);
                                        const voucherScope = tx.voucher_details?.scope || 'all';
                                        const applicableIds = parseApplicableIds(tx.voucher_details?.applicable_ids);
                                        const moviePkgs = parseMoviePackages(tx.ticket_package, {
                                            quantity: tx.quantity
                                        });
                                        const isVrOnly = tx.booking_type === 'vr';
                                        const showVr = hasVrContent(tx.booking_type, tx.vr_items);

                                        return (
                                            <>
                                                <div className="flex justify-between items-end mb-4">
                                                    <div>
                                                        <p className="text-xs text-blue-400 uppercase font-bold tracking-widest mb-1 opacity-70">
                                                            Chi tiết đơn
                                                        </p>
                                                        <h3 className="text-lg sm:text-xl font-black text-white">
                                                            {bookingTypeBadge(tx.booking_type, tx.vr_items)}
                                                        </h3>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1 opacity-70">
                                                            Số lượng
                                                        </p>
                                                        <p className="text-lg sm:text-xl font-black text-white leading-none">
                                                            × {tx.quantity}
                                                        </p>
                                                    </div>
                                                </div>

                                                {!isVrOnly && (
                                                    <div className="space-y-2 mt-2">
                                                        <p className="text-xs text-blue-400 uppercase font-bold tracking-wider">
                                                            Gói vé phim
                                                        </p>
                                                        <div className="space-y-1.5">
                                                            {moviePkgs.map((pkg, idx) => {
                                                                const discounted = isLineDiscounted({
                                                                    discountAmount,
                                                                    scope: voucherScope,
                                                                    applicableIds,
                                                                    kind: 'movie',
                                                                    packageId: pkg.package_id
                                                                });
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className="flex justify-between items-center text-xs bg-white/5 border border-white/10 px-3 py-2 rounded-lg"
                                                                    >
                                                                        <span className="text-gray-200 font-medium">
                                                                            {pkg.name}
                                                                            {discounted ? (
                                                                                <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-xs font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                    ĐƯỢC GIẢM
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-gray-500">x{pkg.quantity}</span>
                                                                            <span className="text-white font-bold">
                                                                                {formatMoney(moviePackageLineTotal(pkg))} ₫
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {parseData(tx.movie).length > 0 && (
                                                    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                                                            Danh sách phim:
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Array.from(new Set(parseData(tx.movie))).map((m: any, idx: number) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 bg-white/5 border border-white/5 rounded-md text-xs text-gray-400"
                                                                >
                                                                    {m}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {showVr && (
                                                    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                                                        <p className="text-xs text-purple-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                                                            <span>Trải nghiệm VR:</span>
                                                        </p>
                                                        {tx.vr_items && tx.vr_items.length > 0 ? (
                                                            <div className="space-y-1.5">
                                                                {tx.vr_items.map((vr: any, idx: number) => {
                                                                    const discounted = isLineDiscounted({
                                                                        discountAmount,
                                                                        scope: voucherScope,
                                                                        applicableIds,
                                                                        kind: 'vr',
                                                                        packageId: vrPackageId(vr)
                                                                    });
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className="flex justify-between items-center text-xs bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-lg"
                                                                        >
                                                                            <span className="text-purple-200 font-medium">
                                                                                {vr.package_name} (x{vr.quantity})
                                                                                {discounted ? (
                                                                                    <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-xs font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                        ĐƯỢC GIẢM
                                                                                    </span>
                                                                                ) : null}
                                                                            </span>
                                                                            <span className="text-purple-300 font-bold">
                                                                                {formatMoney(vrLineTotal(vr))} ₫
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : tx.booking_type === 'combo_vr' ? (
                                                            <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-center text-xs text-gray-400 italic">
                                                                Không có chi tiết gói VR
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                                                                    <div className="grid grid-cols-2 gap-y-5 px-2 text-sm">
                                {tx.branch_name && (
                                    <div className="col-span-2 space-y-1">
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter">Chi nhánh</p>
                                        <p className="text-white font-medium">{tx.branch_name}</p>
                                        {tx.branch_address && (
                                            <p className="text-xs text-gray-400 leading-snug">{tx.branch_address}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                                        {tx.payment_status === 'paid' ? 'Ngày thanh toán' : 'Ngày đặt vé'}
                                    </p>
                                    <p className="text-white font-medium">
                                        {formatDateTime(
                                            tx.payment_status === 'paid' ? tx.paid_at : tx.created_at
                                        )}
                                    </p>
                                </div>

                                {tx.is_used ? (
                                    <div className="space-y-1 text-right">
                                        <p className="text-xs text-blue-400 font-bold uppercase tracking-tighter">
                                            Đã dùng vào lúc
                                        </p>
                                        <p className="text-blue-300 font-bold italic">{formatDateTime(tx.updated_at)}</p>
                                    </div>
                                ) : tx.expiry_date ? (
                                    <div className="space-y-1 text-right">
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                                            Ngày hết hạn
                                        </p>
                                        <p className={tx.isExpired ? 'text-red-400 font-bold' : 'text-white font-medium'}>{formatDateTime(tx.expiry_date)}</p>
                                    </div>
                                ) : null}

                                <div className="col-span-2 flex flex-col gap-2 pt-4 mt-2 border-t border-white/5">
                                    {tx.discount_amount > 0 && (
                                        <>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-400 font-bold uppercase">Tổng tiền chưa giảm:</span>
                                                <span className="text-gray-300 font-medium">{formatMoney(tx.original_amount)} ₫</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-emerald-400 font-bold uppercase">
                                                    {voucherScopeLabel(tx.voucher_details?.scope)}
                                                    {tx.voucher_code ? ` (${tx.voucher_code})` : ''}:
                                                </span>
                                                <span className="text-emerald-400 font-medium">-{formatMoney(tx.discount_amount)} ₫</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Số tiền thanh toán:</span>
                                        <span className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                                            {formatMoney(tx.amount)}
                                            <span className="text-lg ml-0.5 text-blue-400/80">₫</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="p-32 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-sm font-bold text-blue-400 animate-pulse uppercase tracking-widest">
                            Đang tải...
                        </span>
                    </div>
                )}
            </div>
        </DialogContent>
    </Dialog>
  );
}
