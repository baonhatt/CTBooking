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
import { createMomoPaymentApi, API_BASE_URL, SERVER_BASE_URL, confirmBookingApi, getBookingByIdApi, getVRBookingById } from '@/lib/api';
import { useAuthState } from '@/hooks/useAuthState';

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
                const raw = searchParams.get('vnp_OrderInfo');
                let bookingId_vnpay = '';
                if (raw) {
                        // raw chỉ là số dạng chuỗi "54"
                        bookingId_vnpay = raw;
                        // Lưu booking_id vào localStorage để load lại vẫn có (bền hơn sessionStorage)
                        localStorage.setItem('lastVnpayBookingId', raw);
                } else {
                        // Nếu URL không có, check localStorage
                        const saved = localStorage.getItem('lastVnpayBookingId');
                        if (saved) {
                                bookingId_vnpay = saved;
                        }
                }
                // Handle MoMo callback
                const resultCode = searchParams.get('resultCode');
                const amountParam = searchParams.get('amount');
                const extraData = searchParams.get('extraData');
                const transId =
                        searchParams.get('transId') || searchParams.get('requestId') || searchParams.get('orderId') || (undefined as any);

                // Handle VNPay callback
                const vnpResponseCode = searchParams.get('vnp_ResponseCode');
                const vnpTxnRef = searchParams.get('vnp_TxnRef');
                const vnpTransactionNo = searchParams.get('vnp_TransactionNo');

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
                // Lấy pending data từ extraData (MoMo) hoặc localStorage
                if (extraData) {
                        try {
                                pending = JSON.parse(decodeURIComponent(escape(atob(extraData))));
                        } catch { }
                }

                // Nếu là VNPay với booking_id từ URL hoặc sessionStorage, fetch booking info từ API
                if (bookingId_vnpay && !pending) {
                        // Kiểm tra nếu booking_id từ URL (lần đầu callback) hay từ sessionStorage (load lại)
                        const isFirstCallback = raw && vnpResponseCode && vnpTxnRef;

                        (async () => {
                                try {
                                        const bookingData = await getBookingByIdApi(Number(bookingId_vnpay));
                                        if (bookingData) {
                                                const bookingType = (bookingData as any).booking_type || 'movie';
                                                const vr = bookingType === 'vr';
                                                let vrList: any[] = [];
                                                if (vr) {
                                                        try {
                                                                const vrDetail = await getVRBookingById(Number(bookingId_vnpay));
                                                                vrList = vrDetail?.vr_items || [];
                                                        } catch { }
                                                }
                                                setIsVR(vr);
                                                setVrItems(vrList);

                                                const pendingFromApi = {
                                                        orderId: `ORDER${bookingData.id}`,
                                                        movie: '',
                                                        dateDisplay: '',
                                                        name: bookingData.name,
                                                        phone: bookingData.phone,
                                                        email: bookingData.email,
                                                        emailBook: bookingData.email,
                                                        quantity: bookingData.ticket_count,
                                                        amount: bookingData.total_price,
                                                        method: 'vnpay',
                                                        booking_id: bookingData.id,
                                                        user_id: bookingData.user_id,
                                                        payment_status: bookingData.payment_status,
                                                        booking_type: bookingType,
                                                        vr_items: vrList
                                                };
                                                setOrder(pendingFromApi);
                                                try {
                                                        localStorage.setItem('lastCheckoutOrder', JSON.stringify(pendingFromApi));
                                                } catch { }

                                                // Chỉ gọi handleVNPayCallback nếu là lần đầu callback (URL có vnp params)
                                                if (isFirstCallback) {
                                                        handleVNPayCallback(vnpResponseCode, vnpTxnRef, vnpTransactionNo, pendingFromApi);
                                                } else {
                                                        // Load lại hoặc vào từ sessionStorage - chỉ show status, không gọi update API
                                                        if (bookingData.payment_status === 'paid') {
                                                                setStatus('success');
                                                        } else if (bookingData.payment_status === 'failed') {
                                                                setStatus('failed');
                                                        }
                                                }
                                        }
                                } catch (err) {
                                        console.error('Error fetching booking:', err);
                                }
                        })();
                        return;
                }

                if (!pending) {
                        const s = localStorage.getItem('pendingOrder');
                        pending = s ? JSON.parse(s) : null;
                }
                // Fallback: nếu không có pending, thử lấy snapshot cuối cùng
                if (!pending) {
                        const last = localStorage.getItem('lastCheckoutOrder');
                        pending = last ? JSON.parse(last) : null;
                }

                // Nếu không có booking_id (VNPay) và không có pending data (MoMo), redirect trang chủ
                if (!bookingId_vnpay && !pending && !resultCode) {
                        // Thử lấy từ localStorage trước khi về trang chủ
                        const savedId = localStorage.getItem('lastVnpayBookingId');
                        const savedOrder = localStorage.getItem('lastCheckoutOrder');
                        if (savedId) {
                                bookingId_vnpay = savedId;
                                (async () => {
                                        try {
                                                const bookingData = await getBookingByIdApi(Number(bookingId_vnpay));
                                                if (bookingData) {
                                                        const bookingType = (bookingData as any).booking_type || 'movie';
                                                        const vr = bookingType === 'vr';
                                                        let vrList: any[] = [];
                                                        if (vr) {
                                                                try {
                                                                        const vrDetail = await getVRBookingById(Number(bookingId_vnpay));
                                                                        vrList = vrDetail?.vr_items || [];
                                                                } catch { }
                                                        }
                                                        setIsVR(vr);
                                                        setVrItems(vrList);

                                                        const pendingFromApi = {
                                                                orderId: `ORDER${bookingData.id}`,
                                                                movie: '',
                                                                dateDisplay: '',
                                                                name: bookingData.name,
                                                                phone: bookingData.phone,
                                                                email: bookingData.email,
                                                                emailBook: bookingData.email,
                                                                quantity: bookingData.ticket_count,
                                                                amount: bookingData.total_price,
                                                                method: 'vnpay',
                                                                booking_id: bookingData.id,
                                                                user_id: bookingData.user_id,
                                                                payment_status: bookingData.payment_status,
                                                                booking_type: bookingType,
                                                                vr_items: vrList
                                                        };
                                                        setOrder(pendingFromApi);
                                                        setStatus(
                                                                bookingData.payment_status === 'paid'
                                                                        ? 'success'
                                                                        : bookingData.payment_status === 'failed'
                                                                                ? 'failed'
                                                                                : ''
                                                        );
                                                        localStorage.setItem('lastCheckoutOrder', JSON.stringify(pendingFromApi));
                                                }
                                        } catch { }
                                })();
                        } else if (savedOrder) {
                                try {
                                        const o = JSON.parse(savedOrder);
                                        setOrder(o);
                                        const vr = o.booking_type === 'vr' || (Array.isArray(o.vr_items) && o.vr_items.length > 0);
                                        setIsVR(vr);
                                        if (vr && Array.isArray(o.vr_items)) setVrItems(o.vr_items);
                                        setStatus(o.payment_status === 'paid' ? 'success' : o.payment_status === 'failed' ? 'failed' : '');
                                } catch { }
                        } else {
                                router.push('/');
                        }
                        return;
                }

                // Nếu có pending data, set order
                if (pending) {
                        const merged = { ...pending };
                        if (amountParam) merged.amount = Number(amountParam);
                        setOrder(merged);
                        const vr = merged.booking_type === 'vr' || (Array.isArray(merged.vr_items) && merged.vr_items.length > 0);
                        setIsVR(vr);
                        if (vr && Array.isArray(merged.vr_items)) setVrItems(merged.vr_items);
                }

                // MoMo payment handling
                if (resultCode) {
                        // Kiểm tra nếu lần đầu callback (có extraData) hay load lại (extraData rỗng nhưng còn resultCode)
                        const isFirstMomoCallback = !!extraData;

                        setStatus(resultCode === '0' ? 'success' : 'failed');
                        const payment_status = resultCode === '0' ? 'paid' : 'failed';

                        // Chỉ gọi confirmBookingApi nếu là lần đầu callback
                        if (isFirstMomoCallback && pending && pending.booking_id) {
                                confirmBookingApi({
                                        user_id: Number(pending.user_id || 0),
                                        payment_id: Number(pending.booking_id),
                                        payment_status,
                                        transaction_id: transId as any,
                                        paid_at: new Date().toISOString()
                                })
                                        .then(() => {
                                                // Xóa URL params sau khi update thành công
                                                window.history.replaceState({}, document.title, window.location.pathname);
                                        })
                                        .catch(() => { });
                        }
                        try {
                                const snap = { ...(pending || {}), payment_status };
                                const vr = snap.booking_type === 'vr' || (Array.isArray(snap.vr_items) && snap.vr_items.length > 0);
                                setIsVR(vr);
                                if (vr && Array.isArray(snap.vr_items)) setVrItems(snap.vr_items);
                                localStorage.setItem('lastCheckoutOrder', JSON.stringify(snap));
                        } catch { }
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
                                        const vr = bookingType === 'vr';
                                        let vrList: any[] = [];
                                        if (vr) {
                                                try {
                                                        const vrDetail = await getVRBookingById(Number(order.booking_id));
                                                        vrList = vrDetail?.vr_items || [];
                                                } catch { }
                                        }
                                        setIsVR(vr);
                                        setVrItems(vrList);

                                        const merged = {
                                                ...order,
                                                amount: bookingData.total_price ?? order.amount,
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

        const handleVNPayCallback = (
                vnpResponseCode: string | null,
                vnpTxnRef: string | null,
                vnpTransactionNo: string | null,
                pendingData: any
        ) => {
                const isSuccess = vnpResponseCode === '00';
                setStatus(isSuccess ? 'success' : 'failed');

                if (isSuccess && pendingData && pendingData.booking_id) {
                        console.log('Confirming VNPay booking...');
                        confirmBookingApi({
                                user_id: Number(pendingData.user_id || 0),
                                payment_id: Number(pendingData.booking_id),
                                payment_status: 'paid',
                                transaction_id: vnpTransactionNo || vnpTxnRef || undefined,
                                paid_at: new Date().toISOString()
                        })
                                .then(() => {
                                        // Xóa URL params sau khi update thành công, tránh gọi API lặp lại khi load lại trang
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                })
                                .catch((err) => {
                                        console.error('Error confirming booking:', err);
                                });
                } else if (!isSuccess && pendingData && pendingData.booking_id) {
                        console.log('VNPay payment failed, updating status to failed...');
                        confirmBookingApi({
                                user_id: Number(pendingData.user_id || 0),
                                payment_id: Number(pendingData.booking_id),
                                payment_status: 'failed',
                                transaction_id: vnpTransactionNo || vnpTxnRef || undefined,
                                paid_at: new Date().toISOString()
                        })
                                .then(() => {
                                        // Xóa URL params sau khi update thành công
                                        window.history.replaceState({}, document.title, window.location.pathname);
                                })
                                .catch((err) => {
                                        console.error('Error confirming booking:', err);
                                });
                }
                localStorage.removeItem('pendingOrder');
        };

        async function payWithMomo() {
                if (!order) return;
                try {
                        setLoading(true);
                        const partnerCode = process.env.NEXT_PUBLIC_MOMO_PARTNER_CODE || '';
                        const partnerName = process.env.NEXT_PUBLIC_MOMO_PARTNER_NAME || 'CineSphere';
                        const storeId = process.env.NEXT_PUBLIC_MOMO_STORE_ID || 'devstore';
                        const clientBase = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
                        const redirectPath = process.env.NEXT_PUBLIC_MOMO_REDIRECT_URL || '/checkout';
                        const ipnPath = process.env.NEXT_PUBLIC_MOMO_IPN_URL || '/api/momo/ipn';
                        const redirectUrl = `${clientBase}${redirectPath}`;
                        // Nếu clientBase là localhost thì serverBase cũng phải là localhost khi dev
                        // Nhưng nếu đang chạy production thì serverBase phải là domain thật
                        // Tuy nhiên logic serverBase ở đây hơi rối, nên tách bạch:
                        // - redirectUrl: URL user sẽ được chuyển về (Client URL)
                        // - ipnUrl: URL MoMo gọi server (Server API URL)
                        const serverBase = SERVER_BASE_URL || clientBase;
                        const ipnUrl = `${serverBase}${ipnPath}`;
                        const accessKey = process.env.NEXT_PUBLIC_MOMO_ACCESS_KEY || '';
                        const secretKey = process.env.NEXT_PUBLIC_MOMO_SECRET_KEY || '';
                        const requestId = Date.now().toString();
                        const orderId = order.orderId || `ORDER${Date.now()}`;
                        const orderInfo = isVR
                                ? `Đặt trải nghiệm VR | ${vrItems?.reduce((s, i) => s + (i.quantity || 0), 0) || order?.quantity || 1} gói`
                                : `${order.movie || 'Movie'} | ${order.quantity} vé`;
                        const extraDataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(order))));
                        const payload = {
                                partnerCode,
                                partnerName,
                                storeId,
                                requestId,
                                amount: order.amount,
                                orderId,
                                orderInfo,
                                redirectUrl,
                                ipnUrl,
                                lang: 'vi',
                                extraData: extraDataEncoded,
                                requestType: 'captureWallet',
                                signature: '',
                                accessKey,
                                secretKey
                        } as any;
                        const res = await createMomoPaymentApi(payload);
                        if (res?.payUrl) {
                                localStorage.setItem('pendingOrder', JSON.stringify({ ...order, orderId }));
                                window.location.href = res.payUrl;
                                return;
                        }
                        throw new Error('Không nhận được liên kết thanh toán MoMo');
                } catch (err) {
                        console.error(err);
                } finally {
                        setLoading(false);
                }
        }

        const resolveImageUrl = (u: string | undefined | null) => {
                if (!u) return '';
                if (u.startsWith('http')) return u;
                const path = u.startsWith('/') ? u : `/${u}`;
                return `${API_BASE_URL}${path}`;
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
                        <section className="relative min-h-screen flex items-center justify-center pt-16 md:pt-20 lg:pt-24 pb-10 overflow-hidden">
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

                                                        {/* Movie / VR List Section */}
                                                        {!isVR ? (
                                                                <div className="p-3 pb-1">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                                                                        <Film className="w-4 h-4 text-blue-400" />
                                                                                </div>
                                                                                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Danh sách phim</h2>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                {movies.map((m: any, i: number) => (
                                                                                        <div key={i} className="flex items-start gap-3 group">
                                                                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                                                                                <div className="flex-1">
                                                                                                        <p className="text-slate-100 font-semibold leading-snug group-hover:text-blue-400 transition-colors">
                                                                                                                {m.title}
                                                                                                        </p>
                                                                                                        {m.duration && (
                                                                                                                <span className="text-[10px] text-slate-500 font-medium">{m.duration} phút</span>
                                                                                                        )}
                                                                                                </div>
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                </div>
                                                        ) : (
                                                                <div className="p-3 pb-1">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                                                                        <Gamepad2 className="w-4 h-4 text-purple-400" />
                                                                                </div>
                                                                                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Danh sách gói VR</h2>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                {(vrItems?.length ? vrItems : (order?.vr_items || [])).map((it: any, i: number) => {
                                                                                        const lineTotal = Number(it.line_total || it.unit_price * it.quantity || 0);
                                                                                        return (
                                                                                                <div key={i} className="flex items-start gap-3 group">
                                                                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                                                                                                        <div className="flex-1">
                                                                                                                <p className="text-slate-100 font-semibold leading-snug group-hover:text-purple-400 transition-colors">
                                                                                                                        {it.package_name || 'Gói VR'}
                                                                                                                </p>
                                                                                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                                                                                                        {it.duration_min && (
                                                                                                                                <span className="text-[10px] text-slate-500 font-medium">{it.duration_min} phút</span>
                                                                                                                        )}
                                                                                                                        {it.quantity > 0 && (
                                                                                                                                <span className="text-[10px] text-slate-500 font-medium">x{it.quantity}</span>
                                                                                                                        )}
                                                                                                                        {lineTotal > 0 && (
                                                                                                                                <span className="text-[10px] text-amber-400 font-bold">{formatMoney(lineTotal)}₫</span>
                                                                                                                        )}
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        );
                                                                                })}
                                                                        </div>
                                                                </div>
                                                        )}

                                                        {/* Dashed Separator with Cutouts */}
                                                        <div className="relative h-2 flex items-center my-1">
                                                                <div className="absolute left-0 -translate-x-1/2 w-5 h-5 bg-[#0f172a] rounded-full border border-white/15" />
                                                                <div className="absolute right-0 translate-x-1/2 w-5 h-5 bg-[#0f172a] rounded-full border border-white/15" />
                                                                <div className="w-full border-t border-dashed border-white/20" />
                                                        </div>

                                                        {/* Booking & Ticket Details */}
                                                        <div className="p-3 pt-1 grid grid-cols-2 gap-x-6 gap-y-1">
                                                                {/* Package / VR Type */}
                                                                <div className="space-y-1">
                                                                        <div className="flex items-center gap-1.5 text-slate-500">
                                                                                {!isVR ? (
                                                                                        <Ticket className="w-3 h-3 md:w-4 md:h-4" />
                                                                                ) : (
                                                                                        <Gamepad2 className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                                                                                )}
                                                                                <span className="text-[10px] md:text-xs uppercase font-bold tracking-tighter">
                                                                                        {!isVR ? 'Gói vé' : 'Loại đơn'}
                                                                                </span>
                                                                        </div>
                                                                        <p className="text-sm md:text-base font-bold text-slate-200">
                                                                                {!isVR
                                                                                        ? (order?.ticketPackageName || 'Vé đơn')
                                                                                        : '🎮 Trải nghiệm VR'}
                                                                        </p>
                                                                </div>

                                                                {/* Date/Expiry - Chỉ show cho phim */}
                                                                {!isVR && order?.expiryDate && (
                                                                        <div className="space-y-1">
                                                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                                                        <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                                                                                        <span className="text-[10px] md:text-xs uppercase font-bold tracking-tighter">Hết hạn</span>
                                                                                </div>
                                                                                <p className="text-sm md:text-base font-bold text-amber-400">
                                                                                        {new Date(order.expiryDate).toLocaleDateString('vi-VN')}
                                                                                </p>
                                                                        </div>
                                                                )}

                                                                {/* VR Số lượng gói (nếu nhiều hơn 1 loại, tạm ẩn hoặc show tổng quantity) */}
                                                                {isVR && vrItems?.length > 0 && (
                                                                        <div className="space-y-1">
                                                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                                                        <Ticket className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                                                                                        <span className="text-[10px] md:text-xs uppercase font-bold tracking-tighter">Số loại gói</span>
                                                                                </div>
                                                                                <p className="text-sm md:text-base font-bold text-slate-200">
                                                                                        {vrItems.length} gói
                                                                                </p>
                                                                        </div>
                                                                )}

                                                                {/* Unit Price */}
                                                                <div className="space-y-1">
                                                                        <div className="flex items-center gap-1.5 text-slate-500">
                                                                                <CreditCard className="w-3 h-3 md:w-4 md:h-4" />
                                                                                <span className="text-[10px] md:text-xs uppercase font-bold tracking-tighter">
                                                                                        {!isVR ? 'Giá đơn' : 'Thành tiền / gói'}
                                                                                </span>
                                                                        </div>
                                                                        <p className="text-sm md:text-base font-medium text-slate-300">
                                                                                {!isVR
                                                                                        ? `${formatMoney(order?.amount / (order?.quantity || 1))}₫`
                                                                                        : (vrItems?.length === 1
                                                                                                ? `${formatMoney(Number(vrItems[0]?.unit_price || vrItems[0]?.discounted_unit_price || order?.amount))}₫`
                                                                                                : `${formatMoney(order?.amount)}₫ (tổng)`
                                                                                        )}
                                                                        </p>
                                                                </div>

                                                                {/* Quantity */}
                                                                <div className="space-y-1 text-right">
                                                                        <div className="flex items-center justify-end gap-1.5 text-slate-500">
                                                                                <span className="text-[10px] md:text-xs uppercase font-bold tracking-tighter">
                                                                                        {!isVR ? 'Số lượng' : 'Tổng lượt chơi'}
                                                                                </span>
                                                                        </div>
                                                                        <p className="text-xl md:text-2xl font-black text-white italic">
                                                                                x{!isVR
                                                                                        ? (order?.quantity || 1)
                                                                                        : (vrItems?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || order?.quantity || 1)
                                                                                }
                                                                        </p>
                                                                </div>

                                                                {/* Branch Info */}
                                                                {order?.branch_name && (
                                                                        <div className="col-span-2 mt-2 pt-2 border-t border-white/5 space-y-2">
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
                                                        </div>

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

                                                                <div className="flex items-end justify-between">
                                                                        <div>
                                                                                <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                                                                        Tổng cộng
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
                                                                                        {order?.method === 'momo'
                                                                                                ? 'Momo Wallet'
                                                                                                : order?.method === 'vnpay'
                                                                                                        ? 'VNPAY'
                                                                                                        : 'VietQR Payment'}
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
                                                                                localStorage.removeItem('lastVnpayBookingId');
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
