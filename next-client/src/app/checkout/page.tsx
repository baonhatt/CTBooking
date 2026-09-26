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
        Gamepad2
} from 'lucide-react';
import UserLayout from '@/layouts/UserLayout';
import { buildUrl, confirmBookingApi, getBookingByIdApi, getVRBookingById } from '@/lib/api';
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
        const formatMoney = (n: number | string) => new Intl.NumberFormat('en-US').format(Number(n || 0));

        useEffect(() => {
                // Handle SePay callback (if redirect happens, though usually SePay is purely background.
                // If SePay redirects to checkout with params, we can handle it.
                // Typical SePay pattern is user manually returns or auto-redirects if configured).
                // Assuming SePay might not send specific params on redirect, or customization allowed.
                // If SePay redirects to /checkout without params, the polling logic will handle it using 'pendingOrder'.
                // If SePay sends params:
                const sepayGateway = searchParams.get('gateway');
                const sepayTransactionDate = searchParams.get('transactionDate');
                const sepayAmount = searchParams.get('transferAmount');
                const sepayContent = searchParams.get('transferContent');

                let pending: any = null;

                if (!pending) {
                        const s = localStorage.getItem('pendingOrder');
                        pending = s ? JSON.parse(s) : null;
                }
                // Fallback: nếu không có pending, thử lấy snapshot cuối cùng
                if (!pending) {
                        const last = localStorage.getItem('lastCheckoutOrder');
                        pending = last ? JSON.parse(last) : null;
                }

                // Nếu không có pending data, thử lấy từ localStorage trước khi về trang chủ
                if (!pending) {
                        const savedOrder = localStorage.getItem('lastCheckoutOrder');
                        if (savedOrder) {
                                try {
                                        const o = JSON.parse(savedOrder);
                                        setOrder(o);
                                        const vr = o.booking_type === 'vr' || (Array.isArray(o.vr_items) && o.vr_items.length > 0);
                                        setIsVR(vr);
                                        if (vr && Array.isArray(o.vr_items)) setVrItems(o.vr_items);
                                        setStatus(o.payment_status === 'paid' ? 'success' : o.payment_status === 'failed' ? 'failed' : 'success');
                                } catch { }
                        } else {
                                router.push('/');
                        }
                        return;
                }

                // Nếu có pending data, set order
                if (pending) {
                        const merged = { ...pending };
                        setOrder(merged);
                        const vr = merged.booking_type === 'vr' || (Array.isArray(merged.vr_items) && merged.vr_items.length > 0);
                        setIsVR(vr);
                        if (vr && Array.isArray(merged.vr_items)) setVrItems(merged.vr_items);
                        // VietQR/SePay - default to success if payment_status is paid or not set (webhook already confirmed)
                        setStatus(merged.payment_status === 'failed' ? 'failed' : 'success');
                        localStorage.removeItem('pendingOrder');
                }

                // SePay handling
                if (sepayGateway && pending && pending.booking_id) {
                        // SePay usually confirms via webhook, but we can optimistically set loading or success if we trust the redirect
                        // However, we should just let the polling (below) check the status from DB.
                        // Or we can force a check.
                        setStatus('processing'); // Show processing while polling checks status

                        // Optional: Notify backend we are here, though webhook handles the core logic.
                        // Just wait for poll to update status to "success"
                }

                const onAuthChanged = () => setIsLoggedIn(!!userName);
                window.addEventListener('user-auth-changed', onAuthChanged as any);
                window.addEventListener('storage', onAuthChanged as any);
                return () => {
                        window.removeEventListener('user-auth-changed', onAuthChanged as any);
                        window.removeEventListener('storage', onAuthChanged as any);
                };
        }, [searchParams, userName]);

        useEffect(() => {
                if (!order?.booking_id) return;
                (async () => {
                        try {
                                const bookingData = await getBookingByIdApi(Number(order.booking_id));
                                if (bookingData) {
                                        const newStatus =
                                                bookingData.payment_status === 'paid' ? 'success' : bookingData.payment_status === 'failed' ? 'failed' : '';
                                        if (newStatus) setStatus(newStatus);
                                        if ((bookingData as any).booking_code) {
                                                setBookingCode((bookingData as any).booking_code);
                                        }
                                        const bookingType = (bookingData as any).booking_type || 'movie';
                                        let vrList: any[] = Array.isArray((bookingData as any).vr_items)
                                                ? (bookingData as any).vr_items
                                                : [];
                                        if (vrList.length === 0 && (bookingType === 'vr' || bookingType === 'combo_vr')) {
                                                try {
                                                        const vrDetail = await getVRBookingById(Number(order.booking_id));
                                                        vrList = vrDetail?.vr_items || [];
                                                } catch { }
                                        }
                                        const vr = hasVrContent(bookingType, vrList);
                                        setIsVR(vr);
                                        setVrItems(vrList);

                                        const merged = {
                                                ...order,
                                                amount: bookingData.total_price ?? order.amount,
                                                original_total_price: (bookingData as any).original_total_price ?? order.original_total_price,
                                                voucher_discount_amount: (bookingData as any).voucher_discount_amount ?? order.voucher_discount_amount,
                                                voucher_code_snapshot: (bookingData as any).voucher_code_snapshot ?? order.voucher_code_snapshot ?? order.voucher_code,
                                                voucher_details:
                                                        (bookingData as any).voucher_details ||
                                                        (bookingData as any).voucherDetails ||
                                                        order.voucher_details ||
                                                        null,
                                                payment_status: bookingData.payment_status ?? order.payment_status,
                                                name: bookingData.name ?? order.name,
                                                phone: bookingData.phone ?? order.phone,
                                                email: bookingData.email ?? order.email,
                                                method: bookingData.payment_method ?? order.method,
                                                movie: (bookingData as any).movie_title || order.movie,
                                                poster: (bookingData as any).movie_image || order.poster,
                                                duration: (bookingData as any).duration_min || order.duration,
                                                ticketPackageName: (bookingData as any).ticket_package_name || order.ticketPackageName,
                                                expiryDate: (bookingData as any).expiry_date || order.expiryDate,
                                                paidAt: (bookingData as any).paid_at || order.paidAt,
                                                booking_type: bookingType,
                                                vr_items: vrList
                                        } as any;
                                        setOrder(merged);
                                        try {
                                                localStorage.setItem('lastCheckoutOrder', JSON.stringify(merged));
                                        } catch { }
                                }
                        } catch { }
                })();
        }, [order?.booking_id]);

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

        return (
                <UserLayout className="bg-[#0f172a] border-none" hideFooter>
                        <section className="relative min-h-screen flex items-center justify-center pt-28 md:pt-32 lg:pt-36 pb-10 overflow-hidden">
                                {/* Animated Background Elements */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
                                        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
                                </div>

                                <div className="container mx-auto px-4 relative z-10">
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
                                                                                <CheckCircle2 className="w-6 h-6 text-white animate-bounce" />
                                                                        ) : isError ? (
                                                                                <XCircle className="w-6 h-6 text-white animate-pulse" />
                                                                        ) : (
                                                                                <Sparkles className="w-6 h-6 text-white animate-spin" />
                                                                        )}
                                                                        <h1 className="text-white font-bold text-lg tracking-wide uppercase">
                                                                                {isSuccess ? 'Thanh toán thành công' : isError ? 'Thanh toán thất bại' : 'Đang xử lý...'}
                                                                        </h1>
                                                                </div>
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
                                                                                                        <span className="text-[10px] md:text-xs uppercase font-bold tracking-wider text-slate-400">
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
                                                                                                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
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
                                                                                                                                                <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-[8px] font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                                                                                        ĐƯỢC GIẢM
                                                                                                                                                </span>
                                                                                                                                        ) : null}
                                                                                                                                </span>
                                                                                                                                <div className="flex items-center gap-3 text-right">
                                                                                                                                        <span className="text-xs text-gray-500">x{pkg.quantity}</span>
                                                                                                                                        <span className="font-bold text-white tabular-nums">
                                                                                                                                                {formatMoney(moviePackageLineTotal(pkg))}₫
                                                                                                                                        </span>
                                                                                                                                </div>
                                                                                                                        </div>
                                                                                                                );
                                                                                                        })}
                                                                                                </div>
                                                                                        )}

                                                                                        {(listVr.length > 0 || order?.booking_type === 'combo_vr' || isVR) && (
                                                                                                <div className="space-y-2 rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                                                                                                        <div className="flex justify-between items-center text-[10px] text-purple-300 font-bold uppercase tracking-wider">
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
                                                                                                                                                        <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-[8px] font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded">
                                                                                                                                                                ĐƯỢC GIẢM
                                                                                                                                                        </span>
                                                                                                                                                ) : null}
                                                                                                                                        </span>
                                                                                                                                        <div className="flex items-center gap-3">
                                                                                                                                                <span className="text-xs text-gray-500">x{it.quantity}</span>
                                                                                                                                                <span className="text-purple-300 font-bold">
                                                                                                                                                        {formatMoney(vrLineTotal(it))}₫
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
                                                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Phim có thể xem trong gói</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-xs text-slate-400">
                                                                                {movies.map((m: any, i: number) => (
                                                                                        <div key={i} className="flex items-center gap-1.5">
                                                                                                <span className="w-1 h-1 rounded-full bg-slate-500" />
                                                                                                <span>{m.title}</span>
                                                                                                {m.duration && <span className="text-[10px] text-slate-500">({m.duration}p)</span>}
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                </div>
                                                        )}

                                                                {/* Branch Info */}
                                                                {order?.branch_name && (
                                                                        <div className="p-3 bg-white/[0.01] border-b border-white/5 space-y-2">
                                                                                <div className="flex items-start gap-2">
                                                                                        <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                                                                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                                                                                        </div>
                                                                                        <div>
                                                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Chi nhánh</p>
                                                                                                <p className="text-sm font-bold text-slate-100">{order.branch_name}</p>
                                                                                                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{order.branch_address}</p>
                                                                                        </div>
                                                                                </div>

                                                                                {(order.branch_phone || (order.branch_settings && JSON.parse(order.branch_settings).hotline)) && (
                                                                                        <div className="flex items-center gap-2">
                                                                                                <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                                                                                                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                                                                                </div>
                                                                                                <div>
                                                                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Hotline hỗ trợ</p>
                                                                                                        <p className="text-sm font-bold text-slate-100">
                                                                                                                {order.branch_phone || JSON.parse(order.branch_settings).hotline}
                                                                                                        </p>
                                                                                                </div>
                                                                                        </div>
                                                                                )}
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
                                                                                        <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-tight">
                                                                                                Khách hàng
                                                                                        </p>
                                                                                        <p className="text-sm md:text-base font-bold text-slate-200 leading-none">{order?.name}</p>
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-white/5">
                                                                        <div className="flex items-center gap-1.5">
                                                                                <Mail className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                                                                                <span className="text-xs md:text-sm text-slate-400">{order?.email}</span>
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
                                                                                        <span className="line-through">{formatMoney(order?.original_total_price || (Number(order?.amount || 0) + Number(order?.voucher_discount_amount || 0)))}₫</span>
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
                                                                                                <span>-{formatMoney(order?.voucher_discount_amount || 0)}₫</span>
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                )}

                                                                <div className="flex items-end justify-between">
                                                                        <div>
                                                                                <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                                                                        Tổng thanh toán
                                                                                </p>
                                                                                <div className="flex items-center gap-1.5">
                                                                                        <ShoppingCart className="w-4 h-4 text-blue-400" />
                                                                                        <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                                                                                                {formatMoney(order?.amount)}
                                                                                                <span className="text-base md:text-lg ml-1 text-slate-400">₫</span>
                                                                                        </span>
                                                                                </div>
                                                                        </div>

                                                                        <div className="text-right flex flex-col items-end gap-1">
                                                                                <span
                                                                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${isSuccess
                                                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                                                }`}
                                                                                >
                                                                                        VietQR Payment
                                                                                </span>
                                                                                <p className="text-[9px] text-slate-500 font-medium">
                                                                                        Thực hiện lúc:{' '}
                                                                                        {order?.paidAt
                                                                                                ? new Date(order.paidAt).toLocaleString('vi-VN', {
                                                                                                        day: '2-digit',
                                                                                                        month: '2-digit',
                                                                                                        year: 'numeric',
                                                                                                        hour: '2-digit',
                                                                                                        minute: '2-digit',
                                                                                                        second: '2-digit'
                                                                                                })
                                                                                                : new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                                                </p>
                                                                        </div>
                                                                </div>

                                                                {status === 'success' && (
                                                                        <motion.div
                                                                                initial={{ opacity: 0, y: 10 }}
                                                                                animate={{ opacity: 1, y: 0 }}
                                                                                transition={{ delay: 0.6 }}
                                                                                className="flex items-start gap-2 text-emerald-300 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 text-[11px] leading-relaxed"
                                                                        >
                                                                                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                                                <span>
                                                                                        Hệ thống đã gửi {!isVR ? 'thông tin vé chi tiết và **Mã đặt vé**' : 'thông tin trải nghiệm VR chi tiết và **Mã đặt chỗ**'} tới <b>{order?.email}</b>. Quý khách vui
                                                                                        lòng kiểm tra email (bao gồm cả thư rác).
                                                                                </span>
                                                                        </motion.div>
                                                                )}

                                                                <Button
                                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 md:py-5 rounded-2xl shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.01] hover:-translate-y-0.5"
                                                                        onClick={() => {
                                                                                localStorage.removeItem('pendingOrder');
                                                                                localStorage.removeItem('lastCheckoutOrder');
                                                                                router.push('/');
                                                                        }}
                                                                >
                                                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                                                        Quay lại Trang Chủ
                                                                </Button>
                                                        </div>

                                                        {/* Decorative Corner Elements */}
                                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.06] -rotate-45 translate-x-1/2 -translate-y-1/2" />
                                                </div>

                                                {/* Footer Text */}
                                                <p className="text-center mt-4 text-slate-500 text-[10px] uppercase font-bold tracking-[0.2em]">
                                                        CineSphere • {!isVR ? 'Trải nghiệm điện ảnh đỉnh cao' : '🎮 Trải nghiệm VR đẳng cấp'}
                                                </p>
                                        </motion.div>
                                </div>
                        </section>
                </UserLayout>
        );
}
