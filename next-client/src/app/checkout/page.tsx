'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import {
        CheckCircle2,
        XCircle,
        Mail,
        Ticket,
        User,
        Film,
        ShoppingCart,
        ArrowLeft,
        Sparkles,
        Calendar,
        CreditCard,
        Hash,
        Phone,
        MapPin,
        Gamepad2,
        Copy,
        Clock,
        Loader2
} from 'lucide-react';
import UserLayout from '@/layouts/UserLayout';
import BookingSteps, { BOOKING_STEP, BOOKING_STEP_LABELS } from '@/components/user/BookingSteps';
import { toast } from 'sonner';
import { copyText } from '@/lib/clipboard';
import { getPublicBranches } from '@/lib/api/branches';
import { getPublicSchedule } from '@/lib/api/schedule';
import { buildUrl, fetchBookingStatus } from '@/lib/api';
import { classifyPaymentStatus } from '@/lib/payment-flow';
import { useAuthState } from '@/hooks/useAuthState';
import {
        parseMoviePackages,
        parseApplicableIds,
        isLineDiscounted,
        moviePackageLineTotal,
        moviePackagesTotalQty,
        vrLineTotal,
        vrPackageId,
        hasVrContent,
        bookingTypeBadge,
        voucherScopeLabel
} from '@shared/booking-invoice';

// The result page reads the order this browser saved. A paid order is kept for a day, so a refresh or a trip to the
// home page does not lose it, and a shared device does not keep customer details for long.
const SAVED_ORDER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Shown when neither the order nor the branch has a hotline (same number as the payment page)
const DEFAULT_HOTLINE = '036 643 1179';
// After this long on "processing", the page tells the customer what to do and offers a re-check
const SLOW_PROCESSING_MS = 60 * 1000;

function isSavedOrderStale(saved: any): boolean {
        const paidTime = Date.parse(saved?.paidAt || '');
        return Number.isFinite(paidTime) && Date.now() - paidTime > SAVED_ORDER_MAX_AGE_MS;
}

// The hotline from the saved phone or from the branch settings (a JSON text). A broken value gives ''.
function readHotline(phone: unknown, settings: unknown): string {
        if (typeof phone === 'string' && phone.trim()) return phone.trim();
        if (typeof settings !== 'string' || !settings.trim()) return '';
        try {
                const parsed = JSON.parse(settings);
                return typeof parsed?.hotline === 'string' ? parsed.hotline.trim() : '';
        } catch {
                return '';
        }
}

interface BranchInfo {
        address?: string;
        hotline?: string;
        opensAt?: string | null;
        closesAt?: string | null;
}

