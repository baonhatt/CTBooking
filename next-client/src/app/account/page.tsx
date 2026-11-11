'use client';

import { formatDateTimeVN, formatDOB } from '@/lib/utils';
import { isValidPayCode, localDeadlineMs, serverClockOffsetMs } from '@/lib/payment-flow';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UserLayout from '@/layouts/UserLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle2, Clock, Copy, Lock, MapPin, Mars, ShieldCheck, Ticket, User, Venus, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { copyText } from '@/lib/clipboard';
import { cancelBookingByToken } from '@/lib/api/booking';
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
import ChangePasswordDialog from '@/components/user/account/ChangePasswordDialog';
import TicketDetailDialog from '@/components/user/account/TicketDetailDialog';
import { formatDateTime, getBookingCode, formatMoney } from '@/lib/account-format';
import { updateUserProfileApi, getUserTransactionsApi, getUserProfileByEmailApi } from '@/lib/api';
import { getCookie, setCookie } from '@/lib/cookies';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { parseMoviePackages, bookingTypeBadge } from '@shared/booking-invoice';

export interface VRItem {
    id?: number;
    booking_id?: number;
    package_name: string;
    quantity: number;
    unit_price: number;
    discounted_unit_price?: number;
    line_total?: number;
    vr_ticket_package_id?: number;
    vr_package_id?: number;
}

export interface UserTransactionItem {
    id: number;
    booking_id: number;
    booking_code: string;
    pay_txt_code: string;
    /** Proves the order is yours, so the payment page can read its status and cancel it. Only on unpaid orders. */
    order_token?: string | null;
    payment_expires_at?: string | null;
    branch_id?: number | null;
    movie: string;
    ticket_package: string;
    quantity: number;
    amount: number;
    original_amount: number;
    discount_amount: number;
    voucher_code: string | null;
    voucher_details?: {
        scope?: string | null;
        description?: string | null;
        applicable_ids?: unknown;
    } | null;
    method: string;
    payment_status: string;
    booking_type?: 'movie' | 'vr' | 'combo_vr';
    vr_items?: VRItem[];
    ticket_unit_price?: number;
    created_at: string;
    paid_at?: string;
    expiry_date?: string;
    is_used: boolean;
    updated_at?: string;
    branch_name?: string;
    branch_address?: string;
    isExpired?: boolean;
    expired?: boolean;
    remainingTimeLabel?: string;
}



