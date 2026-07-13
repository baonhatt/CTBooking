'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
        getActiveTickets,
        createBookingApi,
        createMomoPaymentApi,
        createVnpayPaymentApi,
        API_BASE_URL,
        SERVER_BASE_URL,
        validateBookingApi,
} from "@/lib/api";
import { optimizeCloudinaryUrl } from "@/lib/utils";
import UserLayout from "@/layouts/UserLayout";
import { ArrowLeft, ArrowRight, CreditCard, ChevronRight, X, Loader2 } from "lucide-react";

export default function BookingPage() {
        // Đổi USE_MOCK_DATA = false khi đã có API thật
        const USE_MOCK_DATA = true;
        const router = useRouter();
        const [step, setStep] = useState<0 | 1>(0);
        const [movie, setMovie] = useState<string>(''); // Keep for backward compatibility
        const [ticketCount, setTicketCount] = useState<number>(1);
        const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
        const [name, setName] = useState<string>('');
        const [phone, setPhone] = useState<string>('');
        const [phoneError, setPhoneError] = useState<string>('');
        const [email, setEmail] = useState<string>('');
        const [emailError, setEmailError] = useState<string>('');
        const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'vietqr'>('vietqr');
        const [isProcessing, setIsProcessing] = useState(false);
        const [showMovies, setShowMovies] = useState(false);
        const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
        const countdownRef = useRef<NodeJS.Timeout | null>(null);
        const [countdown, setCountdown] = useState(600);
        const [confirmChecked, setConfirmChecked] = useState(false);
        const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
        const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);
        const backdropConfig = {
                base: Number(process.env.NEXT_PUBLIC_BACKDROP_DARK_BASE ?? 0.5),
                min: Number(process.env.NEXT_PUBLIC_BACKDROP_DARK_MIN ?? 0.4),
                max: Number(process.env.NEXT_PUBLIC_BACKDROP_DARK_MAX ?? 0.7),
                brightness: Number(process.env.NEXT_PUBLIC_BACKDROP_BRIGHTNESS ?? 0.85),
                blurPx: Number(process.env.NEXT_PUBLIC_BACKDROP_BLUR ?? 2)
        };
        const [overlayDark, setOverlayDark] = useState(backdropConfig.base);

        // Prefetch các trang để tránh lag khi điều hướng
        useEffect(() => {
                router.prefetch('/qr-payment');
                router.prefetch('/checkout');
                router.prefetch('/');
        }, [router]);

        const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
                queryKey: ['activeTickets'],
                queryFn: ({ signal }) => getActiveTickets({ signal })
        });
        const isLoadingPage = isLoadingTickets;

        const [activeMoviesFull, setActiveMoviesFull] = useState<any[]>([]);
        const [selectedMovieIds, setSelectedMovieIds] = useState<number[]>([]);
        const selectedMovie = activeMoviesFull.find((m) => selectedMovieIds.includes(m.id)) || activeMoviesFull[0];
        const selectedMovies = activeMoviesFull.filter((m) => selectedMovieIds.includes(m.id));
        const ticketPackages = (ticketsData?.items || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description || '',
                price: Number(t.price || 0),
                features: Array.isArray(t.features) ? t.features : [],
                type: t.type || '',
                display_order: t.display_order || 0,
                movies: t.movies || []
        }));
        const defaultTicket = ticketPackages.sort((a, b) => a.display_order - b.display_order)[0];
        const unitPrice = Number(selectedPackage?.price || 0);
        const totalPrice = unitPrice * ticketCount;
        const MIN_TICKETS = 1;
        const MAX_TICKETS = 10;
        const [combo, setCombo] = useState<any>();
        useEffect(() => {
                return () => {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                };
        }, []);

        useEffect(() => {
                if (selectedPackage && Array.isArray(ticketPackages) && ticketPackages.length > 0) {
                        const canonical = ticketPackages.find((p: any) => Number(p.id) === Number(selectedPackage.id));
                        if (canonical) {
                                const hasFull = Array.isArray(selectedPackage.features) && typeof selectedPackage.description === 'string';
                                if (!hasFull || JSON.stringify(selectedPackage) !== JSON.stringify(canonical)) {
                                        setSelectedPackage(canonical);
                                        // Update activeMoviesFull when package changes
                                        setActiveMoviesFull(canonical.movies || []);
                                        // Clear selected movies when package changes
                                        setSelectedMovieIds([]);
                                        setMovie('');
                                }
                        }
                }
        }, [ticketPackages, selectedPackage]);
        useEffect(() => {
                try {
                        const rawSel = localStorage.getItem('selectedFilm');
                        if (rawSel && Array.isArray(activeMoviesFull) && activeMoviesFull.length > 0) {
                                const sel = JSON.parse(rawSel);
                                const found = activeMoviesFull.find((m: any) => m?.id === sel?.id || m?.title === sel?.title);
                                if (found?.title) {
                                        setMovie(found.title);
                                }
                                localStorage.removeItem('selectedFilm');
                        }
                } catch { }
        }, [activeMoviesFull]);

        useEffect(() => {
                try {
                        const raw = localStorage.getItem('selectedTicketPackage');
                        if (raw) {
                                const pkg = JSON.parse(raw);
                                setSelectedPackage(pkg);
                                localStorage.removeItem('selectedTicketPackage');
                        }
                } catch { }
        }, []);

        useEffect(() => {
                const url = selectedMovie?.cover_image;
                if (!url) return;
                try {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.src = resolveImageUrl(url);
                        img.onload = () => {
                                try {
                                        const canvas = document.createElement('canvas');
                                        const w = 32,
                                                h = 32;
                                        canvas.width = w;
                                        canvas.height = h;
                                        const ctx = canvas.getContext('2d');
                                        if (!ctx) return;
                                        ctx.drawImage(img, 0, 0, w, h);
                                        const data = ctx.getImageData(0, 0, w, h).data;
                                        let sum = 0;
                                        for (let i = 0; i < data.length; i += 4) {
                                                const r = data[i],
                                                        g = data[i + 1],
                                                        b = data[i + 2];
                                                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                                                sum += lum;
                                        }
                                        const avg = sum / (data.length / 4);
                                        // Map brightness to overlay opacity with clamps
                                        let dark =
                                                avg >= 180
                                                        ? backdropConfig.base + 0.18
                                                        : avg >= 150
                                                                ? backdropConfig.base + 0.12
                                                                : avg >= 120
                                                                        ? backdropConfig.base + 0.06
                                                                        : backdropConfig.base - 0.06;
                                        dark = Math.max(backdropConfig.min, Math.min(backdropConfig.max, dark));
                                        setOverlayDark(dark);
                                } catch {
                                        setOverlayDark(backdropConfig.base);
                                }
                        };
                } catch {
                        setOverlayDark(backdropConfig.base);
                }
        }, [selectedMovie?.cover_image]);

        useEffect(() => {
                try {
                        const profRaw = localStorage.getItem('userProfile');
                        if (profRaw) {
                                const p = JSON.parse(profRaw);
                                if (!email && p?.email) setEmail(p.email);
                                if (!name && p?.name) setName(p.name);
                                if (!phone && p?.phone) setPhone(p.phone);
                                return;
                        }
                } catch { }
        }, [email, name, phone]);

        // Clear form errors when fields become valid
        useEffect(() => {
                if (phone.length === 10 && phone.startsWith('0') && /^\d+$/.test(phone) && formErrors.phone) {
                        clearFormError('phone');
                }
        }, [phone, formErrors.phone]);

        useEffect(() => {
                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && /@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(email) && formErrors.email) {
                        clearFormError('email');
                }
        }, [email, formErrors.email]);

        const resolveImageUrl = (u: string | undefined | null) => {
                if (!u) return '';
                if (u.startsWith('http')) return u;
                const path = u.startsWith('/') ? u : `/${u}`;
                return `${API_BASE_URL}${path}`;
        };

        const clearFormError = (field: string) => {
                if (formErrors[field]) {
                        setFormErrors(prev => ({ ...prev, [field]: '' }));
                }
        };

        const validateForm = () => {
                const errors: {[key: string]: string} = {};
                
                if (!selectedPackage?.id) {
                        errors.ticketPackage = 'Vui lòng chọn loại vé';
                }
                
                if (!name.trim()) {
                        errors.name = 'Vui lòng nhập họ và tên';
                } else if (name.trim().length < 2) {
                        errors.name = 'Họ và tên phải có ít nhất 2 ký tự';
                }
                
                if (!phone.trim()) {
                        errors.phone = 'Vui lòng nhập số điện thoại';
                } else if (phone.length !== 10) {
                        errors.phone = 'Số điện thoại phải có 10 số';
                } else if (!phone.startsWith('0')) {
                        errors.phone = 'Số điện thoại phải bắt đầu bằng số 0';
                } else if (phoneError) {
                        errors.phone = phoneError;
                }
                
                if (!email.trim()) {
                        errors.email = 'Vui lòng nhập email';
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        errors.email = 'Email không hợp lệ';
                } else if (!/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(email)) {
                        errors.email = 'Vui lòng dùng Gmail, Outlook, Yahoo hoặc iCloud';
                } else if (emailError) {
                        errors.email = emailError;
                }
                
                setFormErrors(errors);
                return Object.keys(errors).length === 0;
        };

        const handleCreateAndPay = async () => {
                if (isProcessing) return;
                if (!confirmChecked) {
                        toast.error('Vui lòng xác nhận thông tin', {
                                description: 'Hãy tick vào ô xác nhận trước khi thanh toán'
                        });
                        return;
                }
                if (!selectedMovie) {
                        toast.error('Chưa chọn phim', {
                                description: 'Vui lòng chọn một bộ phim'
                        });
                        return;
                }
                if (!selectedPackage?.id) {
                        toast.error('Chưa chọn loại vé', {
                                description: 'Vui lòng chọn một loại vé trong danh sách'
                        });
                        return;
                }
                if (!name || !phone || !email) {
                        toast.error('Thiếu thông tin', {
                                description: 'Vui lòng nhập họ tên, số điện thoại và email'
                        });
                        return;
                }

                // Nếu đang dùng mock data, hiển thị thông báo demo
                if (!USE_MOCK_DATA) {
                        toast.info('Demo Mode', {
                                description: 'Đang sử dụng mock data. Chức năng thanh toán sẽ hoạt động khi có API thật.'
                        });
                        console.log('Demo booking:', {
                                movie: selectedMovie.title,
                                ticket: selectedPackage.name,
                                quantity: ticketCount,
                                total: totalPrice,
                                customer: { name, email, phone }
                        });
                        return;
                }

                setShowPaymentConfirmDialog(true);
        };

        const performBooking = async () => {
                try {
                        const comboData = ticketsData?.items.find((value) => value?.id === selectedPackage?.id);
                        setIsProcessing(true);
                        const orderId = `CP${Date.now()}`;
                        const movieDetail = selectedMovie;
                        const ticketPackageId = selectedPackage?.id || defaultTicket?.id;
                        const finalCombo = selectedMovieIds.length > 0 ? selectedMovieIds : comboData.combo;

                        const validation = await validateBookingApi({
                                email,
                                emailBook: email,
                                phone,
                                name,
                                movieId: selectedMovie?.id,
                                ticketCount,
                                ticketPackageId: selectedPackage?.id,
                                combo: finalCombo
                        });

                        if (!validation?.status) {
                                throw new Error(validation?.message || 'Không thể xác thực thông tin đặt vé');
                        }

                        const canonicalTotal = Number(validation.totalPrice ?? totalPrice);

                        const summary = {
                                orderId,
                                movie: selectedMovie?.title,
                                name,
                                phone,
                                email,
                                emailBook: email,
                                quantity: ticketCount,
                                amount: canonicalTotal,
                                method: paymentMethod,
                                poster: movieDetail?.cover_image || '',
                                duration: movieDetail?.duration_min ? `${movieDetail.duration_min}` : '',
                                genres: movieDetail?.genres || '',
                                ticketPackageId: selectedPackage?.id
                        };

                        countdownRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);

                        const { booking } = await createBookingApi({
                                email,
                                emailBook: email,
                                phone,
                                name,
                                movieId: selectedMovie?.id,
                                ticketCount,
                                paymentMethod,
                                totalPrice: canonicalTotal,
                                ticketPackageId: selectedPackage?.id,
                                pay_txt_code: orderId,
                                combo: finalCombo
                        });

                        localStorage.setItem(
                                'pendingOrder',
                                JSON.stringify({
                                        ...summary,
                                        booking_id: booking?.id,
                                        user_id: booking?.user_id
                                })
                        );
                        const movieTitles =
                                selectedMovies.length > 0 ? selectedMovies.map((m) => m.title).join(' & ') : selectedMovie?.title || 'Movie';
                        let orderInfoText = `${movieTitles} | ${ticketCount} vé`;

                        if (paymentMethod === 'vietqr') {
                                // Lưu thông tin booking để hiển thị trên màn QR
                                localStorage.setItem(
                                        'qrPaymentData',
                                        JSON.stringify({
                                                ...summary,
                                                booking_id: booking?.id,
                                                user_id: booking?.user_id,
                                                totalAmount: canonicalTotal,
                                                movieTitle:
                                                        selectedMovies.length > 0 ? selectedMovies.map((m) => m.title).join(' & ') : selectedMovie?.title,
                                                ticketType: selectedPackage?.name
                                        })
                                );

                                // Chuyển sang trang QR payment
                                localStorage.removeItem('qrPaymentEndTime');
                                router.push('/qr-payment');
                                return;
                        }

                        if (paymentMethod === 'momo') {
                                const extraDataEncoded = btoa(
                                        unescape(
                                                encodeURIComponent(
                                                        JSON.stringify({
                                                                ...summary,
                                                                booking_id: booking?.id,
                                                                user_id: booking?.user_id
                                                        })
                                                )
                                        )
                                );
                                const partnerCode = process.env.NEXT_PUBLIC_MOMO_PARTNER_CODE || "";
                                const partnerName = process.env.NEXT_PUBLIC_MOMO_PARTNER_NAME || "CineSphere";
                                const storeId = process.env.NEXT_PUBLIC_MOMO_STORE_ID || "devstore";
                                const clientBase = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
                                const serverBase = SERVER_BASE_URL || clientBase;
                                const redirectPath = process.env.NEXT_PUBLIC_MOMO_REDIRECT_URL || "/checkout";
                                const ipnPath = process.env.NEXT_PUBLIC_MOMO_IPN_URL || "/api/momo/ipn";
                                const redirectUrl = `${clientBase}${redirectPath}`;
                                const ipnUrl = `${serverBase}${ipnPath}`;
                                const accessKey = process.env.NEXT_PUBLIC_MOMO_ACCESS_KEY || '';
                                const secretKey = process.env.NEXT_PUBLIC_MOMO_SECRET_KEY || '';
                                const requestId = Date.now().toString();
                                const payload: any = {
                                        partnerCode,
                                        partnerName,
                                        storeId,
                                        requestId,
                                        amount: canonicalTotal,
                                        orderId,
                                        orderInfo: orderInfoText,
                                        redirectUrl,
                                        ipnUrl,
                                        lang: 'vi',
                                        extraData: extraDataEncoded,
                                        requestType: 'captureWallet',
                                        signature: '',
                                        accessKey,
                                        secretKey
                                };
                                const res = await createMomoPaymentApi(payload);
                                if (res?.payUrl) {
                                        window.location.href = res.payUrl;
                                        return;
                                }
                                throw new Error('Không nhận được liên kết thanh toán MoMo');
                        } else if (paymentMethod === 'vnpay') {
                                orderInfoText = booking?.id;
                                const clientBaseForVnp = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
                                const returnPathForVnp = process.env.NEXT_PUBLIC_VNPAY_RETURN_URL || '/checkout';
                                const returnUrl = `${clientBaseForVnp}${returnPathForVnp}`;
                                const locale = 'vn';
                                const res = await createVnpayPaymentApi({
                                        amount: canonicalTotal,
                                        orderId,
                                        orderInfo: orderInfoText,
                                        locale,
                                        returnUrl
                                });
                                if (res?.payUrl) {
                                        window.location.href = res.payUrl;
                                        return;
                                }
                                throw new Error('Không nhận được liên kết thanh toán VNPay');
                        }
                } catch (err: any) {
                        setIsProcessing(false);
                        toast.error('Không thể tạo đặt vé', {
                                description: 'Đã xảy ra lỗi, vui lòng thử lại sau'
                        });
                } finally {
                        setIsProcessing(false);
                }
        };
        return (
                <UserLayout
                        className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
                        hideFooter
                >
                        <div className="relative min-h-screen">
                                {/* Gradient overlays similar to home page */}
                                <div className="absolute inset-0 pointer-events-none z-0">
                                        {selectedMovie?.cover_image && (
                                                <img
                                                        src={optimizeCloudinaryUrl(selectedMovie.cover_image, 1280)}
                                                        alt="Backdrop"
                                                        className="w-full h-full object-cover opacity-40"
                                                        style={{
                                                                filter: `brightness(${backdropConfig.brightness}) blur(${backdropConfig.blurPx}px)`
                                                        }}
                                                />
                                        )}
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
                                        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayDark})` }} />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
                                        <div className="absolute inset-0 neon-noise opacity-25" />
                                </div>
                                <div className="relative z-10 max-w-6xl mx-auto p-4 pt-[104px] sm:pt-24 pb-24 lg:pb-0">
                                        <div className="text-sm pb-6 pt-2 flex items-center gap-1.5 opacity-80">
                                                <button className="text-gray-400 hover:text-blue-400 transition-colors" onClick={() => router.push('/')}>
                                                        Trang chủ
                                                </button>
                                                <span className="mx-1 text-white/30 text-[10px]">&gt;</span>
                                                <span className="text-white">Đặt vé</span>
                                        </div>
                                        {isLoadingPage && (
                                                <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
                                                        <CardHeader>
                                                                <CardTitle>Đang tải dữ liệu đặt vé</CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="flex items-center gap-3 text-sm text-orange-400">
                                                                <div className="w-5 h-5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                                                                Vui lòng chờ trong giây lát...
                                                        </CardContent>
                                                </Card>
                                        )}

                                        {!isLoadingPage && step === 0 && (
                                                <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-2xl overflow-hidden">
                                                        <CardHeader className="bg-white/5 border-b border-white/10 pb-4">
                                                                <CardTitle className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
                                                                        <span className="w-1.5 h-8 bg-blue-500 rounded-full"></span>
                                                                        Đặt Vé Trải Nghiệm
                                                                </CardTitle>
                                                        </CardHeader>

                                                        <CardContent className="p-0">
                                                                <div className="grid grid-cols-1 lg:grid-cols-12">
                                                                        {/* CỘT TRÁI: CHỌN VÉ & PHIM (7 columns) */}
                                                                        <div className="lg:col-span-7 p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-white/10">
                                                                                {/* PHẦN 1: CHỌN VÉ */}
                                                                                <section className="space-y-3">
                                                                                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
                                                                                                <span className="p-1 rounded bg-blue-500/20">01</span>
                                                                                                Chọn Loại Vé
                                                                                        </div>
                                                                                        <Select
                                                                                                value={selectedPackage?.id ? String(selectedPackage.id) : ''}
                                                                                                onValueChange={(v) => {
                                                                                                        const pkg = ticketPackages.find((p: any) => String(p.id) === String(v));
                                                                                                        setSelectedPackage(pkg || null);
                                                                                                        if (pkg?.movies) {
                                                                                                                setActiveMoviesFull([...pkg.movies]);
                                                                                                        } else {
                                                                                                                setActiveMoviesFull([]);
                                                                                                        }
                                                                                                        setMovie('');
                                        clearFormError('ticketPackage');
                                                                                                }}
                                                                                        >
                                                                                                <SelectTrigger className="w-full bg-white/10 border-white/20 hover:bg-white/15 h-12 rounded-xl transition-all text-sm sm:text-base">
                                                                                                        <span className="truncate font-medium">
                                                                                                                {selectedPackage?.name || 'Chọn loại vé bạn muốn...'}
                                                                                                        </span>
                                                                                                </SelectTrigger>
                                                                                                <SelectContent className="bg-[#1a1f2e] text-white border-white/20 shadow-2xl">
                                                                                                        {ticketPackages.map((t: any) => (
                                                                                                                <SelectItem
                                                                                                                        key={t.id}
                                                                                                                        value={String(t.id)}
                                                                                                                        className="focus:bg-blue-600 focus:text-white py-3"
                                                                                                                >
                                                                                                                        <div className="flex items-center justify-between gap-8 w-full">
                                                                                                                                <span className="font-medium">{t.name}</span>
                                                                                                                                <span className="font-bold text-blue-400">
                                                                                                                                        {Number(t.price || 0).toLocaleString('vi-VN')}₫
                                                                                                                                </span>
                                                                                                                        </div>
                                                                                                                </SelectItem>
                                                                                                        ))}
                                                                                                </SelectContent>
                                                                                        </Select>
                                                                                        {formErrors.ticketPackage && (
                                                                                                <p className="text-orange-400 text-[10px] mt-1 animate-pulse">{formErrors.ticketPackage}</p>
                                                                                        )}
                                                                                </section>

                                                                                {/* PHẦN 2: DANH SÁCH PHIM - Dạng thu gọn */}
                                                                                {selectedPackage && (
                                                                                        <section className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                                        <div className="text-[13px] font-semibold text-blue-400 uppercase tracking-wider leading-relaxed">
                                                                                                                Vui lòng chọn phim áp dụng ({activeMoviesFull.length})
                                                                                                        </div>
                                                                                                        <Button
                                                                                                                variant="link"
                                                                                                                className="text-blue-400 h-auto p-0 text-[13px] hover:text-blue-300"
                                                                                                                onClick={() => setShowMovies(!showMovies)}
                                                                                                        >
                                                                                                                {showMovies ? 'Thu gọn ▲' : 'Xem danh sách ▼'}
                                                                                                        </Button>
                                                                                                </div>

                                                                                                {!showMovies && (
                                                                                                        <div className="animate-in fade-in zoom-in-95 duration-200">
                                                                                                                {activeMoviesFull && activeMoviesFull.length > 0 ? (
                                                                                                                        /* Sử dụng grid-cols-2 cho mobile và grid-cols-5 cho desktop */
                                                                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                                                                                                                                {activeMoviesFull.map((m: any) => (
                                                                                                                                        <div
                                                                                                                                                key={m.id}
                                                                                                                                                onClick={() => {
                                                                                                                                                        setSelectedMovieIds((prev) => {
                                                                                                                                                                if (prev.includes(m.id)) return prev.filter((id) => id !== m.id);
                                                                                                                                                                if (prev.length >= 2) {
                                                                                                                                                                        return [prev[1], m.id];
                                                                                                                                                                }
                                                                                                                                                                return [...prev, m.id];
                                                                                                                                                        });
                                                                                                                                                        clearFormError('movies');
                                                                                                                                                }}
                                                                                                                                                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 transform hover:scale-105 ${selectedMovieIds.includes(m.id)
                                                                                                                                                        ? 'border-2 border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 scale-105'
                                                                                                                                                        : 'border border-white/10 bg-white/5 hover:border-blue-500/50'
                                                                                                                                                        }`}
                                                                                                                                        >
                                                                                                                                                <div className="aspect-[2/3] relative">
                                                                                                                                                        {/* Tỉ lệ 2:3 chuẩn poster phim */}
                                                                                                                                                        <img
                                                                                                                                                                src={optimizeCloudinaryUrl(m.cover_image, 200)}
                                                                                                                                                                alt={m.title}
                                                                                                                                                                loading="lazy"
                                                                                                                                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                                                                                                                        />
                                                                                                                                                        {selectedMovieIds.includes(m.id) && (
                                                                                                                                                                <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                                                                                                                                                        <div className="text-[10px] font-bold text-white">
                                                                                                                                                                                {selectedMovieIds.indexOf(m.id) + 1}
                                                                                                                                                                        </div>
                                                                                                                                                                </div>
                                                                                                                                                        )}
                                                                                                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                                                                                                                                                        <div className="absolute bottom-0 p-2 w-full">
                                                                                                                                                                <div className="text-[11px] font-bold text-white leading-tight truncate mb-1">
                                                                                                                                                                        {m.title}
                                                                                                                                                                </div>
                                                                                                                                                                <div className="flex items-center gap-1.5">
                                                                                                                                                                        <span className="px-1 py-0.5 rounded bg-blue-600 text-[9px] text-white font-black">
                                                                                                                                                                                {m.duration_min ? `${m.duration_min}'` : '--'}
                                                                                                                                                                        </span>
                                                                                                                                                                        <span className="text-[9px] text-gray-300/90 truncate font-light italic hidden sm:block">
                                                                                                                                                                                {m.description || 'Phim đặc sắc'}
                                                                                                                                                                        </span>
                                                                                                                                                                </div>
                                                                                                                                                        </div>
                                                                                                                                                </div>
                                                                                                                                        </div>
                                                                                                                                ))}
                                                                                                                        </div>
                                                                                                                ) : (
                                                                                                                        <div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-gray-500 text-sm italic">
                                                                                                                                Không có phim áp dụng cho loại vé này
                                                                                                                        </div>
                                                                                                                )}
                                                                                                        </div>
                                                                                                )}
                                                                                        </section>
                                                                                )}
                                                                                {formErrors.movies && (
                                                                                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 animate-in fade-in duration-200">
                                                                                                <p className="text-orange-400 text-sm flex items-center gap-2">
                                                                                                        <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
                                                                                                        {formErrors.movies}
                                                                                                </p>
                                                                                        </div>
                                                                                )}

                                                                                {/* TÓM TẮT TẠM TÍNH (Chỉ hiện trên Desktop ở phía trái) */}
                                                                                {selectedPackage && (
                                                                                        <div className="mt-auto pt-6 hidden lg:block">
                                                                                                <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex flex-col justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
                                                                                                        <div className="flex justify-between items-start">
                                                                                                                <div>
                                                                                                                        <h4 className="text-white font-bold text-base sm:text-lg">{selectedPackage.name}</h4>
                                                                                                                        <p className="text-[13px] text-gray-400">
                                                                                                                                {selectedPackage.description || `Gói vé ${selectedPackage.type || 'tiêu chuẩn'}`}
                                                                                                                        </p>
                                                                                                                </div>
                                                                                                                <div className="text-right">
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">Đơn giá</p>
                                                                                                                        <p className="text-sm font-bold text-white">{unitPrice.toLocaleString('vi-VN')}₫</p>
                                                                                                                </div>
                                                                                                        </div>

                                                                                                        <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                                                                                                                <div>
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">Số lượng</p>
                                                                                                                        <p className="text-lg font-bold text-white">x{ticketCount}</p>
                                                                                                                </div>
                                                                                                                <div className="text-right">
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest">Tổng cộng tạm tính</p>
                                                                                                                        <p className="text-2xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">
                                                                                                                                {totalPrice.toLocaleString('vi-VN')}₫
                                                                                                                        </p>
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                )}
                                                                        </div>

                                                                        {/* CỘT PHẢI: THÔNG TIN KHÁCH HÀNG & TÓM TẮT (5 columns) */}
                                                                        <div className="lg:col-span-5 p-6 space-y-5 bg-black/10">
                                                                                {/* PHẦN 3: THÔNG TIN KHÁCH HÀNG */}
                                                                                <section className="space-y-3">
                                                                                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
                                                                                                <span className="p-1 rounded bg-blue-500/20 text-[10px]">02</span>
                                                                                                Thông Tin Khách Hàng
                                                                                        </div>
                                                                                        <div className="grid grid-cols-1 gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                                                                                                <div className="space-y-1.5">
                                                                                                        <Label className="text-sm font-medium text-gray-400 ml-1">Họ Và Tên</Label>
                                                                                                        <Input
                                                                                                                className="bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/10 h-12 rounded-lg placeholder:text-gray-400 text-sm"
                                                                                                                value={name}
                                                                                                                onChange={(e) => {
                                                        setName(e.target.value);
                                                        // Clear name error when user starts typing
                                                        if (formErrors.name && e.target.value.trim().length >= 2) {
                                                                setFormErrors(prev => ({ ...prev, name: '' }));
                                                        }
                                                }}
                                                                                                                placeholder="Nhập họ và tên"
                                                                                                                minLength={2}
                                                                                                        />
                                                                                                </div>
                                                                                                {formErrors.name && <p className="text-orange-400 text-[10px] mt-1 animate-pulse">{formErrors.name}</p>}
                                                                                                <div className="space-y-1.5">
                                                                                                        <Label className="text-sm font-medium text-gray-400 ml-1">Số Điện Thoại</Label>
                                                                                                        <Input
                                                                                                                className={`bg-white/5 h-12 rounded-lg transition-colors text-sm ${phoneError ? 'border-orange-500/50 focus:ring-orange-500/10' : 'border-white/10 focus:border-blue-500/50'}`}
                                                                                                                value={phone}
                                                                                                                inputMode="numeric"
                                                                                                                maxLength={10}
                                                                                                                placeholder="VD: 0912345678"
                                                                                                                onChange={(e) => {
                                                                                                                        const value = e.target.value;
                                                                                                                        if (!/^\d*$/.test(value)) {
                                                                                                                                setPhoneError('Chỉ cho phép nhập số 0-9');
                                                                                                                                return;
                                                                                                                        }
                                                                                                                        setPhone(value);
                                                                                                                        if (value && !value.startsWith('0')) {
                                                                                                                                setPhoneError('Số điện thoại phải bắt đầu bằng số 0');
                                                                                                                        } else {
                                                                                                                                setPhoneError('');
                                                                                                                        }
                                                                                                                }}
                                                                                                        />
                                                                                                        {phoneError && <p className="text-orange-400 text-[10px] mt-1 animate-pulse">{phoneError}</p>}
                                                                                                        {formErrors.phone && !phoneError && <p className="text-orange-400 text-[10px] mt-1 animate-pulse">{formErrors.phone}</p>}
                                                                                                </div>
                                                                                                <div className="space-y-1.5">
                                                                                                        <Label className="text-sm font-medium text-gray-400 ml-1">Email Nhận Vé</Label>
                                                                                                        <Input
                                                                                                                className={`bg-white/5 h-12 rounded-lg text-sm ${emailError ? 'border-orange-500/50' : 'border-white/10 focus:border-blue-500/50'}`}
                                                                                                                value={email}
                                                                                                                type="email"
                                                                                                                placeholder="you@email.com"
                                                                                                                onChange={(e) => {
                                                                                                                        const val = e.target.value;
                                                                                                                        setEmail(val);
                                                                                                                        if (!val) {
                                                                                                                                setEmailError('');
                                                                                                                        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                                                                                                                                setEmailError('Email không hợp lệ');
                                                                                                                        } else if (
                                                                                                                                !/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(val)
                                                                                                                        ) {
                                                                                                                                setEmailError('Vui lòng dùng Gmail, Outlook, Yahoo hoặc iCloud');
                                                                                                                        } else {
                                                                                                                                setEmailError('');
                                                                                                                        }
                                                                                                                }}
                                                                                                        />
                                                                                                        {emailError && <p className="text-orange-400 text-[10px] mt-1">{emailError}</p>}
                                                                                                        {formErrors.email && !emailError && <p className="text-orange-400 text-[10px] mt-1 animate-pulse">{formErrors.email}</p>}
                                                                                                </div>
                                                                                                <div className="space-y-1.5">
                                                                                                        <Label className="text-sm font-medium text-gray-400 ml-1">Số Lượng Vé</Label>
                                                                                                        <div className="flex items-center gap-2">
                                                                                                                <Button
                                                                                                                        type="button"
                                                                                                                        variant="outline"
                                                                                                                        className="bg-white/5 border-white/10 hover:bg-red-500/20 hover:text-red-400 h-10 w-10 p-0 rounded-lg transition-colors"
                                                                                                                        onClick={() => setTicketCount((c) => Math.max(MIN_TICKETS, c - 1))}
                                                                                                                >
                                                                                                                        -
                                                                                                                </Button>
                                                                                                                <div className="flex-1 text-center font-bold bg-white/5 border border-white/10 rounded-lg h-10 flex items-center justify-center text-sm">
                                                                                                                        {ticketCount}
                                                                                                                </div>
                                                                                                                <Button
                                                                                                                        type="button"
                                                                                                                        variant="outline"
                                                                                                                        className="bg-white/5 border-white/10 hover:bg-green-500/20 hover:text-green-400 h-10 w-10 p-0 rounded-lg transition-colors"
                                                                                                                        onClick={() => setTicketCount((c) => Math.min(MAX_TICKETS, c + 1))}
                                                                                                                >
                                                                                                                        +
                                                                                                                </Button>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                </section>

                                                                                {/* TÓM TẮT TẠM TÍNH (Chỉ hiện trên Mobile ở đây - phía dưới form thông tin) */}
                                                                                {selectedPackage && (
                                                                                        <div className="lg:hidden mb-6">
                                                                                                <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex flex-col justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
                                                                                                        <div className="flex justify-between items-start">
                                                                                                                <div>
                                                                                                                        <h4 className="text-white font-bold text-base sm:text-lg">{selectedPackage.name}</h4>
                                                                                                                        <p className="text-[13px] text-gray-400 leading-relaxed">
                                                                                                                                {selectedPackage.description || `Gói vé ${selectedPackage.type || 'tiêu chuẩn'}`}
                                                                                                                        </p>
                                                                                                                </div>
                                                                                                                <div className="text-right shrink-0">
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-0.5">Đơn giá</p>
                                                                                                                        <p className="text-sm font-bold text-white">{unitPrice.toLocaleString('vi-VN')}₫</p>
                                                                                                                </div>
                                                                                                        </div>

                                                                                                        <div className="pt-3 border-t border-white/10 flex justify-between items-end">
                                                                                                                <div>
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-0.5">Số lượng</p>
                                                                                                                        <p className="text-xl font-bold text-white">x{ticketCount}</p>
                                                                                                                </div>
                                                                                                                <div className="text-right">
                                                                                                                        <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-0.5">
                                                                                                                                Tổng cộng tạm tính
                                                                                                                        </p>
                                                                                                                        <p className="text-2xl font-black text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.4)]">
                                                                                                                                {totalPrice.toLocaleString('vi-VN')}₫
                                                                                                                        </p>
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                )}

                                                                                {/* Action Bar for Desktop (hidden on mobile) */}
                                                                                <div className="hidden lg:flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                                                                                        <Button
                                                                                                variant="ghost"
                                                                                                className="w-auto px-6 h-14 bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-none"
                                                                                                onClick={() => router.push('/')}
                                                                                                disabled={isProcessing}
                                                                                        >
                                                                                                <ArrowLeft className="w-5 h-5 mr-2" />
                                                                                                <span className="font-bold text-sm">Quay lại</span>
                                                                                        </Button>

                                                                                        <Button
                                                                                                className="w-full lg:w-48 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold h-14 rounded-2xl shadow-lg shadow-blue-500/10 transition-all duration-300 transform active:scale-[0.98] whitespace-nowrap text-base"
                                                                                                onClick={() => {
                                                                                                        if (validateForm()) {
                                                                                                                setShowEmailConfirmDialog(true);
                                                                                                        }
                                                                                                }}
                                                                                        >
                                                                                                <span className="flex items-center justify-center gap-2">
                                                                                                        Tiếp tục <ArrowRight className="w-5 h-5" />
                                                                                                </span>
                                                                                        </Button>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </CardContent>
                                                </Card>
                                        )}

                                        {step === 1 && (
                                                <>
                                                        <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl overflow-hidden">
                                                                <CardHeader className="bg-white/5 border-b border-white/10 p-4 sm:p-6">
                                                                        <CardTitle className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                                                                                <span className="w-1 h-5 sm:h-6 bg-blue-500 rounded-full"></span>
                                                                                Xác nhận thông tin đặt vé
                                                                        </CardTitle>
                                                                </CardHeader>

                                                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-0 p-0">
                                                                        {/* CỘT TRÁI: THÔNG TIN CHI TIẾT */}
                                                                        <div className="md:col-span-2 p-4 sm:p-6 space-y-4 sm:space-y-6 md:border-r border-white/10">
                                                                                <section>
                                                                                        <h3 className="text-xs sm:text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 sm:mb-4">
                                                                                                Thông tin khách hàng
                                                                                        </h3>
                                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5">
                                                                                                <div>
                                                                                                        <p className="text-[10px] sm:text-xs text-gray-400">Họ tên</p>
                                                                                                        <p className="font-medium text-sm sm:text-base">{name}</p>
                                                                                                </div>
                                                                                                <div>
                                                                                                        <p className="text-[10px] sm:text-xs text-gray-400">Số điện thoại</p>
                                                                                                        <p className="font-medium text-sm sm:text-base">{phone}</p>
                                                                                                </div>
                                                                                                <div className="sm:col-span-2">
                                                                                                        <p className="text-[10px] sm:text-xs text-gray-400">Email nhận vé</p>
                                                                                                        <p className="font-medium text-blue-300 text-sm sm:text-base break-all">{email}</p>
                                                                                                </div>
                                                                                        </div>
                                                                                </section>

                                                                                {selectedMovies.length > 0 && (
                                                                                        <section>
                                                                                                <h3 className="text-xs sm:text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2 sm:mb-3">
                                                                                                        Danh sách phim trải nghiệm ({selectedMovies.length})
                                                                                                </h3>
                                                                                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                                                                                        {selectedMovies.map((m: any) => (
                                                                                                                <div
                                                                                                                        key={m.id}
                                                                                                                        className="bg-blue-500/10 border border-blue-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
                                                                                                                >
                                                                                                                        <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 bg-blue-500 rounded-full"></span>
                                                                                                                        {m.title}
                                                                                                                </div>
                                                                                                        ))}
                                                                                                </div>
                                                                                        </section>
                                                                                )}

                                                                                {/* LƯU Ý GỌN GÀNG HƠN */}
                                                                                <div className="p-3 sm:p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                                                                                        <h4 className="text-amber-500 font-bold text-xs sm:text-sm mb-2 flex items-center gap-2">
                                                                                                ⚠️ Một số lưu ý quan trọng:
                                                                                        </h4>
                                                                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:text-[13px] text-gray-400 list-inside list-disc">
                                                                                                <li>Trẻ em &gt;70cm. Dưới 1m4 cần người lớn.</li>
                                                                                                <li>Cân nhắc nếu có bệnh tim, sợ độ cao.</li>
                                                                                                <li>Vé không hoàn trả hoặc đổi ngày.</li>
                                                                                                <li>Không mang thức ăn/nước uống ngoài.</li>
                                                                                        </ul>
                                                                                </div>
                                                                        </div>

                                                                        {/* CỘT PHẢI: THANH TOÁN & TÓM TẮT */}
                                                                        <div className="bg-black/20 p-4 sm:p-6 flex flex-col justify-between">
                                                                                <div className="space-y-4 sm:space-y-6">
                                                                                        <div>
                                                                                                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">
                                                                                                        Thanh toán qua
                                                                                                </h3>
                                                                                                <button
                                                                                                        type="button"
                                                                                                        onClick={() => setPaymentMethod('vietqr')}
                                                                                                        className={`${paymentMethod === 'vietqr' ? 'border-red-500 bg-red-600/20' : 'border-white/20 bg-white/10'} w-full cursor-pointer rounded-xl border p-2.5 sm:p-3 flex items-center justify-center gap-2 sm:gap-3 transition-all hover:bg-white/15 h-10 sm:h-12`}
                                                                                                >
                                                                                                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-red-600 text-white grid place-items-center text-[9px] sm:text-[10px] font-extrabold shadow-lg">
                                                                                                                VQ
                                                                                                        </span>
                                                                                                        <span className="font-bold tracking-tight text-xs sm:text-base">VietQR (Ngân hàng)</span>
                                                                                                </button>
                                                                                        </div>

                                                                                        <div className="space-y-2 sm:space-y-3">
                                                                                                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                                                                                        Booking Summary
                                                                                                </h3>
                                                                                                <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10 space-y-2 sm:space-y-3 text-xs sm:text-sm">
                                                                                                        <div className="flex justify-between">
                                                                                                                <span className="text-gray-400">Loại vé</span>
                                                                                                                <span className="text-white font-medium">
                                                                                                                        {selectedPackage?.name || defaultTicket?.name || 'Vé tiêu chuẩn'}
                                                                                                                </span>
                                                                                                        </div>
                                                                                                        <div className="flex justify-between">
                                                                                                                <span className="text-gray-400">Đơn giá</span>
                                                                                                                <span className="text-white font-medium">{unitPrice.toLocaleString('vi-VN')}₫</span>
                                                                                                        </div>
                                                                                                        <div className="flex justify-between pb-2 sm:pb-3 border-b border-white/10">
                                                                                                                <span className="text-gray-400">Số lượng</span>
                                                                                                                <span className="text-white font-medium">x{ticketCount}</span>
                                                                                                        </div>
                                                                                                        <div className="flex justify-between pt-1">
                                                                                                                <span className="text-white font-bold text-base sm:text-lg">Tổng tiền</span>
                                                                                                                <span className="text-blue-400 font-black text-lg sm:text-xl">
                                                                                                                        {totalPrice.toLocaleString('vi-VN')}₫
                                                                                                                </span>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                </div>

                                                                                <div className="mt-4 sm:mt-8 space-y-3 sm:space-y-4">
                                                                                        <div className="flex items-start gap-2 sm:gap-3 group cursor-pointer">
                                                                                                <Checkbox
                                                                                                        checked={confirmChecked}
                                                                                                        onCheckedChange={(checked) => setConfirmChecked(checked === true)}
                                                                                                        className="mt-0.5 sm:mt-1 border-white/40 data-[state=checked]:bg-blue-500 w-4 h-4 sm:w-5 sm:h-5"
                                                                                                        id="confirm-checkbox"
                                                                                                />
                                                                                                <label
                                                                                                        htmlFor="confirm-checkbox"
                                                                                                        className="text-[13px] leading-relaxed text-gray-400 group-hover:text-gray-200 transition-colors cursor-pointer select-none"
                                                                                                >
                                                                                                        Tôi đã kiểm tra kỹ thông tin và đồng ý với điều khoản dịch vụ.
                                                                                                </label>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                </CardContent>
                                                        </Card>

                                                        {/* Action Bar for Desktop (hidden on mobile) */}
                                                        <div className="hidden lg:flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                                                                <Button
                                                                        variant="ghost"
                                                                        className="w-auto px-6 h-14 bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 rounded-2xl transition-all flex items-center justify-center shrink-0 active:scale-95 shadow-none"
                                                                        onClick={() => setStep(0)}
                                                                        disabled={isProcessing}
                                                                >
                                                                        <ArrowLeft className="w-5 h-5 mr-2" />
                                                                        <span className="font-bold text-sm">Quay lại</span>
                                                                </Button>

                                                                <Button
                                                                        className="w-full lg:w-auto lg:min-w-[200px] lg:px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold h-14 rounded-2xl shadow-lg shadow-blue-500/10 transition-all duration-300 transform active:scale-[0.98] text-base whitespace-nowrap disabled:opacity-50"
                                                                        disabled={!confirmChecked || isProcessing}
                                                                        onClick={handleCreateAndPay}
                                                                >
                                                                        {isProcessing ? (
                                                                                <span className="flex items-center justify-center gap-2">
                                                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                                                        <span>Xử lý...</span>
                                                                                </span>
                                                                        ) : (
                                                                                <span className="flex items-center justify-center gap-2">
                                                                                        Thanh toán <CreditCard className="w-5 h-5" />
                                                                                </span>
                                                                        )}
                                                                </Button>
                                                        </div>
                                                </>
                                        )}
                                </div>
                        </div>
                        {isProcessing && (
                                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
                                        <div className="text-lg font-semibold">Đang xử lý thanh toán...</div>
                                        <div className="text-sm text-white/70 mt-1">
                                                Vui lòng không đóng hoặc rời khỏi trang cho đến khi chuyển sang cổng thanh toán.
                                        </div>
                                </div>
                        )}
                        <AlertDialog open={showEmailConfirmDialog} onOpenChange={setShowEmailConfirmDialog}>
                                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
                                        <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-white">Xác nhận thông tin</AlertDialogTitle>
                                                <AlertDialogDescription className="text-gray-300 text-base leading-relaxed">
                                                        Lưu ý thông tin vé sẽ được gửi đến email: <span className="font-bold text-blue-400">{email}</span>.
                                                        <br />
                                                        Vui lòng kiểm tra kỹ email trước khi tiếp tục.
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                                                        Kiểm tra lại
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                        onClick={() => {
                                                                setShowEmailConfirmDialog(false);
                                                                setStep(1);
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                        Đồng ý
                                                </AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
                                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
                                        <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-white">Xác nhận thanh toán</AlertDialogTitle>
                                                <AlertDialogDescription className="text-gray-300">
                                                        Bạn có chắc chắn muốn đặt vé và chuyển sang trang thanh toán không?
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                                                        Hủy bỏ
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                        onClick={() => {
                                                                setShowPaymentConfirmDialog(false);
                                                                performBooking();
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                >
                                                        Đồng ý
                                                </AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
                        {/* FIXED FOOTER ACTIONS - Moved to ROOT LEVEL for absolute viewport sticky */}
                        {step === 0 ? (
                                <div className="lg:hidden fixed bottom-0 left-0 right-0 px-4 py-4 pb-7 bg-[#0b1226] border-t border-white/10 z-[60] flex items-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
                                        <Button
                                                className="w-14 h-14 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-none"
                                                onClick={() => router.push('/')}
                                                disabled={isProcessing}
                                        >
                                                <ArrowLeft className="w-6 h-6" />
                                        </Button>

                                        <Button
                                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold h-14 rounded-2xl shadow-none transition-all duration-300 transform active:scale-[0.98] whitespace-nowrap text-base"
                                                onClick={() => {
                                                        if (validateForm()) {
                                                                setShowEmailConfirmDialog(true);
                                                        }
                                                }}
                                        >
                                                <span className="flex items-center justify-center gap-2">
                                                        Tiếp tục <ArrowRight className="w-5 h-5" />
                                                </span>
                                        </Button>
                                </div>
                        ) : (
                                <div className="lg:hidden fixed bottom-0 left-0 right-0 px-4 py-4 pb-7 bg-[#0b1226] border-t border-white/10 z-[60] flex items-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
                                        <Button
                                                className="w-14 h-14 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-2xl transition-all duration-300 flex items-center justify-center shrink-0 active:scale-95 shadow-none"
                                                onClick={() => setStep(0)}
                                                disabled={isProcessing}
                                        >
                                                <ArrowLeft className="w-6 h-6" />
                                        </Button>

                                        <Button
                                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold h-14 rounded-2xl shadow-none transition-all duration-300 transform active:scale-[0.98] text-base whitespace-nowrap disabled:opacity-50"
                                                disabled={!confirmChecked || isProcessing}
                                                onClick={handleCreateAndPay}
                                        >
                                                {isProcessing ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                                <span>Xử lý...</span>
                                                        </span>
                                                ) : (
                                                        <span className="flex items-center justify-center gap-2">
                                                                Thanh toán <CreditCard className="w-5 h-5" />
                                                        </span>
                                                )}
                                        </Button>
                                </div>
                        )}
                </UserLayout>
        );
}
