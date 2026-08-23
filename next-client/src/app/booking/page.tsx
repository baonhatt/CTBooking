'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
<<<<<<< HEAD
import { useRouter } from 'next/navigation';
=======
import { useRouter, useSearchParams } from 'next/navigation';
>>>>>>> preview
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
<<<<<<< HEAD
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
=======
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
	getActiveTickets,
	getVRPackages,
	VRPackageItem,
	createBookingApi,
	createMomoPaymentApi,
	createVnpayPaymentApi,
	API_BASE_URL,
	SERVER_BASE_URL,
	validateBookingApi,
	validateVrVoucher,
	validateVRBooking,
	createVRBooking
} from '@/lib/api';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import UserLayout from '@/layouts/UserLayout';
import {
	ArrowLeft,
	ArrowRight,
	CreditCard,
	ChevronRight,
	X,
	Loader2,
	Gamepad2,
	Plus,
	Minus,
	Users,
	Clock,
	Sparkles,
	Film,
	Tag,
	ShoppingCart,
	Trash2,
	Check,
	CheckCircle2,
	ShieldCheck,
	QrCode,
	Info
} from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { getCookie } from '@/lib/cookies';
import { useCart, cartStore } from '@/store/cartStore';

export default function BookingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { selectedBranch } = useBranch();
	const {
		items: allCartItems,
		selectedItems,
		movieItems,
		vrItems,
		movieSubtotal,
		vrSubtotal,
		selectedSubtotal,
		updateQuantity,
		removeItem,
		openCart,
		clearSelected
	} = useCart();

	const [name, setName] = useState<string>('');
	const [phone, setPhone] = useState<string>('');
	const [phoneError, setPhoneError] = useState<string>('');
	const [email, setEmail] = useState<string>('');
	const [emailError, setEmailError] = useState<string>('');
	const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'momo' | 'vnpay'>('vietqr');
	const [isProcessing, setIsProcessing] = useState(false);
	const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
	const [voucherCode, setVoucherCode] = useState<string>('');
	const [voucherValidating, setVoucherValidating] = useState(false);
	const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
	const [selectedMovieIds, setSelectedMovieIds] = useState<number[]>([]);
	const [confirmChecked, setConfirmChecked] = useState(false);
	const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
	const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);

	// Prefetch target routes
	useEffect(() => {
		router.prefetch('/qr-payment');
		router.prefetch('/checkout');
		router.prefetch('/');
	}, [router]);

	const urlBranchId = useMemo(() => {
		const raw = searchParams.get('branch_id');
		const parsed = raw ? Number(raw) : null;
		return parsed && Number.isFinite(parsed) ? parsed : null;
	}, [searchParams]);

	const activeBranchId = urlBranchId ?? selectedBranch?.id;

	// Fetch Tickets & VR packages
	const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
		queryKey: ['activeTickets', activeBranchId],
		queryFn: ({ signal }) => getActiveTickets(activeBranchId ?? undefined, { signal }),
		staleTime: 60000
	});

	const { data: vrPackagesData, isLoading: isLoadingVrPackages } = useQuery({
		queryKey: ['vrPackages', activeBranchId],
		queryFn: ({ signal }) => getVRPackages(activeBranchId ?? undefined, { signal }),
		staleTime: 60000
	});

	const vrPackages = useMemo(() => {
		const rawList = Array.isArray(vrPackagesData)
			? vrPackagesData
			: Array.isArray(vrPackagesData?.items)
				? vrPackagesData.items
				: Array.isArray((vrPackagesData as any)?.data)
					? (vrPackagesData as any).data
					: Array.isArray((vrPackagesData as any)?.data?.items)
						? (vrPackagesData as any).data.items
						: [];
		return rawList.filter((item: any) => item && item.is_active !== false && item.is_active !== 0);
	}, [vrPackagesData]);

	const ticketPackages = useMemo(() => {
		return (ticketsData?.items || []).map((t: any) => ({
			id: t.id,
			name: t.name,
			description: t.description || '',
			price: Number(t.price || 0),
			features: Array.isArray(t.features) ? t.features : [],
			type: t.type || '',
			display_order: t.display_order || 0,
			movies: t.movies || []
		}));
	}, [ticketsData]);

	// Auto-seed legacy query params into cartStore if cart was empty
	useEffect(() => {
		const vrPkgId = searchParams.get('vr_package_id');
		const qtyParam = Number(searchParams.get('qty') || 1);
		if (vrPkgId && allCartItems.length === 0) {
			const foundVr = vrPackages.find((v: any) => Number(v.id) === Number(vrPkgId));
			if (foundVr) {
				cartStore.addItem({
					packageId: foundVr.id,
					type: 'vr',
					name: foundVr.name,
					price: Number(foundVr.price || 0),
					cover_image: foundVr.cover_image,
					duration_min: foundVr.duration_min,
					vr_genre: foundVr.vr_genre,
					quantity: Math.max(1, qtyParam),
					branchId: activeBranchId,
					selected: true
				});
			}
		}

		try {
			const rawTicket = localStorage.getItem('selectedTicketPackage');
			if (rawTicket && allCartItems.length === 0) {
				const parsed = JSON.parse(rawTicket);
				if (parsed?.id) {
					cartStore.addItem({
						packageId: parsed.id,
						type: 'movie',
						name: parsed.name,
						price: Number(parsed.price || 0),
						cover_image: parsed.cover_image,
						movies: parsed.movies,
						quantity: 1,
						branchId: activeBranchId,
						selected: true
					});
					localStorage.removeItem('selectedTicketPackage');
				}
			}
		} catch { }
	}, [searchParams, vrPackages, allCartItems.length, activeBranchId]);

	// Available movies for selected movie packages
	const availableMovies = useMemo(() => {
		const moviesMap = new Map<number, any>();
		movieItems.forEach((item) => {
			const pkg = ticketPackages.find((p: any) => p.id === item.packageId);
			const list = (pkg?.movies && pkg.movies.length > 0) ? pkg.movies : (item.movies || []);
			list.forEach((m: any) => {
				if (m?.id && !moviesMap.has(m.id)) {
					moviesMap.set(m.id, m);
				}
			});
		});
		return Array.from(moviesMap.values());
	}, [movieItems, ticketPackages]);

	// Auto-select first movie if movies exist and none selected
	useEffect(() => {
		if (availableMovies.length > 0 && selectedMovieIds.length === 0) {
			setSelectedMovieIds([availableMovies[0].id]);
		}
	}, [availableMovies, selectedMovieIds.length]);

	const selectedMovie = useMemo(() => {
		return availableMovies.find((m) => selectedMovieIds.includes(m.id)) || availableMovies[0];
	}, [availableMovies, selectedMovieIds]);

	// Load user profile if saved
	useEffect(() => {
		try {
			const profRaw = getCookie('userProfile') || localStorage.getItem('userProfile');
			if (profRaw) {
				const p = JSON.parse(profRaw);
				if (!email && p?.email) setEmail(p.email);
				if (!name && p?.name) setName(p.name);
				if (!phone && p?.phone) setPhone(p.phone);
			}
		} catch { }
	}, [email, name, phone]);

	// Auto clear form errors
	useEffect(() => {
		if (phone.length === 10 && phone.startsWith('0') && /^\d+$/.test(phone) && formErrors.phone) {
			setFormErrors((prev) => ({ ...prev, phone: '' }));
		}
	}, [phone, formErrors.phone]);

	useEffect(() => {
		if (
			email &&
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
			/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(email) &&
			formErrors.email
		) {
			setFormErrors((prev) => ({ ...prev, email: '' }));
		}
	}, [email, formErrors.email]);

	const resolveImageUrl = (u: string | undefined | null) => {
		if (!u) return '';
		if (u.startsWith('http')) return u;
		const path = u.startsWith('/') ? u : `/${u}`;
		return `${API_BASE_URL}${path}`;
	};

	// Pricing Calculations
	const totalMovieCount = movieItems.reduce((s, i) => s + i.quantity, 0);
	const totalVrCount = vrItems.reduce((s, i) => s + i.quantity, 0);
	const originalTotalPrice = movieSubtotal + vrSubtotal;
	const voucherDiscount = Number(appliedVoucher?.discount_amount || 0);
	const totalPrice = Math.max(0, originalTotalPrice - voucherDiscount);

	// Reset voucher when cart changes
	useEffect(() => {
		setAppliedVoucher(null);
		setVoucherCode('');
	}, [movieSubtotal, vrSubtotal]);

	const applyVoucher = async () => {
		const code = voucherCode.trim();
		if (!code) {
			toast.error('Vui lòng nhập mã giảm giá');
			return;
		}
		try {
			setVoucherValidating(true);
			const vr_items = vrItems.map((i) => ({ vr_package_id: i.packageId, quantity: i.quantity }));
			const booking_type = movieItems.length > 0 && vrItems.length > 0 ? 'all' : (movieItems.length > 0 ? 'movie' : 'vr');

			const res = await validateVrVoucher({
				code,
				vr_items,
				branch_id: selectedBranch?.id,
				booking_type
			});

			if (res?.valid) {
				setAppliedVoucher(res);
				toast.success('Áp mã thành công', {
					description: `Tiết kiệm ${Number(res.discount_amount || 0).toLocaleString('vi-VN')}₫`
				});
			} else {
				setAppliedVoucher(null);
				toast.error('Mã không hợp lệ', {
					description: res?.message || 'Vui lòng kiểm tra lại mã'
				});
			}
		} catch (err: any) {
			setAppliedVoucher(null);
			toast.error('Mã không hợp lệ', {
				description: err?.message || 'Vui lòng kiểm tra lại mã'
			});
		} finally {
			setVoucherValidating(false);
		}
	};

	const validateForm = () => {
		const errors: { [key: string]: string } = {};

		if (selectedItems.length === 0) {
			errors.cart = 'Giỏ hàng của bạn đang trống. Vui lòng chọn ít nhất 1 dịch vụ.';
		}

		if (movieItems.length > 0 && availableMovies.length > 0 && selectedMovieIds.length === 0) {
			errors.movies = 'Vui lòng chọn bộ phim bạn muốn trải nghiệm';
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
			errors.email = 'Vui lòng nhập email nhận vé';
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

	const handleCheckoutSubmit = () => {
		if (isProcessing) return;
		if (selectedItems.length === 0) {
			toast.error('Giỏ hàng trống', {
				description: 'Vui lòng chọn dịch vụ trước khi thanh toán'
			});
			return;
		}
		if (!validateForm()) {
			toast.error('Vui lòng hoàn tất thông tin', {
				description: 'Kiểm tra lại các mục báo đỏ trên biểu mẫu'
			});
			return;
		}
		if (!confirmChecked) {
			toast.error('Chưa xác nhận điều khoản', {
				description: 'Vui lòng đánh dấu tick đồng ý điều khoản đặt vé'
			});
			return;
		}

		setShowEmailConfirmDialog(true);
	};

	const performBooking = async () => {
		try {
			setIsProcessing(true);
			const timestampSeconds = Math.floor(Date.now() / 1000);
			const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
			const orderId = `CS${String(timestampSeconds).padStart(10, '0')}${randomSuffix}`;

			const vr_items: VRPackageItem[] = vrItems.map((i) => ({
				vr_package_id: i.packageId,
				quantity: i.quantity
			}));

			const selectedVrList = vr_items.map((it) => {
				const p = vrPackages.find((pkg: any) => Number(pkg.id) === it.vr_package_id);
				return {
					...it,
					package_name: p?.name || 'Gói VR',
					unit_price: Number(p?.price || 0),
					duration_min: p?.duration_min,
					cover_image: p?.cover_image,
					line_total: Number(p?.price || 0) * it.quantity
				};
			});

			let canonicalTotal = totalPrice;
			let booking: any = null;

			// IF ONLY VR
			if (movieItems.length === 0 && vrItems.length > 0) {
				const validation = await validateVRBooking({
					email,
					emailBook: email,
					phone,
					name,
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id,
					paymentMethod
				});

				if (validation?.status && validation.status !== 200) {
					throw new Error(validation?.message || 'Không thể xác thực thông tin đặt vé VR');
				}
				canonicalTotal = Number(validation.total_price ?? totalPrice);

				const res = await createVRBooking({
					email,
					emailBook: email,
					phone,
					name,
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id,
					paymentMethod,
					pay_txt_code: orderId
				});
				if (res?.error || !res?.booking) {
					throw new Error(res?.error || 'Không thể tạo đặt vé VR');
				}
				booking = res.booking;
			} else {
				// HAS MOVIE TICKETS (and optionally VR)
				const mainMoviePkg = movieItems[0];
				const validation = await validateBookingApi({
					email,
					emailBook: email,
					phone,
					name,
					movieId: selectedMovie?.id,
					ticketCount: totalMovieCount,
					ticketPackageId: mainMoviePkg.packageId,
					combo: selectedMovieIds.map(String),
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id
				});

				if (!validation?.status) {
					throw new Error(validation?.message || 'Không thể xác thực thông tin đặt vé');
				}
				canonicalTotal = Number(validation.totalPrice ?? totalPrice);

				const res = await createBookingApi({
					email,
					emailBook: email,
					phone,
					name,
					movieId: selectedMovie?.id,
					ticketCount: totalMovieCount,
					paymentMethod,
					totalPrice: canonicalTotal,
					ticketPackageId: mainMoviePkg.packageId,
					pay_txt_code: orderId,
					combo: selectedMovieIds.map(String),
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id
				});
				booking = res.booking;
			}

			const summary = {
				orderId,
				movie: movieItems.length > 0 ? selectedMovie?.title : 'Gói Trải Nghiệm VR',
				name,
				phone,
				email,
				emailBook: email,
				quantity: movieItems.length > 0 ? totalMovieCount : totalVrCount,
				amount: canonicalTotal,
				movieTotalPrice: movieSubtotal,
				vrTotalPrice: vrSubtotal,
				vr_items: selectedVrList,
				booking_type: movieItems.length === 0 ? 'vr' : (vr_items.length > 0 ? 'combo_vr' : 'movie'),
				method: paymentMethod,
				poster: movieItems.length > 0 ? (selectedMovie?.cover_image || '') : (selectedVrList[0]?.cover_image || ''),
				duration: movieItems.length > 0 ? (selectedMovie?.duration_min ? `${selectedMovie.duration_min}` : '') : '',
				genres: movieItems.length > 0 ? (selectedMovie?.genres || '') : '',
				ticketPackageId: movieItems[0]?.packageId,
				ticketPackageName: movieItems.map((m) => `${m.name} x${m.quantity}`).join(', ') || 'Gói VR',
				branch_id: selectedBranch?.id,
				branch_name: selectedBranch?.name,
				voucher_code: appliedVoucher?.voucher_details?.code || null,
				voucher_discount_amount: voucherDiscount
			};

			// Clear purchased items from Cart
			try {
				clearSelected();
			} catch { }

			localStorage.setItem(
				'pendingOrder',
				JSON.stringify({
					...summary,
					booking_id: booking?.id,
					user_id: booking?.user_id
				})
			);

			if (paymentMethod === 'vietqr') {
				localStorage.setItem(
					'qrPaymentData',
					JSON.stringify({
						...summary,
						booking_id: booking?.id,
						user_id: booking?.user_id,
						totalAmount: canonicalTotal,
						movieTitle: summary.movie,
						ticketType: summary.ticketPackageName
					})
				);
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
				const partnerCode = process.env.NEXT_PUBLIC_MOMO_PARTNER_CODE || '';
				const partnerName = process.env.NEXT_PUBLIC_MOMO_PARTNER_NAME || 'CineSphere';
				const storeId = process.env.NEXT_PUBLIC_MOMO_STORE_ID || 'devstore';
				const clientBase = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
				const serverBase = SERVER_BASE_URL || clientBase;
				const redirectPath = process.env.NEXT_PUBLIC_MOMO_REDIRECT_URL || '/checkout';
				const ipnPath = process.env.NEXT_PUBLIC_MOMO_IPN_URL || '/api/momo/ipn';
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
					orderInfo: `${summary.movie} | ${summary.quantity} vé`,
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
			}

			if (paymentMethod === 'vnpay') {
				const clientBaseForVnp = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
				const returnPathForVnp = process.env.NEXT_PUBLIC_VNPAY_RETURN_URL || '/checkout';
				const returnUrl = `${clientBaseForVnp}${returnPathForVnp}`;
				const res = await createVnpayPaymentApi({
					amount: canonicalTotal,
					orderId,
					orderInfo: String(booking?.id || orderId),
					locale: 'vn',
					returnUrl
				});
				if (res?.payUrl) {
					window.location.href = res.payUrl;
					return;
				}
				throw new Error('Không nhận được liên kết thanh toán VNPay');
			}
		} catch (err: any) {
			console.error('Booking failed:', err);
			toast.error('Đặt vé thất bại', {
				description: err?.message || 'Có lỗi xảy ra trong quá trình xử lý đơn hàng'
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const isLoadingPage = isLoadingTickets || isLoadingVrPackages;

	return (
		<UserLayout>
			<div className="min-h-screen bg-[#070b14] relative overflow-hidden text-slate-100 selection:bg-cyan-500/30">
				{/* Ambient Background Lights */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden">
					<div className="hidden sm:block absolute top-10 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
					<div className="hidden sm:block absolute top-[500px] right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-[160px]" />
					<div className="hidden sm:block absolute top-[1200px] right-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-[130px]" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
					<div className="absolute inset-0 neon-noise opacity-20" />
				</div>

				<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-28 sm:pb-20">
					{/* Breadcrumb Navigation */}
					<div className="text-xs sm:text-sm pt-2 pb-6 flex items-center gap-2 text-slate-400">
						<button onClick={() => router.push('/')} className="hover:text-cyan-400 transition-colors">
							Trang chủ
						</button>
						<ChevronRight className="w-3.5 h-3.5 opacity-50" />
						<button onClick={openCart} className="hover:text-cyan-400 transition-colors">
							Giỏ hàng ({selectedItems.length})
						</button>
						<ChevronRight className="w-3.5 h-3.5 opacity-50" />
						<span className="text-cyan-300 font-semibold">Xác nhận &amp; Thanh toán</span>
					</div>

					{/* Header Title Bar */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
						<div>
							<div className="flex items-center gap-3">
								<span className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
									<ShoppingCart className="w-6 h-6" />
								</span>
								<div>
									<h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide flex items-center gap-2.5 flex-wrap">
										Xác Nhận Đơn Hàng
										<span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
											{selectedItems.length} dịch vụ đã chọn
										</span>
									</h1>
									<p className="text-xs sm:text-sm text-slate-400 mt-1">
										Chi nhánh:{' '}
										<span className="text-cyan-300 font-semibold">
											{selectedBranch?.name || 'CineSphere Mega Mall'}
										</span>
									</p>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Button
								variant="outline"
								onClick={openCart}
								className="h-10 text-xs px-4 border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold flex items-center gap-2"
							>
								<ShoppingCart className="w-4 h-4 text-cyan-400" />
								<span>Chỉnh sửa giỏ hàng</span>
							</Button>
						</div>
					</div>

					{isLoadingPage ? (
						<Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-white p-8 text-center rounded-2xl">
							<div className="flex flex-col items-center justify-center gap-3">
								<div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
								<p className="text-sm font-semibold text-slate-300">Đang chuẩn bị dữ liệu thanh toán...</p>
							</div>
						</Card>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
							{/* ================= LEFT COLUMN: SELECTED ITEMS & MOVIES (7 cols) ================= */}
							<div className="lg:col-span-7 space-y-6">
								{/* 1. ORDER ITEMS LIST CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5 sm:px-6">
										<div className="text-base sm:text-lg font-bold text-white flex items-center justify-between">
											<h2 className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-white">
												<span className="w-1.5 h-6 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
												<span>Chi Tiết Dịch Vụ Đã Chọn</span>
											</h2>
											<span className="text-xs text-slate-400 font-normal">
												Tổng {selectedItems.reduce((s, i) => s + i.quantity, 0)} vé/gói
											</span>
										</div>
									</CardHeader>

									<CardContent className="p-5 sm:p-6 space-y-4">
										{selectedItems.length === 0 ? (
											<div className="py-12 px-4 text-center space-y-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
												<div className="p-4 w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center">
													<ShoppingCart className="w-8 h-8 opacity-60" />
												</div>
												<div>
													<h4 className="font-bold text-white text-base">Giỏ hàng của bạn đang trống</h4>
													<p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
														Vui lòng chọn gói vé xem phim 8K hoặc gói trải nghiệm VR từ trang chủ để tiếp tục đặt vé.
													</p>
												</div>
												<div className="flex items-center justify-center gap-3 pt-2">
													<Button
														onClick={() => router.push('/')}
														className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs h-10 px-5 rounded-xl"
													>
														Khám phá gói vé
													</Button>
													<Button
														variant="outline"
														onClick={openCart}
														className="border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs h-10 px-5 rounded-xl font-bold"
													>
														Mở giỏ hàng
													</Button>
												</div>
											</div>
										) : (
											<div className="divide-y divide-white/10 space-y-4">
												{selectedItems.map((item) => {
													const lineTotal = item.price * item.quantity;
													const isMovie = item.type === 'movie';

													return (
														<div key={item.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
															{/* Item Left: Image & Details */}
															<div className="flex items-center gap-3.5 min-w-0 flex-1">
																<div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative bg-slate-950 border border-white/10 flex items-center justify-center shadow-md">
																	{item.cover_image ? (
																		<img
																			src={optimizeCloudinaryUrl(item.cover_image, 160)}
																			alt={item.name}
																			className="w-full h-full object-cover"
																			onError={(e) => {
																				(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
																			}}
																		/>
																	) : (
																		<div
																			className={`w-full h-full flex items-center justify-center ${isMovie
																				? 'bg-gradient-to-br from-blue-900/60 to-cyan-900/60 text-cyan-400'
																				: 'bg-gradient-to-br from-purple-900/60 to-pink-900/60 text-purple-400'
																				}`}
																		>
																			{isMovie ? <Film className="w-7 h-7" /> : <Gamepad2 className="w-7 h-7" />}
																		</div>
																	)}
																	{item.duration_min && (
																		<span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-[9px] font-bold text-white px-1 py-0.2 rounded">
																			{item.duration_min}'
																		</span>
																	)}
																</div>

																<div className="min-w-0 space-y-1">
																	<div className="flex items-center gap-2 flex-wrap">
																		<h4 className="font-extrabold text-white text-sm sm:text-base leading-snug">
																			{item.name}
																		</h4>
																		<span
																			className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isMovie
																				? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
																				: 'bg-purple-500/15 border-purple-500/30 text-purple-300'
																				}`}
																		>
																			{isMovie ? 'Vé Xem Phim 8K' : item.vr_genre || 'Gói VR'}
																		</span>
																	</div>
																	<p className="text-xs text-slate-400 flex items-center gap-2">
																		<span>Đơn giá: {item.price.toLocaleString('vi-VN')}₫</span>
																	</p>
																</div>
															</div>

															{/* Item Right: Quantity & Line Price */}
															<div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
																{/* Quantity Controls */}
																<div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
																	<button
																		type="button"
																		onClick={() => updateQuantity(item.id, item.quantity - 1)}
																		className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30"
																		disabled={item.quantity <= 1}
																		title="Giảm số lượng"
																	>
																		<Minus className="w-3.5 h-3.5" />
																	</button>
																	<span className="w-8 text-center text-xs font-black text-white">
																		{item.quantity}
																	</span>
																	<button
																		type="button"
																		onClick={() => updateQuantity(item.id, item.quantity + 1)}
																		className="w-7 h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 flex items-center justify-center transition-colors shadow-xs"
																		title="Tăng số lượng"
																	>
																		<Plus className="w-3.5 h-3.5" />
																	</button>
																</div>

																{/* Total Line Money */}
																<div className="text-right min-w-[100px]">
																	<p className="text-sm sm:text-base font-black text-white">
																		{lineTotal.toLocaleString('vi-VN')}₫
																	</p>
																</div>

																{/* Trash Button */}
																<button
																	type="button"
																	onClick={() => removeItem(item.id)}
																	className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
																	title="Xóa mục này"
																>
																	<Trash2 className="w-4 h-4" />
																</button>
															</div>
														</div>
													);
												})}
											</div>
										)}
									</CardContent>
								</Card>

								{/* 2. CHỌN PHIM TRẢI NGHIỆM (Chỉ hiện khi trong giỏ có gói vé xem phim) */}
								{movieItems.length > 0 && (
									<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
										<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5 sm:px-6">
											<CardTitle className="text-base sm:text-lg font-bold text-white flex items-center justify-between">
												<div className="flex items-center gap-2.5">
													<span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-cyan-500 rounded-full" />
													<span>Chọn Phim Áp Dụng Cho Suất Xem</span>
												</div>
												<span className="text-xs text-cyan-400 font-semibold">
													{availableMovies.length} phim khả dụng
												</span>
											</CardTitle>
										</CardHeader>

										<CardContent className="p-5 sm:p-6 space-y-4">
											{availableMovies.length > 0 ? (
												<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
													{availableMovies.map((m: any) => {
														const isSelected = selectedMovieIds.includes(m.id);

														return (
															<div
																key={m.id}
																onClick={() => {
																	setSelectedMovieIds([m.id]);
																	if (formErrors.movies) {
																		setFormErrors((prev) => ({ ...prev, movies: '' }));
																	}
																}}
																className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 shadow-md ${isSelected
																	? 'ring-2 ring-cyan-400 border-2 border-cyan-400 bg-cyan-500/15 scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)]'
																	: 'border border-white/10 bg-white/5 hover:border-cyan-400/50 hover:bg-white/10'
																	}`}
															>
																<div className="aspect-[2/3] relative overflow-hidden bg-slate-950">
																	<img
																		src={optimizeCloudinaryUrl(m.cover_image, 300)}
																		alt={m.title}
																		loading="lazy"
																		className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
																		onError={(e) => {
																			(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
																		}}
																	/>

																	{/* Checkmark Tag */}
																	{isSelected && (
																		<div className="absolute top-2 right-2 z-10 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg text-black">
																			<Check className="w-3.5 h-3.5 stroke-[3]" />
																		</div>
																	)}

																	<div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-90" />

																	<div className="absolute bottom-0 p-2.5 w-full space-y-1">
																		<p className="text-xs font-black text-white leading-tight line-clamp-1 group-hover:text-cyan-300 transition-colors">
																			{m.title}
																		</p>
																		<div className="flex items-center gap-1.5">
																			<span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[9px] text-cyan-300 font-bold border border-cyan-500/30">
																				{m.duration_min ? `${m.duration_min} Phút` : '8K'}
																			</span>
																			{m.genres && (
																				<span className="text-[9px] text-slate-400 truncate">
																					{m.genres}
																				</span>
																			)}
																		</div>
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-slate-400 text-xs">
													Đang cập nhật danh sách phim cho gói vé này
												</div>
											)}

											{formErrors.movies && (
												<p className="text-orange-400 text-xs mt-1 animate-pulse flex items-center gap-1.5">
													<Info className="w-3.5 h-3.5" />
													{formErrors.movies}
												</p>
											)}
										</CardContent>
									</Card>
								)}

								{/* 3. SAFETY / CONVENIENCE NOTES */}
								<div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md space-y-2.5">
									<h4 className="text-slate-300 font-bold text-xs sm:text-sm flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-cyan-400" />
										Lưu ý dành cho khách trải nghiệm:
									</h4>
									<ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400 list-inside list-disc">
										<li>Vui lòng có mặt trước giờ chiếu 10-15 phút.</li>
										<li>Xuất trình mã QR tại quầy tiếp tân để nhận vé cứng.</li>
										<li>Phòng chiếu trang bị hệ thống âm thanh vòm &amp; Hologram 8K.</li>
										<li>Vé điện tử đã thanh toán không hoàn trả hoặc hủy vé.</li>
									</ul>
								</div>
							</div>

							{/* ================= RIGHT COLUMN: CUSTOMER, PAYMENT & SUMMARY (5 cols) ================= */}
							<div className="lg:col-span-5 space-y-6">
								{/* 1. CUSTOMER INFO CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full" />
											<span>Thông Tin Nhận Vé</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-4">
										{/* Họ tên */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Họ và Tên <span className="text-cyan-400">*</span>
											</Label>
											<Input
												value={name}
												onChange={(e) => {
													setName(e.target.value);
													if (formErrors.name && e.target.value.trim().length >= 2) {
														setFormErrors((prev) => ({ ...prev, name: '' }));
													}
												}}
												placeholder="Ví dụ: Nguyễn Văn A"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${formErrors.name ? 'border-orange-500/50' : ''
													}`}
											/>
											{formErrors.name && (
												<p className="text-orange-400 text-[11px] animate-pulse">{formErrors.name}</p>
											)}
										</div>

										{/* SĐT */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Số Điện Thoại <span className="text-cyan-400">*</span>
											</Label>
											<Input
												value={phone}
												maxLength={10}
												inputMode="numeric"
												onChange={(e) => {
													const val = e.target.value;
													if (!/^\d*$/.test(val)) return;
													setPhone(val);
													if (val && !val.startsWith('0')) {
														setPhoneError('Số điện thoại phải bắt đầu bằng số 0');
													} else {
														setPhoneError('');
													}
												}}
												placeholder="VD: 0912345678"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${phoneError || formErrors.phone ? 'border-orange-500/50' : ''
													}`}
											/>
											{(phoneError || formErrors.phone) && (
												<p className="text-orange-400 text-[11px] animate-pulse">
													{phoneError || formErrors.phone}
												</p>
											)}
										</div>

										{/* Email */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Email Nhận Mã QR Vé <span className="text-cyan-400">*</span>
											</Label>
											<Input
												type="email"
												value={email}
												onChange={(e) => {
													const val = e.target.value;
													setEmail(val);
													if (!val) {
														setEmailError('');
													} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
														setEmailError('Email không đúng định dạng');
													} else if (
														!/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(val)
													) {
														setEmailError('Vui lòng dùng Gmail, Outlook, Yahoo hoặc iCloud');
													} else {
														setEmailError('');
													}
												}}
												placeholder="you@email.com"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${emailError || formErrors.email ? 'border-orange-500/50' : ''
													}`}
											/>
											{(emailError || formErrors.email) && (
												<p className="text-orange-400 text-[11px] animate-pulse">
													{emailError || formErrors.email}
												</p>
											)}
										</div>
									</CardContent>
								</Card>

								{/* 2. VOUCHER & PAYMENT METHOD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
											<span>Ưu Đãi &amp; Thanh Toán</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-5">
										{/* Voucher */}
										<div className="space-y-2">
											<Label className="text-xs font-semibold text-slate-300">Mã Giảm Giá (Voucher)</Label>
											{appliedVoucher ? (
												<div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
													<div className="flex items-center gap-2.5 min-w-0">
														<div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
															<Tag className="w-4 h-4" />
														</div>
														<div className="min-w-0">
															<p className="font-bold text-white truncate">
																{appliedVoucher?.voucher_details?.code?.toUpperCase() || voucherCode.toUpperCase()}
															</p>
															<p className="text-[11px] text-emerald-300 font-bold">
																Đã giảm: -{voucherDiscount.toLocaleString('vi-VN')}₫
															</p>
														</div>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
														onClick={() => {
															setAppliedVoucher(null);
															setVoucherCode('');
															toast.info('Đã hủy áp dụng mã giảm giá');
														}}
													>
														<X className="w-4 h-4" />
													</Button>
												</div>
											) : (
												<div className="flex gap-2">
													<Input
														type="text"
														placeholder="NHẬP MÃ GIẢM GIÁ"
														value={voucherCode}
														onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
														onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
														className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 uppercase font-mono font-bold text-xs rounded-xl"
													/>
													<Button
														type="button"
														onClick={applyVoucher}
														disabled={voucherValidating || !voucherCode.trim()}
														className="h-11 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shrink-0 transition-all duration-300"
													>
														{voucherValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
														Áp dụng
													</Button>
												</div>
											)}
										</div>

										{/* Payment Gateway Choices */}
										<div className="space-y-2.5 pt-2 border-t border-white/5">
											<Label className="text-xs font-semibold text-slate-300">Phương Thức Thanh Toán</Label>
											<div className="grid grid-cols-1 gap-2.5">
												{/* VietQR */}
												<button
													type="button"
													onClick={() => setPaymentMethod('vietqr')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${paymentMethod === 'vietqr'
														? 'bg-red-500/15 border-red-500/60 ring-1 ring-red-500/30 text-white'
														: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
														}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shadow-md">
															<QrCode className="w-5 h-5" />
														</div>
														<div>
															<p className="font-bold text-sm text-white">Chuyển khoản VietQR</p>
															<p className="text-[11px] text-slate-400">Quét mã QR tự động 24/7 (Khuyên dùng)</p>
														</div>
													</div>
													{paymentMethod === 'vietqr' && (
														<span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button>

												{/* MoMo */}
												{/* <button
													type="button"
													onClick={() => setPaymentMethod('momo')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
														paymentMethod === 'momo'
															? 'bg-pink-500/15 border-pink-500/60 ring-1 ring-pink-500/30 text-white'
															: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
													}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-[#a50064] text-white flex items-center justify-center font-black text-xs shadow-md">
															M
														</div>
														<div>
															<p className="font-bold text-sm text-white">Ví điện tử MoMo</p>
															<p className="text-[11px] text-slate-400">Thanh toán tức thì qua ứng dụng MoMo</p>
														</div>
													</div>
													{paymentMethod === 'momo' && (
														<span className="w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button> */}

												{/* VNPay */}
												{/* <button
													type="button"
													onClick={() => setPaymentMethod('vnpay')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
														paymentMethod === 'vnpay'
															? 'bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/30 text-white'
															: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
													}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-[#005baa] text-white flex items-center justify-center font-black text-xs shadow-md">
															VNP
														</div>
														<div>
															<p className="font-bold text-sm text-white">Cổng thanh toán VNPAY</p>
															<p className="text-[11px] text-slate-400">Thẻ ATM nội địa, Visa, MasterCard</p>
														</div>
													</div>
													{paymentMethod === 'vnpay' && (
														<span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button> */}
											</div>
										</div>
									</CardContent>
								</Card>

								{/* 3. ORDER SUMMARY CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-cyan-400 to-emerald-400 rounded-full" />
											<span>Tóm Tắt Thanh Toán</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-3.5 text-xs sm:text-sm">
										{/* Movie Subtotal */}
										{movieSubtotal > 0 && (
											<div className="flex justify-between items-center text-slate-300">
												<span className="flex items-center gap-1.5">
													<Film className="w-3.5 h-3.5 text-cyan-400" />
													Vé xem phim 8K ({totalMovieCount} vé)
												</span>
												<span className="font-semibold text-white">
													{movieSubtotal.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* VR Subtotal */}
										{vrSubtotal > 0 && (
											<div className="flex justify-between items-center text-slate-300">
												<span className="flex items-center gap-1.5">
													<Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
													Gói trải nghiệm VR ({totalVrCount} lượt)
												</span>
												<span className="font-semibold text-white">
													{vrSubtotal.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* Voucher Discount */}
										{voucherDiscount > 0 && (
											<div className="flex justify-between items-center text-emerald-400 pt-2 border-t border-white/5">
												<span className="flex items-center gap-1.5 font-semibold">
													<Tag className="w-3.5 h-3.5" />
													Giảm giá Voucher ({appliedVoucher?.voucher_details?.code?.toUpperCase()})
												</span>
												<span className="font-bold">
													-{voucherDiscount.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* Total Final Price */}
										<div className="pt-3 border-t border-white/10 flex justify-between items-end">
											<div>
												<p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
													Tổng thanh toán
												</p>
												<p className="text-[11px] text-slate-500">Đã bao gồm VAT &amp; dịch vụ</p>
											</div>
											<div className="text-right">
												<p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(6,182,212,0.35)]">
													{totalPrice.toLocaleString('vi-VN')}₫
												</p>
											</div>
										</div>

										{/* Terms Agreement Checkbox */}
										<div className="pt-4 border-t border-white/5">
											<div className="flex items-start gap-2.5">
												<Checkbox
													id="agree-terms"
													checked={confirmChecked}
													onCheckedChange={(c) => setConfirmChecked(c === true)}
													className="mt-0.5 border-white/30 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
												/>
												<label
													htmlFor="agree-terms"
													className="text-[11px] leading-relaxed text-slate-400 cursor-pointer select-none"
												>
													Tôi đã kiểm tra kỹ thông tin đơn hàng và đồng ý với điều khoản đặt vé của CineSphere.
												</label>
											</div>
										</div>

										{/* Action Submit Button */}
										<div className="pt-2">
											<Button
												type="button"
												disabled={isProcessing || selectedItems.length === 0}
												onClick={handleCheckoutSubmit}
												className="w-full h-14 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-black font-extrabold text-base rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
											>
												{isProcessing ? (
													<span className="flex items-center justify-center gap-2 text-white">
														<Loader2 className="w-5 h-5 animate-spin" />
														<span>Đang khởi tạo đơn hàng...</span>
													</span>
												) : (
													<span className="flex items-center justify-center gap-2">
														<span>Xác Nhận &amp; Thanh Toán</span>
														<ArrowRight className="w-5 h-5" />
													</span>
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					)}
				</div>

				{/* Sticky Bottom Action Bar on Mobile */}
				{selectedItems.length > 0 && (
					<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 shadow-2xl">
						<div className="flex items-center justify-between gap-4">
							<div className="min-w-0">
								<p className="text-[10px] text-slate-400 uppercase font-bold truncate">
									Tổng ({selectedItems.reduce((s, i) => s + i.quantity, 0)} mục)
								</p>
								<p className="text-lg font-black text-cyan-300 leading-tight">
									{totalPrice.toLocaleString('vi-VN')}₫
								</p>
							</div>
							<Button
								type="button"
								disabled={isProcessing}
								onClick={handleCheckoutSubmit}
								className="px-6 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-sm rounded-xl shadow-lg active:scale-95 transition-all"
							>
								Thanh toán
							</Button>
						</div>
					</div>
				)}

				{/* EMAIL CONFIRMATION MODAL */}
				<AlertDialog open={showEmailConfirmDialog} onOpenChange={setShowEmailConfirmDialog}>
					<AlertDialogContent className="bg-slate-900 border border-white/15 text-white max-w-md rounded-2xl p-6">
						<AlertDialogHeader>
							<AlertDialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
								<CheckCircle2 className="w-5 h-5 text-cyan-400" />
								Kiểm tra thông tin nhận vé
							</AlertDialogTitle>
							<AlertDialogDescription className="text-slate-300 text-xs leading-relaxed space-y-3 pt-2">
								<p>
									Mã QR vé điện tử và hướng dẫn check-in sẽ được gửi trực tiếp tới email của bạn:
								</p>
								<div className="p-3 rounded-xl bg-white/5 border border-white/10 font-bold text-cyan-300 text-sm break-all text-center">
									{email}
								</div>
								<p className="text-[11px] text-slate-400">
									Vui lòng đảm bảo email trên là chính xác để không bỏ lỡ mã vé.
								</p>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter className="flex gap-2 pt-3">
							<AlertDialogCancel
								onClick={() => setShowEmailConfirmDialog(false)}
								className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl font-bold h-10 px-4"
							>
								Đổi email khác
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									setShowEmailConfirmDialog(false);
									performBooking();
								}}
								className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs rounded-xl h-10 px-5"
							>
								Đúng, tiến hành thanh toán
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</UserLayout>
	);
>>>>>>> preview
}