export default function Account() {
    const router = useRouter();
    const [profile, setProfile] = useState<{
        name: string;
        phone: string;
        email: string;
        gender?: string;
        dob?: string;
    }>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = getCookie('userProfile') || localStorage.getItem('userProfile');
                if (raw) {
                    const p = JSON.parse(raw);
                    return {
                        name: p?.name || '',
                        phone: p?.phone || '',
                        email: p?.email || '',
                        gender: p?.gender || '',
                        dob: p?.dob || ''
                    };
                }
            } catch { }
        }
        return { name: '', phone: '', email: '', gender: '', dob: '' };
    });
    const [isPwdOpen, setIsPwdOpen] = useState(false);

    const [transactions, setTransactions] = useState<UserTransactionItem[]>([]);
    const [isLoadingTx, setIsLoadingTx] = useState(true);
    // True when the order list could not be loaded (so an empty list is not mistaken for "no orders")
    const [txError, setTxError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    // Ticks once a second while an order waits for payment, to count its deadline down
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [cancelTarget, setCancelTarget] = useState<UserTransactionItem | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    // Server clock minus this browser's clock. A payment deadline is counted on the server's time.
    const [serverClockOffset, setServerClockOffset] = useState(0);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<UserTransactionItem | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [tab, setTab] = useState<'history' | 'info'>('history');
    const pageSize = 5;
    const PAYMENT_METHODS_DISPLAY: Record<string, string> = {
        vietqr: 'Chuyển khoản VietQR',
        card: 'Thẻ ngân hàng'
    };

    const getMovieCountFromCombo = (comboStr: string) => {
        try {
            if (!comboStr) return 0;
            const comboArray = JSON.parse(comboStr);
            return Array.isArray(comboArray) ? comboArray.length : 0;
        } catch (error) {
            console.error('Lỗi parse combo:', error);
            return 0;
        }
    };
    const handleCopy = async (text: string) => {
        if (await copyText(text)) {
            toast.success('Đã sao chép');
        } else {
            toast.error('Không sao chép được, hãy nhấn giữ vào mã để chọn');
        }
    };

    const handleContinuePayment = (t: any) => {
        try {
            // The payment reference (the transfer content) and the order token both come from the server.
            // Without them no correct transfer can be made, so the customer is asked to order again.
            if (!isValidPayCode(t.pay_txt_code) || !t.order_token) {
                toast.error('Không thể tiếp tục thanh toán đơn này. Vui lòng đặt vé lại.');
                return;
            }

            const deadlineMs = localDeadlineMs(t.payment_expires_at, serverClockOffset);
            if (deadlineMs === null) {
                toast.error('Giao dịch thiếu thông tin hạn thanh toán.');
                return;
            }
            if (Date.now() >= deadlineMs) {
                toast.error('Đơn hàng này đã quá hạn thanh toán (10 phút) và không thể thanh toán.');
                return;
            }

            localStorage.setItem('qrPaymentEndTime', String(deadlineMs));
            localStorage.setItem('qrPaymentData', JSON.stringify({
                bookingId: t.booking_id || t.id,
                orderId: t.pay_txt_code,
                pay_txt_code: t.pay_txt_code,
                order_token: t.order_token,
                payment_expires_at: t.payment_expires_at,
                server_clock_offset_ms: serverClockOffset,
                amount: t.amount,
                totalAmount: t.amount,
                quantity: t.quantity,
                movieTitle: t.movie,
                ticketType: t.ticket_package,
                branch_id: t.branch_id,
                branch_name: t.branch_name || '',
                vr_items: t.vr_items || [],
                booking_type: t.booking_type || 'movie'
            }));

            router.push('/qr-payment');
        } catch (error) {
            console.error('Continue payment error:', error);
            toast.error('Đã xảy ra lỗi, vui lòng thử lại sau.');
        }
    };

    useEffect(() => {
        const email = profile.email;
        if (!email) {
            setIsLoadingTx(false);
            return;
        }

        let isMounted = true;
        setIsLoadingTx(true);

        let txFailed = false;
        setTxError(false);
        // Parallel fetch profile details and transactions
        Promise.all([
            getUserProfileByEmailApi(email).catch(() => null),
            getUserTransactionsApi({ email, status: 'all' }).catch(() => {
                txFailed = true;
                return { items: [] };
            })
        ]).then(([data, txRes]) => {
            if (!isMounted) return;

            if (data) {
                const dobStr = formatDOB(data?.dob);
                setProfile((p) => ({
                    ...p,
                    name: data?.fullname || p.name || '',
                    phone: data?.phone || p.phone || '',
                    email: data?.email || p.email || '',
                    gender: (data?.gender as any) || p.gender || '',
                    dob: dobStr || p.dob || ''
                }));
            }

            setServerClockOffset(serverClockOffsetMs((txRes as any)?.server_now));

            const items = txRes?.items || [];
            const mapped =
                items.map((t: any) => ({
                    ...t,
                    poster: t?.poster || t?.cover_image || t?.coverImage || t?.poster_url,
                    date: (() => {
                        try {
                            const src = t?.paid_at || t?.created_at;
                            return src ? new Date(src) : null;
                        } catch {
                            return null;
                        }
                    })(),
                    dateDisplay: (() => {
                        try {
                            const dsrc = t?.paid_at || t?.created_at;
                            if (!dsrc) return '';
                            return formatDateTimeVN(dsrc);
                        } catch {
                            return '';
                        }
                    })(),
                    isExpired: (() => {
                        try {
                            if (!t.expiry_date) return false;
                            return new Date(t.expiry_date).getTime() < Date.now();
                        } catch {
                            return false;
                        }
                    })(),
                    remainingTimeLabel: (() => {
                        try {
                            if (!t.expiry_date || t.is_used || t.payment_status !== 'paid') return null;
                            const expiry = new Date(t.expiry_date).getTime();
                            const now = Date.now();
                            const diff = expiry - now;
                            if (diff <= 0) return 'Đã hết hạn';

                            const dayMs = 24 * 60 * 60 * 1000;
                            const hourMs = 60 * 60 * 1000;
                            const minMs = 60 * 1000;

                            if (diff >= dayMs) {
                                return `(còn ${Math.ceil(diff / dayMs)} ngày)`;
                            } else if (diff >= hourMs) {
                                return `(còn ${Math.floor(diff / hourMs)} giờ)`;
                            } else {
                                return `(còn ${Math.max(1, Math.floor(diff / minMs))} phút)`;
                            }
                        } catch {
                            return null;
                        }
                    })()
                })) || [];

            mapped.sort((a: any, b: any) => {
                const tA = a.date ? a.date.getTime() : 0;
                const tB = b.date ? b.date.getTime() : 0;
                return tB - tA;
            });

            setTransactions(mapped);
            setTxError(txFailed);
            setIsLoadingTx(false);
        });

        return () => {
            isMounted = false;
        };
    }, [profile.email, reloadKey]);

    useEffect(() => {
        setCurrentPage(1);
    }, [transactions]);

    useEffect(() => {
        const readHash = () => {
            const hash = (window.location.hash || '').replace('#', '').toLowerCase();
            if (hash === 'profile' || hash === 'info') setTab('info');
            else if (hash === 'transaction' || hash === 'history') setTab('history');
        };
        readHash();
        window.addEventListener('hashchange', readHash);
        return () => window.removeEventListener('hashchange', readHash);
    }, []);

    const hasWaitingOrder = useMemo(() => transactions.some((t) => t.payment_status === 'pending'), [transactions]);

    useEffect(() => {
        if (!hasWaitingOrder) return;
        const timerId = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timerId);
    }, [hasWaitingOrder]);

    // Seconds left to pay an order, on the server's clock; null when the order carries no deadline
    const secondsLeftToPay = (t: UserTransactionItem): number | null => {
        const deadlineMs = localDeadlineMs(t.payment_expires_at, serverClockOffset);
        if (deadlineMs === null) return null;
        return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
    };

    const formatCountdown = (totalSeconds: number) =>
        `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;

    // The customer cancels an order that is still waiting for payment (the server checks the order is theirs)
    const handleCancelOrder = async () => {
        const target = cancelTarget;
        if (!target?.order_token) return;
        setIsCancelling(true);
        const { httpStatus } = await cancelBookingByToken(Number(target.booking_id || target.id), String(target.order_token));
        setIsCancelling(false);
        setCancelTarget(null);

        if (httpStatus === 200) {
            toast.success('Đã hủy đơn');
            setTransactions((previous) =>
                previous.map((item) => (item.id === target.id ? { ...item, payment_status: 'failed' } : item))
            );
        } else if (httpStatus === 409) {
            toast.info('Đơn này đã được thanh toán');
            setReloadKey((value) => value + 1);
        } else if (httpStatus === 404) {
            toast.error('Không tìm thấy đơn này');
            setReloadKey((value) => value + 1);
        } else {
            toast.error('Chưa kết nối được máy chủ để hủy đơn. Đơn sẽ tự hết hạn sau ít phút.');
        }
    };

    const handleTabChange = (val: string) => {
        const value = val === 'info' ? 'info' : 'history';
        setTab(value);
        const targetHash = value === 'info' ? '#profile' : '#transaction';
        if (window.location.hash !== targetHash) {
            window.history.replaceState(null, '', targetHash);
        }
    };

    const limitedTransactions = useMemo(() => {
        return (transactions || []).slice(0, 20);
    }, [transactions]);

    const pagedTransactions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return limitedTransactions.slice(start, start + pageSize);
    }, [limitedTransactions, currentPage]);

    const totalPages = useMemo(() => {
        const total = Math.ceil(limitedTransactions.length / pageSize);
        return total || 1;
    }, [limitedTransactions]);

    const groups = useMemo(() => {
        const toMonthKey = (t: any) => {
            try {
                const src = t?.paid_at || t?.created_at;
                if (!src) return 'Khác';
                const d = new Date(src);
                const formatter = new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    month: '2-digit',
                    year: 'numeric'
                });
                const parts = formatter.formatToParts(d);
                const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
                return `Tháng ${getPart('month')}/${getPart('year')}`;
            } catch {
                return 'Khác';
            }
        };
        const map = new Map<string, any[]>();
        pagedTransactions?.forEach((t) => {
            const key = toMonthKey(t);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(t);
        });
        const arr = Array.from(map.entries()).map(([month, items]) => ({
            month,
            items
        }));
        return arr.sort((a, b) => {
            try {
                const parseDate = (str: string) => {
                    if (str === 'Khác') return 0;
                    const [_, datePart] = str.split(' ');
                    const [month, year] = datePart.split('/');
                    return new Date(Number(year), Number(month) - 1).getTime();
                };
                return parseDate(b.month) - parseDate(a.month);
            } catch {
                return 0;
            }
        });
    }, [pagedTransactions]);

    const getPoster = (tx: any | null) =>
        tx?.cover_image || tx?.coverImage || tx?.poster || tx?.poster_url || tx?.thumbnail || tx?.image || '';

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        try {
            await updateUserProfileApi({
                email: profile.email,
                name: profile.name,
                phone: profile.phone,
                gender: profile.gender,
                dob: profile.dob
            });
            const p = {
                email: profile.email,
                name: profile.name,
                phone: profile.phone,
                gender: profile.gender,
                dob: profile.dob
            };
            localStorage.setItem('userProfile', JSON.stringify(p));
            setCookie('userProfile', JSON.stringify(p), 60 * 60 * 24 * 30);
            toast.success('Cập nhật thành công');
        } catch (e: any) {
            toast.error('Cập nhật thất bại', { description: e?.message || '' });
        } finally {
            setIsSavingProfile(false);
        }
    };

    return (
        <ProtectedRoute>
            <UserLayout className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]" hideFooter>
                <div className="relative min-h-screen">
                    <div className="absolute inset-0 pointer-events-none z-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: `rgba(0,0,0,${Number(process.env.NEXT_PUBLIC_BACKDROP_DARK_BASE ?? 0.5)})`
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
                        <div className="absolute inset-0 neon-noise opacity-25" />
                    </div>
                    <div className="relative z-10 max-w-3xl mx-auto px-3 sm:px-4 pb-16 pt-28 md:pt-36 w-full overflow-x-hidden">
                        <div className="flex items-center pt-2 gap-2 text-sm text-gray-300 mb-6">
                            <Link href="/" className="inline-flex items-center min-h-[44px] text-blue-300 hover:text-blue-200">
                                Trang chủ
                            </Link>
                            <span className="text-gray-400">›</span>
                            <span className="text-white font-medium">Tài Khoản</span>
                        </div>
                        <Card className="w-full bg-[rgba(11,29,58,0.85)] border border-white/10 text-white shadow-2xl overflow-hidden">
                            <CardHeader className="pb-4 px-3 sm:px-6">
                                <CardTitle className="text-xl sm:text-2xl text-blue-400">Tài Khoản</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 sm:px-6 py-4">
                                <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                                    <TabsList className="bg-white/5 border border-white/10 rounded-full px-1">
                                        <TabsTrigger
                                            className="min-h-[44px] data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                                            value="history"
                                        >
                                            Lịch Sử Giao Dịch
                                        </TabsTrigger>
                                        <TabsTrigger
                                            className="min-h-[44px] data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                                            value="info"
                                        >
                                            Thông Tin Cá Nhân
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="info" className="mt-6 outline-none">
                                        <div className="space-y-8 bg-[#1e2536]/50 p-4 sm:p-6 rounded-2xl border border-white/5">
                                            {/* Section 1: Thông tin cá nhân */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                                    <User size={16} className="text-blue-400" />
                                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Thông tin cá nhân</h2>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="profile-name" className="text-xs font-semibold text-gray-400 ml-1">Họ và tên</Label>
                                                        <Input
                                                            id="profile-name" autoComplete="name" className="h-11 bg-[#0f172a] border-white/10 text-white focus:border-blue-500/50 transition-all"
                                                            value={profile.name}
                                                            onChange={(e) =>
                                                                setProfile((p) => ({
                                                                    ...p,
                                                                    name: e.target.value
                                                                }))
                                                            }
                                                            placeholder="Nhập họ và tên"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-gray-400 ml-1">Ngày sinh</Label>
                                                        <Input
                                                            type="date"
                                                            value={profile.dob || ''}
                                                            onChange={(e) =>
                                                                setProfile((p) => ({
                                                                    ...p,
                                                                    dob: e.target.value
                                                                }))
                                                            }
                                                            className="h-11 bg-[#0f172a] border-white/10 text-white focus:border-blue-500/50 transition-all cursor-pointer"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-gray-400 ml-1">Giới tính</Label>
                                                        <div className="flex gap-4">
                                                            {['male', 'female'].map((gender) => (
                                                                <button
                                                                    type="button" key={gender}
                                                                    onClick={() => setProfile((p) => ({ ...p, gender }))}
                                                                    className={`flex-1 h-11 rounded-md border transition-all flex items-center justify-center gap-2 text-sm ${profile.gender === gender
                                                                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                                                            : 'bg-[#0f172a] border-white/10 text-gray-400 hover:border-white/20'
                                                                        }`}
                                                                >
                                                                    {gender === 'male' ? <Mars size={16} /> : <Venus size={16} />}
                                                                    {gender === 'male' ? 'Nam' : 'Nữ'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Section 2: Liên hệ & Bảo mật */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                                                    <ShieldCheck size={16} className="text-blue-400" />
                                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tài khoản & Bảo mật</h2>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2 group">
                                                        <Label className="text-xs font-semibold text-gray-400 ml-1">Email (Định danh)</Label>
                                                        <div className="relative">
                                                            <Input
                                                                className="h-11 bg-white/5 border-white/5 text-gray-500 cursor-not-allowed pr-10"
                                                                value={profile.email}
                                                                readOnly
                                                            />
                                                            <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="profile-phone" className="text-xs font-semibold text-gray-400 ml-1">Số điện thoại</Label>
                                                        <Input
                                                            id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel" className="h-11 bg-[#0f172a] border-white/10 text-white"
                                                            value={profile.phone}
                                                            onChange={(e) =>
                                                                setProfile((p) => ({
                                                                    ...p,
                                                                    phone: e.target.value
                                                                }))
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">Mật khẩu</p>
                                                        <p className="text-xs text-gray-400">Nên đổi mật khẩu định kỳ để giữ tài khoản an toàn.</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => setIsPwdOpen(true)}
                                                        className="h-11 border-white/20 bg-transparent text-white hover:bg-white/10"
                                                    >
                                                        <Lock size={14} className="mr-2" />
                                                        Đổi mật khẩu
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-4 border-t border-white/5">
                                                <Button
                                                    onClick={handleSaveProfile}
 disabled={isSavingProfile}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-10 h-11 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                                                >
                                                    {isSavingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="history" className="mt-6 outline-none">
                                        {isLoadingTx ? (
                                            <div className="flex items-center gap-3 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-8 justify-center">
                                                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                                Đang tải lịch sử giao dịch...
                                            </div>
                                                                                ) : txError ? (
                                            <div className="text-center py-10 px-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-4">
                                                <div className="text-sm text-rose-200">Không tải được lịch sử giao dịch. Vui lòng kiểm tra kết nối và thử lại.</div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-11 border-white/20 bg-transparent text-white hover:bg-white/10"
                                                    onClick={() => setReloadKey((value) => value + 1)}
                                                >
                                                    Thử lại
                                                </Button>
                                            </div>
                                        ) : groups.length === 0 ? (
                                            <div className="text-center py-12 px-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                                                <div className="text-sm text-gray-300">Bạn chưa có giao dịch nào.</div>
                                                <Button asChild className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">
                                                    <Link href="/#promotions">Đặt vé ngay</Link>
                                                </Button>
                                                <div className="text-xs text-gray-400">
                                                    Đơn mua khi chưa đăng nhập không hiện ở đây. Mã vé của các đơn đó nằm trong email xác nhận.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-8">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-gray-400 italic">
                                                        * Chỉ hiển thị {limitedTransactions.length} giao dịch gần nhất
                                                        <br />* Các giao dịch chờ thanh toán sẽ tự động hết hạn sau 10 phút nếu chưa hoàn tất
                                                        <br />* Đơn mua khi chưa đăng nhập không hiện ở đây, mã vé nằm trong email xác nhận
                                                    </div>
                                                </div>

                                                {groups.map((g, idx) => (
                                                    <div key={idx} className="space-y-4">
                                                        {/* Nhãn tháng */}
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                                            <span className="text-sm text-blue-300 font-bold uppercase tracking-widest px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                                                                {g.month}
                                                            </span>
                                                            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                                        </div>

                                                        <div className="grid gap-4">
                                                            {g.items.map((t: any, i: number) => {
                                                                const movieCount = getMovieCountFromCombo(t.combo);
                                                                const isVietQR = t.method?.toLowerCase() === 'vietqr';
                                                                const isPaid = t.payment_status === 'paid';
                                                                const bookingCodeText = getBookingCode(t);
                                                                // An order waiting for payment counts its deadline down; at zero it can no longer be paid
                                                                const secondsLeft = !isPaid && t.payment_status === 'pending' ? secondsLeftToPay(t) : null;
                                                                const isLapsed = secondsLeft !== null && secondsLeft <= 0;
                                                                const isWaiting = !isPaid && t.payment_status === 'pending' && !isLapsed && !t.isExpired && !t.is_used;
                                                                const canPay = isWaiting && isVietQR;
                                                                const canCancel = isWaiting && Boolean(t.order_token);


                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="group relative w-full rounded-2xl bg-[#1e2536] border border-white/10 p-3.5 sm:p-5 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 overflow-hidden min-w-0 max-w-full"
                                                                    >
                                                                        {/* Thanh chỉ thị trạng thái mỏng ở cạnh trái */}
                                                                        {!isPaid && (
                                                                            <div className="absolute top-4 left-0 w-1 h-12 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                                                        )}

                                                                        <div className="flex flex-col md:flex-row justify-between gap-4 md:gap-6 min-w-0 max-w-full">
                                                                            <div className="flex-1 space-y-3 sm:space-y-4 min-w-0 max-w-full">
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                                        <h3 className="text-lg font-bold text-white uppercase">
                                                                                            {t.booking_type === 'vr' ? 'Trải nghiệm VR' : t.booking_type === 'combo_vr' ? 'Combo Phim + VR' : 'Gói vé phim'}
                                                                                        </h3>
                                                                                        {(() => {
                                                                                            const badge = bookingTypeBadge(t.booking_type, t.vr_items);
                                                                                            if (badge === 'Phim') return null;
                                                                                            return (
                                                                                                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase tracking-wider">
                                                                                                    {badge}
                                                                                                </span>
                                                                                            );
                                                                                        })()}
                                                                                        {Number(t.discount_amount) > 0 && (
                                                                                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase tracking-wider">
                                                                                                {t.voucher_code ? `${t.voucher_code} ` : ''}
                                                                                                −{formatMoney(t.discount_amount)} ₫
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-2 text-xs text-gray-400 min-w-0 max-w-full">
                                                                                        <span className="flex items-center gap-1.5 shrink-0 text-gray-400">
                                                                                            <Calendar size={12} />
                                                                                            {formatDateTime(t.created_at)}
                                                                                        </span>
                                                                                        {t.branch_name && (
                                                                                            <span className="flex items-center gap-1.5 text-gray-400">
                                                                                                <MapPin size={12} />
                                                                                                {t.branch_name}
                                                                                            </span>
                                                                                        )}
                                                                                        {(() => {
                                                                                            const moviePkgs = parseMoviePackages(t.ticket_package, {
                                                                                                quantity: t.quantity
                                                                                            });
                                                                                            const items: { name: string; qty: number; isVr?: boolean }[] = [];

                                                                                            if (moviePkgs.length > 0) {
                                                                                                moviePkgs.forEach((pkg: any) => {
                                                                                                    items.push({ name: pkg.name, qty: pkg.quantity });
                                                                                                });
                                                                                            } else if (t.ticket_package) {
                                                                                                items.push({ name: t.ticket_package, qty: t.quantity });
                                                                                            }

                                                                                            if (Array.isArray(t.vr_items) && t.vr_items.length > 0) {
                                                                                                t.vr_items.forEach((it: any) => {
                                                                                                    items.push({ name: it.package_name, qty: it.quantity, isVr: true });
                                                                                                });
                                                                                            } else if (t.booking_type === 'vr' && items.length === 0) {
                                                                                                items.push({ name: 'Trải nghiệm VR', qty: t.quantity, isVr: true });
                                                                                            }

                                                                                            if (items.length === 0) return null;

                                                                                            return (
                                                                                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                                                                    {items.map((item, idx) => (
                                                                                                        <span
                                                                                                            key={idx}
                                                                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                                                                                                item.isVr
                                                                                                                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                                                                                                    : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                                                                            }`}
                                                                                                        >
                                                                                                            <Ticket size={12} className="opacity-70 shrink-0" />
                                                                                                            <span>{item.name}</span>
                                                                                                            <span className="font-bold text-white/90 bg-white/10 px-1.5 py-0.5 rounded text-xs leading-none">
                                                                                                                x{item.qty}
                                                                                                            </span>
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            );
                                                                                        })()}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="space-y-3">
                                                                                    <div className="flex items-center gap-2 text-sm">
                                                                                        {t.is_used ? (
                                                                                            <span className="text-gray-500 font-medium flex items-center gap-2 px-2 py-1 bg-gray-500/5 rounded-lg border border-gray-500/10">
                                                                                                <CheckCircle2 size={14} /> Đã sử dụng
                                                                                            </span>
                                                                                        ) : t.isExpired ? (
                                                                                            <span className="text-rose-400 font-medium flex items-center gap-2 px-2 py-1 bg-rose-400/5 rounded-lg border border-rose-400/20">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                                                                Đã hết hạn
                                                                                            </span>
                                                                                        ) : isPaid ? (
                                                                                            <span
                                                                                                className="text-emerald-400 font-medium flex items-center gap-2 px-2 py-1 bg-emerald-400/5 rounded-lg border border-emerald-400/20 cursor-help"
                                                                                                title={t.expiry_date ? `Hết hạn: ${formatDateTime(t.expiry_date)}` : ''}
                                                                                            >
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                                                Sẵn sàng sử dụng {t.remainingTimeLabel}
                                                                                            </span>
                                                                                        ) : t.payment_status === 'expired' ? (
                                                                                            <span className="text-slate-400 font-medium flex items-center gap-2 px-2 py-1 bg-slate-400/5 rounded-lg border border-slate-400/20">
                                                                                                <Clock size={14} /> Hết hạn thanh toán
                                                                                            </span>
                                                                                        ) : t.payment_status === 'failed' || t.payment_status === 'cancelled' ? (
                                                                                            <span className="text-rose-400 font-medium flex items-center gap-2 px-2 py-1 bg-rose-400/5 rounded-lg border border-rose-400/20">
                                                                                                <XCircle size={14} /> Đã hủy thanh toán
                                                                                            </span>
                                                                                        ) : isLapsed ? (
                                                                                            <span className="text-slate-400 font-medium flex items-center gap-2 px-2 py-1 bg-slate-400/5 rounded-lg border border-slate-400/20">
                                                                                                <Clock size={14} /> Hết hạn thanh toán
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span
                                                                                                className={`px-2 py-1 rounded-lg border flex items-center gap-2 font-medium ${isVietQR
                                                                                                        ? 'text-blue-400 bg-blue-400/5 border-blue-400/20'
                                                                                                        : 'text-amber-500 bg-amber-500/5 border-amber-500/20'
                                                                                                    }`}
                                                                                            >
                                                                                                <Clock size={14} />
                                                                                                {secondsLeft !== null
                                                                                                    ? `Chờ thanh toán · còn ${formatCountdown(secondsLeft)}`
                                                                                                    : isVietQR
                                                                                                        ? 'Đang chờ xác nhận...'
                                                                                                        : 'Chờ thanh toán'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    {isPaid && bookingCodeText !== '--' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleCopy(bookingCodeText)}
                                                                                            aria-label={`Sao chép mã đặt vé ${bookingCodeText}`}
                                                                                            className={`inline-flex items-center gap-3 min-h-[44px] rounded-xl bg-black/20 border border-white/10 px-4 text-left hover:border-blue-500/30 hover:bg-black/40 transition-all ${t.is_used || t.isExpired ? 'opacity-60' : ''}`}
                                                                                        >
                                                                                            <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Mã đặt vé</span>
                                                                                            <span className="text-base font-mono font-bold tracking-[0.15em] text-white">{bookingCodeText}</span>
                                                                                            <Copy size={16} className="text-gray-500" />
                                                                                        </button>
                                                                                    )}

                                                                                    {isVietQR && !isPaid && t.pay_txt_code && (
                                                                                        <div
                                                                                            onClick={() => handleCopy(t.pay_txt_code)}
                                                                                            className="flex items-center justify-between max-w-[300px] bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 cursor-pointer hover:border-blue-500/30 hover:bg-black/40 transition-all group/copy"
                                                                                        >
                                                                                            <div className="flex flex-col">
                                                                                                <span className="text-xs text-gray-500 uppercase font-black tracking-tighter">
                                                                                                    Nội dung chuyển khoản
                                                                                                </span>
                                                                                                <span className="text-sm font-mono font-bold text-blue-300 tracking-[0.2em]">
                                                                                                    {t.pay_txt_code}
                                                                                                </span>
                                                                                            </div>
                                                                                            <Copy
                                                                                                size={16}
                                                                                                className="text-gray-600 group-hover/copy:text-blue-300 transition-colors"
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end justify-between md:justify-center gap-3.5 sm:gap-4 md:min-w-[160px] border-t md:border-t-0 md:border-l border-white/5 pt-3.5 sm:pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                                                                                <div className="flex sm:flex-col justify-between items-baseline sm:items-end w-full sm:w-auto">
                                                                                    <div className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                                                                                        {formatMoney(t.amount)}
                                                                                        <span className="text-sm ml-1 text-gray-400 font-normal">₫</span>
                                                                                    </div>
                                                                                    <div className="flex flex-col items-end">
                                                                                        {Number(t.discount_amount) > 0 && (
                                                                                            <div className="text-xs text-emerald-400/80 font-medium mt-0.5 line-through opacity-70">
                                                                                                {formatMoney(t.original_amount)} ₫
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex flex-col gap-2 w-full sm:w-auto">
{canPay || canCancel ? (
                                                                                        <>
                                                                                            {canPay && (
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    className="w-full sm:w-auto bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/20 h-11 px-6 sm:px-8 rounded-xl font-bold transition-all active:scale-95"
                                                                                                    onClick={() => handleContinuePayment(t)}
                                                                                                >
                                                                                                    Thanh toán ngay
                                                                                                </Button>
                                                                                            )}
                                                                                            {canCancel && (
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="w-full sm:w-auto h-11 px-6 sm:px-8 rounded-xl font-bold border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white"
                                                                                                    onClick={() => setCancelTarget(t)}
                                                                                                >
                                                                                                    Hủy đơn
                                                                                                </Button>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 h-11 px-6 sm:px-8 rounded-xl font-bold transition-all active:scale-95"
                                                                                            onClick={() => {
                                                                                                setSelectedTx(t);
                                                                                                setIsDetailOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            {isPaid ? 'Xem vé' : 'Xem chi tiết'}
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}

                                                {totalPages > 1 && (
                                                    <div className="mt-8">
                                                        <Pagination>
                                                            <PaginationContent>
                                                                <PaginationItem>
                                                                    <PaginationPrevious
                                                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                                        className={
                                                                            currentPage === 1
                                                                                ? 'pointer-events-none opacity-50 text-gray-500'
                                                                                : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10'
                                                                        }
                                                                    />
                                                                </PaginationItem>

                                                                {Array.from({ length: totalPages }).map((_, i) => (
                                                                    <PaginationItem key={i}>
                                                                        <PaginationLink
                                                                            isActive={currentPage === i + 1}
                                                                            onClick={() => setCurrentPage(i + 1)}
                                                                            className={
                                                                                currentPage === i + 1
                                                                                    ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 hover:text-white hover:border-blue-400'
                                                                                    : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
                                                                            }
                                                                        >
                                                                            {i + 1}
                                                                        </PaginationLink>
                                                                    </PaginationItem>
                                                                ))}

                                                                <PaginationItem>
                                                                    <PaginationNext
                                                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                                        className={
                                                                            currentPage === totalPages
                                                                                ? 'pointer-events-none opacity-50 text-gray-500'
                                                                                : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10'
                                                                        }
                                                                    />
                                                                </PaginationItem>
                                                            </PaginationContent>
                                                        </Pagination>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                                <AlertDialog
                    open={Boolean(cancelTarget)}
                    onOpenChange={(open) => {
                        if (!open && !isCancelling) setCancelTarget(null);
                    }}
                >
                    <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-[400px]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-bold text-white text-center">Hủy đơn này?</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-300 text-center">
                                Đơn đang chờ thanh toán sẽ bị hủy và bạn cần đặt lại.
                                <span className="block mt-2 text-amber-300">
                                    Nếu bạn vừa chuyển khoản, hãy chọn "Giữ đơn" và chờ xác nhận.
                                </span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                disabled={isCancelling}
                                className="h-11 bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                            >
                                Giữ đơn
                            </AlertDialogCancel>
                            <AlertDialogAction
                                disabled={isCancelling}
                                onClick={(event) => {
                                    event.preventDefault();
                                    handleCancelOrder();
                                }}
                                className="h-11 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isCancelling ? 'Đang hủy...' : 'Hủy đơn'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <ChangePasswordDialog open={isPwdOpen} onOpenChange={setIsPwdOpen} email={profile.email} />

                <TicketDetailDialog open={isDetailOpen} onOpenChange={setIsDetailOpen} tx={selectedTx} onCopy={handleCopy} />
            </UserLayout>
        </ProtectedRoute>
    );
}