export default function Checkout() {
        const router = useRouter();
        const searchParams = useSearchParams();
        const [order, setOrder] = useState<any>(null);
        const [status, setStatus] = useState<string>('');
        const [loading, setLoading] = useState(false);
        const [bookingCode, setBookingCode] = useState<string | null>(null);
        const { userName, isLoading: authLoading } = useAuthState(true);
        const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
        const [isVR, setIsVR] = useState<boolean>(false);
        const [vrItems, setVrItems] = useState<any[]>([]);
        const [noOrder, setNoOrder] = useState<boolean>(false);
        const [branchInfo, setBranchInfo] = useState<BranchInfo>({});
        const [slowProcessing, setSlowProcessing] = useState<boolean>(false);
        const [codeFailed, setCodeFailed] = useState<boolean>(false);
        const [recheckKey, setRecheckKey] = useState<number>(0);
        const formatMoney = (n: number | string) => new Intl.NumberFormat('vi-VN').format(Number(n || 0));

        useEffect(() => {
                // Handle SePay callback (if redirect happens, though usually SePay is purely background.
                // If SePay redirects to checkout with params, we can handle it.
                // Typical SePay pattern is user manually returns or auto-redirects if configured).
                // Assuming SePay might not send specific params on redirect, or customization allowed.
                // If SePay redirects to /checkout without params, the polling logic will handle it using 'pendingOrder'.
                // If SePay sends params:
                // The query string of a payment redirect is not trusted. The status always comes from the server (below).
                let pending: any = null;

                const pendingJson = localStorage.getItem('pendingOrder');
                if (pendingJson) {
                        try {
                                pending = JSON.parse(pendingJson);
                        } catch {
                                pending = null;
                        }
                }
                // Fallback: nếu không có pending, thử lấy snapshot cuối cùng
                if (!pending) {
                        const lastJson = localStorage.getItem('lastCheckoutOrder');
                        if (lastJson) {
                                try {
                                        pending = JSON.parse(lastJson);
                                } catch {
                                        pending = null;
                                }
                        }
                }

                // An old paid order is dropped from this browser
                if (pending && pending.payment_status === 'paid' && isSavedOrderStale(pending)) {
                        try {
                                localStorage.removeItem('lastCheckoutOrder');
                        } catch { }
                        pending = null;
                }

                if (!pending) {
                        setNoOrder(true);
                        return;
                }

                const merged = { ...pending };
                setOrder(merged);
                setBookingCode(merged.booking_code ? String(merged.booking_code) : null);
                const vr = merged.booking_type === 'vr' || (Array.isArray(merged.vr_items) && merged.vr_items.length > 0);
                setIsVR(vr);
                if (vr && Array.isArray(merged.vr_items)) setVrItems(merged.vr_items);

                // "Thành công" is shown only for an order already confirmed as paid: the payment page saves that after the
                // server said so. An order that was just placed starts as "processing" until the server confirms it (below).
                if (merged.payment_status === 'paid') {
                        setStatus('success');
                } else if (merged.payment_status === 'failed') {
                        setStatus('failed');
                } else {
                        setStatus('processing');
                }

                const onAuthChanged = () => setIsLoggedIn(!!userName);
                window.addEventListener('user-auth-changed', onAuthChanged as any);
                window.addEventListener('storage', onAuthChanged as any);
                return () => {
                        window.removeEventListener('user-auth-changed', onAuthChanged as any);
                        window.removeEventListener('storage', onAuthChanged as any);
                };
        }, [searchParams, userName]);

        // Confirm the payment with the server. Only the payment state is read; the details shown on this page come from
        // what this browser saved when the order was placed. The ticket code is in the email (and the account history).
        useEffect(() => {
                if (!order?.booking_id || !order?.order_token) return;
                // A paid order that already has its code needs no second look
                if (order.payment_status === 'paid' && order.booking_code) return;

                let isCancelled = false;
                (async () => {
                        const result = await fetchBookingStatus(Number(order.booking_id), String(order.order_token));
                        if (isCancelled) return;

                        if (!result.ok) {
                                // The order is gone for this token. Any other error leaves the page on "processing".
                                if (result.httpStatus === 404 && order.payment_status !== 'paid') setStatus('failed');
                                if (order.payment_status === 'paid') setCodeFailed(true);
                                return;
                        }

                        const outcome = classifyPaymentStatus(result.data.payment_status);
                        if (outcome === 'paid') {
                                const serverCode = result.data.booking_code ? String(result.data.booking_code) : null;
                                const paidOrder = {
                                        ...order,
                                        payment_status: 'paid',
                                        paidAt: order.paidAt || new Date().toISOString(),
                                        booking_code: serverCode || order.booking_code || null
                                };
                                setStatus('success');
                                setOrder(paidOrder);
                                setBookingCode(paidOrder.booking_code);
                                setCodeFailed(!paidOrder.booking_code);
                                try {
                                        localStorage.setItem('lastCheckoutOrder', JSON.stringify(paidOrder));
                                        localStorage.removeItem('pendingOrder');
                                } catch { }
                        } else if (outcome === 'closed') {
                                setStatus('failed');
                        } else if (localStorage.getItem('qrPaymentData')) {
                                // Not paid yet and the QR page can still be used: go back to it
                                router.replace('/qr-payment');
                        }
                })();

                return () => {
                        isCancelled = true;
                };
        }, [order?.booking_id, recheckKey]);

        // "Still processing" for a long time: tell the customer what to do
        useEffect(() => {
                setSlowProcessing(false);
                if (status !== 'processing') return;
                const timer = setTimeout(() => setSlowProcessing(true), SLOW_PROCESSING_MS);
                return () => clearTimeout(timer);
        }, [status, recheckKey]);

        // Branch address, hotline and opening hours (the saved order only holds the branch name)
        useEffect(() => {
                const branchId = Number(order?.branch_id);
                if (!branchId) return;
                let isCancelled = false;
                (async () => {
                        try {
                                const [branches, schedule] = await Promise.all([getPublicBranches(), getPublicSchedule(branchId)]);
                                if (isCancelled) return;
                                const found = (branches?.items || []).find((branch: any) => Number(branch.id) === branchId);
                                setBranchInfo({
                                        address: found?.address || undefined,
                                        hotline: readHotline(found?.phone, found?.settings) || undefined,
                                        opensAt: schedule.opens_at,
                                        closesAt: schedule.closes_at
                                });
                        } catch { }
                })();
                return () => {
                        isCancelled = true;
                };
        }, [order?.branch_id]);

        const hotline =
                readHotline(order?.branch_phone, order?.branch_settings) || branchInfo.hotline || DEFAULT_HOTLINE;
        const branchAddress = order?.branch_address || branchInfo.address || '';

        const copyBookingCode = async () => {
                if (!bookingCode) return;
                if (await copyText(bookingCode)) {
                        toast.success('Đã sao chép mã');
                } else {
                        toast.error('Không sao chép được, hãy nhấn giữ vào mã để chọn');
                }
        };

        const recheck = () => {
                setCodeFailed(false);
                setRecheckKey((value) => value + 1);
        };

        const resolveImageUrl = (u: string | undefined | null) => {
                if (!u) return '';
                if (u.startsWith('http')) return u;
                return buildUrl(u);
        };
        const getGenresText = (g: any) => {
                try {
                        if (Array.isArray(g)) return g.join(' • ');
                        if (typeof g === 'string') {
                                const parsed = JSON.parse(g);
                                if (Array.isArray(parsed)) return parsed.join(' • ');
                                return g;
                        }
                        return '';
                } catch {
                        return typeof g === 'string' ? g : '';
                }
        };

        // Parse movie list from JSON
        const getMovieList = () => {
                try {
                        if (!order?.movie) return [];
                        let list = [];

                        if (typeof order.movie === 'string') {
                                const parsed = JSON.parse(order.movie);
                                list = Array.isArray(parsed) ? parsed : [{ title: order.movie }];
                        } else if (Array.isArray(order.movie)) {
                                list = order.movie;
                        } else {
                                list = [{ title: order.movie }];
                        }

                        // Normalize everything to objects
                        return list.map((item: any) => {
                                if (typeof item === 'string') return { title: item };
                                return {
                                        title: item.title || item.movie_title || '',
                                        duration: item.duration || item.duration_min
                                };
                        });
                } catch {
                        return [{ title: order?.movie || '' }];
                }
        };

        const movies = order ? getMovieList() : [];
        const isSuccess = status === 'success' || order?.payment_status === 'paid';
        const isError = status === 'failed' || order?.payment_status === 'failed';

        if (noOrder) {
                return (
                        <UserLayout className="bg-[#0f172a] border-none" hideFooter>
                                <section className="min-h-screen flex items-center justify-center pt-28 md:pt-32 pb-10 px-4">
                                        <div className="w-full max-w-md text-center space-y-4 bg-white/5 border border-white/10 rounded-3xl p-6">
                                                <h1 className="text-xl font-bold text-white">Không tìm thấy đơn gần đây</h1>
                                                <p className="text-sm text-slate-300 leading-relaxed">
                                                        Thiết bị này không còn lưu đơn vừa đặt. Mã đặt vé đã được gửi tới email bạn dùng khi đặt vé, và
                                                        bạn xem lại được ở mục Tài khoản nếu có đăng nhập. Cần hỗ trợ, vui lòng gọi hotline{' '}
                                                        <b className="text-white">{hotline}</b>.
                                                </p>
                                                <div className="flex flex-col gap-2 pt-2">
                                                        <Button className="h-11 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/account')}>
                                                                Xem trong Tài khoản
                                                        </Button>
                                                        <Button variant="outline" className="h-11" onClick={() => router.push('/')}>
                                                                Về trang chủ
                                                        </Button>
                                                </div>
                                        </div>
                                </section>
                        </UserLayout>
                );
        }

        return (
                <UserLayout className="bg-[#0f172a] border-none" hideFooter>
                        <section className="relative min-h-screen flex items-center justify-center pt-28 md:pt-32 lg:pt-36 pb-10 overflow-hidden">
                                {/* Animated Background Elements */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
                                        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
                                </div>

                                <div className="container mx-auto px-4 relative z-10">
                                        {/* A paid order finishes every step; an order still waiting or refused stays on the payment step */}
                                        <div className="w-full max-w-md md:max-w-lg mx-auto mb-4">
                                                <BookingSteps current={isSuccess ? BOOKING_STEP_LABELS.length : BOOKING_STEP.payment} />
                                        </div>
                                        <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.5 }}
                                                className="w-full max-w-md md:max-w-lg mx-auto relative"
                                        >
                                                {/* Ticket Cutouts Shadows/Glow */}
                                                <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-3xl" />

                                                {/* Main Ticket Box */}
                                                <div className="relative bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                                                        {/* Top Section: Status */}
                                                        <div
                                                                className={`p-1 pt-1 ${isSuccess ? 'bg-emerald-500/20' : isError ? 'bg-rose-500/20' : 'bg-slate-500/20'}`}
                                                        >
                                                                <div
                                                                        className={`flex items-center justify-center gap-2 py-3 rounded-t-[1.4rem] ${isSuccess ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-slate-500'}`}
                                                                >
                                                                        {isSuccess ? (
                                                                                <CheckCircle2 className="w-7 h-7 text-white" />
                                                                        ) : isError ? (
                                                                                <XCircle className="w-7 h-7 text-white" />
                                                                        ) : (
                                                                                <Loader2 className="w-7 h-7 text-white animate-spin" />
                                                                        )}
                                                                        <h1 className="text-white font-bold text-lg tracking-wide uppercase">
                                                                                {isSuccess ? 'Thanh toán thành công' : isError ? 'Thanh toán thất bại' : 'Đang xử lý...'}
                                                                        </h1>
                                                                </div>
                                                        </div>

                                                        {/* Ticket code: the one thing needed at the counter */}
                                                        {isSuccess && (
                                                                <div className="p-4 border-b border-white/10 bg-emerald-500/5 text-center space-y-2">
                                                                        <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
                                                                                Mã đặt vé
                                                                        </p>
                                                                        {bookingCode ? (
                                                                                <>
                                                                                        <p className="rounded-xl border-2 border-dashed border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-3xl md:text-4xl font-black text-white tracking-[0.2em] font-mono break-all select-all">
                                                                                                {bookingCode}
                                                                                        </p>
                                                                                        <Button
                                                                                                type="button"
                                                                                                variant="outline"
                                                                                                onClick={copyBookingCode}
                                                                                                className="h-11 px-5 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                                                                                        >
                                                                                                <Copy className="w-4 h-4 mr-2" />
                                                                                                Sao chép mã
                                                                                        </Button>
                                                                                        <p className="text-sm text-slate-300 leading-relaxed">
                                                                                                Đưa mã này cho nhân viên tại quầy để vào xem. Mã cũng đã được gửi tới email của bạn.
                                                                                        </p>
                                                                                </>
                                                                        ) : codeFailed ? (
                                                                                <>
                                                                                        <p className="text-sm text-slate-300 leading-relaxed">
                                                                                                Chưa tải được mã. Mã đã được gửi tới email của bạn, hoặc bạn bấm thử lại.
                                                                                        </p>
                                                                                        <Button type="button" variant="outline" onClick={recheck} className="h-11 px-5">
                                                                                                Thử lại
                                                                                        </Button>
                                                                                </>
                                                                        ) : (
                                                                                <p className="text-sm text-slate-400">Đang lấy mã...</p>
                                                                        )}
                                                                </div>
                                                        )}

                                                        {!isSuccess && !isError && (
                                                                <div className="p-4 border-b border-white/10 bg-white/[0.02] space-y-3 text-sm leading-relaxed">
                                                                        <p className="text-slate-200">
                                                                                Hệ thống đang xác nhận thanh toán của bạn. Vui lòng giữ trang này mở.
                                                                        </p>
                                                                        {slowProcessing && (
                                                                                <>
                                                                                        <p className="text-amber-300">
                                                                                                Việc xác nhận lâu hơn bình thường. Nếu bạn đã chuyển khoản, hãy giữ lại nội dung chuyển khoản
                                                                                                và liên hệ hotline <b className="text-white">{hotline}</b>.
                                                                                        </p>
                                                                                        <Button type="button" variant="outline" onClick={recheck} className="h-11 px-5">
                                                                                                Kiểm tra lại
                                                                                        </Button>
                                                                                </>
                                                                        )}
                                                                </div>
                                                        )}

                                                        {isError && (
                                                                <div className="p-4 border-b border-white/10 bg-rose-500/5 space-y-3 text-sm leading-relaxed">
                                                                        <p className="text-slate-200">
                                                                                Đơn hàng chưa được thanh toán, đã bị hủy hoặc đã hết hạn thanh toán.
                                                                        </p>
                                                                        <p className="text-slate-300">
                                                                                Nếu bạn đã chuyển khoản, vui lòng liên hệ hotline <b className="text-white">{hotline}</b> và
                                                                                cung cấp số tiền cùng nội dung chuyển khoản
                                                                                {order?.pay_txt_code ? <> (<b className="text-white">{order.pay_txt_code}</b>)</> : null}.
                                                                        </p>
                                                                        <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                onClick={() => router.push('/booking')}
                                                                                className="h-11 px-5"
                                                                        >
                                                                                Đặt vé lại
                                                                        </Button>
                                                                </div>
                                                        )}

                                                        {/* Tear-off line of the ticket: two notches and a dashed line between the code and the details */}
                                                        <div className="relative h-0" aria-hidden="true">
                                                                <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#0f172a]" />
                                                                <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#0f172a]" />
                                                                <div className="mx-5 border-t-2 border-dashed border-white/15" />
                                                        </div>

                                                        {/* Booking & Ticket Details (PROMINENT TOP SECTION) */}
                                                        <div className="p-4 bg-white/[0.02] border-b border-white/10 space-y-3">
                                                                {(() => {
                                                                        const discountAmount = Number(order?.voucher_discount_amount || 0);
                                                                        const voucherScope =
                                                                                order?.voucher_details?.scope ||
                                                                                order?.voucherDetails?.scope ||
                                                                                'all';
                                                                        const applicableIds = parseApplicableIds(
                                                                                order?.voucher_details?.applicable_ids ||
                                                                                        order?.voucherDetails?.applicable_ids
                                                                        );
                                                                        const moviePkgs = parseMoviePackages(
                                                                                order?.ticketPackageName || order?.ticket_package,
                                                                                {
                                                                                        quantity: order?.quantity || order?.ticket_count || 1,
                                                                                        price: Math.round(
                                                                                                Number(order?.amount || 0) /
                                                                                                        (order?.quantity || order?.ticket_count || 1)
                                                                                        )
                                                                                }
                                                                        );
                                                                        const listVr = vrItems?.length ? vrItems : order?.vr_items || [];
                                                                        const typeBadge = bookingTypeBadge(order?.booking_type, listVr);
                                                                        const showMovie = order?.booking_type !== 'vr';

                                                                        return (
                                                                                <>
                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                                <div className="flex items-center gap-1.5 text-slate-400">
                                                                                                        {typeBadge === 'VR' ? (
                                                                                                                <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
                                                                                                        ) : (
                                                                                                                <Ticket className="w-3.5 h-3.5 text-blue-400" />
                                                                                                        )}
                                                                                                        <span className="text-xs md:text-xs uppercase font-bold tracking-wider text-slate-400">
                                                                                                                Chi tiết đơn ({typeBadge})
                                                                                                        </span>
                                                                                                </div>
                                                                                                {order?.expiryDate && order?.booking_type !== 'vr' && (
                                                                                                        <p className="text-xs font-bold text-amber-400">
                                                                                                                HSD: {new Date(order.expiryDate).toLocaleDateString('vi-VN')}
                                                                                                        </p>
                                                                                                )}
                                                                                        </div>

                                                                                        {showMovie && (
                                                                                                <div className="space-y-2 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                                                                                                        <div className="flex justify-between items-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                                                                                <span>Gói vé phim</span>
                                                                                                                <span>{moviePackagesTotalQty(moviePkgs)} vé</span>
                                                                                                        </div>
                                                                                                        {moviePkgs.map((pkg, idx) => {
                                                                                                                const discounted = isLineDiscounted({
                                                                                                                        discountAmount,
                                                                                                                        scope: voucherScope,
                                                                                                                        applicableIds,
                                                                                                                        kind: 'movie',
                                                                                                                        packageId: pkg.package_id
                                                                                                                });
                                                                                                                return (
                                                                                                                        <div key={idx} className="flex justify-between items-center text-sm">
                                                                                                                                <span className="text-gray-200 font-medium max-w-[65%]">
                                                                                                                                        {pkg.name}
                                                                                                                                        {discounted ? (
                                                                                                                                                <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-xs font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                                                                                        ĐƯỢC GIẢM
                                                                                                                                                </span>
                                                                                                                                        ) : null}
                                                                                                                                </span>
                                                                                                                                <div className="flex items-center gap-3 text-right">
                                                                                                                                        <span className="text-xs text-gray-500">x{pkg.quantity}</span>
                                                                                                                                        <span className="font-bold text-white tabular-nums">
                                                                                                                                                {formatMoney(moviePackageLineTotal(pkg))} ₫
                                                                                                                                        </span>
                                                                                                                                </div>
                                                                                                                        </div>
                                                                                                                );
                                                                                                        })}
                                                                                                </div>
                                                                                        )}

                                                                                        {(listVr.length > 0 || order?.booking_type === 'combo_vr' || isVR) && (
                                                                                                <div className="space-y-2 rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                                                                                                        <div className="flex justify-between items-center text-xs text-purple-300 font-bold uppercase tracking-wider">
                                                                                                                <span className="flex items-center gap-1">
                                                                                                                        <Gamepad2 className="w-3 h-3" /> Gói VR
                                                                                                                </span>
                                                                                                                <span>{listVr.length} gói</span>
                                                                                                        </div>
                                                                                                        {listVr.length > 0 ? (
                                                                                                                listVr.map((it: any, i: number) => {
                                                                                                                        const discounted = isLineDiscounted({
                                                                                                                                discountAmount,
                                                                                                                                scope: voucherScope,
                                                                                                                                applicableIds,
                                                                                                                                kind: 'vr',
                                                                                                                                packageId: vrPackageId(it)
                                                                                                                        });
                                                                                                                        return (
                                                                                                                                <div key={i} className="flex justify-between items-center text-sm">
                                                                                                                                        <span className="text-purple-100 font-medium max-w-[65%]">
                                                                                                                                                {it.package_name || it.name || 'Gói VR'}
                                                                                                                                                {discounted ? (
                                                                                                                                                        <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-xs font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                                                                                                ĐƯỢC GIẢM
                                                                                                                                                        </span>
                                                                                                                                                ) : null}
                                                                                                                                        </span>
                                                                                                                                        <div className="flex items-center gap-3">
                                                                                                                                                <span className="text-xs text-gray-500">x{it.quantity}</span>
                                                                                                                                                <span className="text-purple-300 font-bold">
                                                                                                                                                        {formatMoney(vrLineTotal(it))} ₫
                                                                                                                                                </span>
                                                                                                                                        </div>
                                                                                                                                </div>
                                                                                                                        );
                                                                                                                })
                                                                                                        ) : (
                                                                                                                <div className="text-slate-400 italic text-xs">Không có chi tiết gói VR</div>
                                                                                                        )}
                                                                                                </div>
                                                                                        )}
                                                                                </>
                                                                        );
                                                                })()}
                                                        </div>

                                                        {/* Movie List (Subtle & Secondary background info) */}
                                                        {movies.length > 0 && movies[0]?.title && (
                                                                <div className="p-3 bg-white/[0.01] border-b border-white/5 space-y-1.5">
                                                                        <div className="flex items-center gap-1.5 text-slate-500">
                                                                                <Film className="w-3 h-3 text-slate-400" />
                                                                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phim có thể xem trong gói</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-slate-400">
                                                                                {movies.map((m: any, i: number) => (
                                                                                        <div key={i} className="flex items-center gap-1.5">
                                                                                                <span className="w-1 h-1 rounded-full bg-slate-500" />
                                                                                                <span>{m.title}</span>
                                                                                                {m.duration && <span className="text-xs text-slate-500">({m.duration}p)</span>}
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                </div>
                                                        )}

                                                        {/* Branch Info */}
                                                        {(order?.branch_name || branchAddress) && (
                                                                <div className="p-4 bg-white/[0.01] border-b border-white/5 space-y-3">
                                                                        <div className="flex items-start gap-2">
                                                                                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                                                        <MapPin className="w-4 h-4 text-blue-400" />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Chi nhánh</p>
                                                                                        <p className="text-sm font-bold text-slate-100">{order?.branch_name}</p>
                                                                                        {branchAddress && <p className="text-xs text-slate-400 leading-snug mt-0.5">{branchAddress}</p>}
                                                                                </div>
                                                                        </div>

                                                                        {branchInfo.opensAt && branchInfo.closesAt && (
                                                                                <div className="flex items-start gap-2">
                                                                                        <div className="p-1.5 bg-amber-500/10 rounded-lg">
                                                                                                <Clock className="w-4 h-4 text-amber-400" />
                                                                                        </div>
                                                                                        <div>
                                                                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Giờ mở cửa</p>
                                                                                                <p className="text-sm font-bold text-slate-100">
                                                                                                        {branchInfo.opensAt} – {branchInfo.closesAt}
                                                                                                </p>
                                                                                        </div>
                                                                                </div>
                                                                        )}

                                                                        <div className="flex items-start gap-2">
                                                                                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                                                                        <Phone className="w-4 h-4 text-emerald-400" />
                                                                                </div>
                                                                                <div>
                                                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Hotline hỗ trợ</p>
                                                                                        <a href={`tel:${hotline.replace(/[^0-9+]/g, '')}`} className="text-sm font-bold text-slate-100">
                                                                                                {hotline}
                                                                                        </a>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        )}

                                                        {/* Customer Banner */}
                                                        <div className="mx-3 p-2 bg-white/[0.06] border border-white/10 rounded-2xl space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                                                                        <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                                                                </div>
                                                                                <div>
                                                                                        <p className="text-xs md:text-xs text-slate-500 font-bold uppercase tracking-tight">
                                                                                                Khách hàng
                                                                                        </p>
                                                                                        <p className="text-sm md:text-base font-bold text-slate-200 leading-none">{order?.name}</p>
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-white/5">
                                                                        <div className="flex items-center gap-1.5">
                                                                                <Mail className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                                                                                <span className="text-xs md:text-sm text-slate-400 break-all">{order?.email}</span>
                                                                        </div>
                                                                        {order?.phone && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <Phone className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                                                                                        <span className="text-xs md:text-sm text-slate-400">{order?.phone}</span>
                                                                                </div>
                                                                        )}
                                                                </div>
                                                        </div>

                                                        {/* Bottom Section: Total & Footer */}
                                                        <div className="p-3 pt-3 space-y-3">
                                                                {/* Decorative Line */}
                                                                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                                                {/* Voucher & Price Breakdown Flow */}
                                                                {((order?.voucher_discount_amount && order.voucher_discount_amount > 0) || (order?.original_total_price && order.original_total_price > order?.amount)) && (
                                                                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2.5 space-y-1 text-xs">
                                                                                <div className="flex justify-between items-center text-slate-400">
                                                                                        <span>Tạm tính (Giá gốc)</span>
                                                                                        <span className="line-through">{formatMoney(order?.original_total_price || (Number(order?.amount || 0) + Number(order?.voucher_discount_amount || 0)))} ₫</span>
                                                                                </div>
                                                                                {(order?.voucher_code_snapshot || order?.voucher_code || (order?.voucher_discount_amount && order.voucher_discount_amount > 0)) && (
                                                                                        <div className="flex justify-between items-center text-emerald-400 font-semibold">
                                                                                                <span className="flex items-center gap-1">
                                                                                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                                                                                        {voucherScopeLabel(order?.voucher_details?.scope || order?.voucherDetails?.scope)}
                                                                                                        {order?.voucher_code_snapshot || order?.voucher_code
                                                                                                                ? ` (${order.voucher_code_snapshot || order.voucher_code})`
                                                                                                                : ''}
                                                                                                </span>
                                                                                                <span>-{formatMoney(order?.voucher_discount_amount || 0)} ₫</span>
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                )}

                                                                <div className="flex items-end justify-between">
                                                                        <div>
                                                                                <p className="text-xs md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                                                                        Tổng thanh toán
                                                                                </p>
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <ShoppingCart className="w-4 h-4 text-blue-400" />
                                                                                        <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                                                                                                {order ? (
                                                                                                        <>
                                                                                                                {formatMoney(order.amount)}
                                                                                                                <span className="text-base md:text-lg ml-1 text-slate-400">₫</span>
                                                                                                        </>
                                                                                                ) : (
                                                                                                        <span className="text-slate-500">---</span>
                                                                                                )}
                                                                                        </span>
                                                                                </div>
                                                                        </div>

                                                                        <div className="text-right flex flex-col items-end gap-1">
                                                                                <span
                                                                                        className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-tighter ${isSuccess
                                                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                                                }`}
                                                                                >
                                                                                        Chuyển khoản VietQR
                                                                                </span>
                                                                                {order?.paidAt && (
                                                                                        <p className="text-xs text-slate-500 font-medium">
                                                                                                Thực hiện lúc:{' '}
                                                                                                {new Date(order.paidAt).toLocaleString('vi-VN', {
                                                                                                        day: '2-digit',
                                                                                                        month: '2-digit',
                                                                                                        year: 'numeric',
                                                                                                        hour: '2-digit',
                                                                                                        minute: '2-digit'
                                                                                                })}
                                                                                        </p>
                                                                                )}
                                                                        </div>
                                                                </div>

                                                                {status === 'success' && (
                                                                        <motion.div
                                                                                initial={{ opacity: 0, y: 10 }}
                                                                                animate={{ opacity: 1, y: 0 }}
                                                                                transition={{ delay: 0.6 }}
                                                                                className="flex items-start gap-2 text-emerald-300 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 text-xs leading-relaxed"
                                                                        >
                                                                                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                                                <span>
                                                                                        Hệ thống đã gửi {!isVR ? 'thông tin vé chi tiết và ' : 'thông tin trải nghiệm VR chi tiết và '}<b>Mã đặt vé</b> tới <b>{order?.email}</b>. Quý khách vui
                                                                                        lòng kiểm tra email (bao gồm cả thư rác).
                                                                                </span>
                                                                        </motion.div>
                                                                )}

                                                                <Button
                                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 md:py-5 rounded-2xl shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.01] hover:-translate-y-0.5"
                                                                        onClick={() => router.push('/')}
                                                                >
                                                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                                                        Quay lại trang chủ
                                                                </Button>
                                                        </div>

                                                        {/* Decorative Corner Elements */}
                                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.06] -rotate-45 translate-x-1/2 -translate-y-1/2" />
                                                </div>

                                                {/* Footer Text */}
                                                <p className="text-center mt-4 text-slate-500 text-xs uppercase font-bold tracking-[0.2em]">
                                                        Cinesphere • {!isVR ? 'Trải nghiệm điện ảnh đỉnh cao' : 'Trải nghiệm VR đẳng cấp'}
                                                </p>
                                        </motion.div>
                                </div>
                        </section>
                </UserLayout>
        );
}
