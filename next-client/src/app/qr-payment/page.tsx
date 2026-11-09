'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ChevronRight,
    Copy,
    RefreshCcw,
    ArrowLeft,
    Check,
    QrCode,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import UserLayout from '@/layouts/UserLayout';
import { buildUrl } from '@/lib/api/http';
import { fetchBookingStatus, cancelBookingByToken } from '@/lib/api/booking';
import {
    isValidPayCode,
    localDeadlineMs,
    secondsLeft,
    classifyPaymentStatus,
    nextPollDelayMs
} from '@/lib/payment-flow';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    parseMoviePackages,
    parseApplicableIds,
    isLineDiscounted,
    moviePackagesTotalQty,
    moviePackageLineTotal,
    vrLineTotal,
    vrPackageId,
    buildPriceBreakdown
} from '@shared/booking-invoice';

/** The bank account a payment goes to, taken from the branch's own configuration. */
interface BankInfo {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankCode: string;
    qrCodeUrl: string;
}

const EMPTY_BANK_INFO: BankInfo = { bankName: '', accountNumber: '', accountName: '', bankCode: '', qrCodeUrl: '' };

const BANK_NAME_TO_CODE: { [key: string]: string } = {
    'MB Bank': 'MB',
    MB: 'MB',
    Vietcombank: 'VCB',
    VCB: 'VCB',
    BIDV: 'BIDV',
    Vietinbank: 'CTG',
    VietinBank: 'CTG',
    Techcombank: 'TCB',
    TCB: 'TCB',
    ACB: 'ACB',
    Sacombank: 'STB',
    OCB: 'OCB',
    VPBank: 'VPB',
    TPBank: 'TPB',
    HDBank: 'HDB'
};

/**
 * Reads the bank account out of a branch's settings. Returns null unless the account is complete (bank, number and
 * holder), or the branch supplies its own QR image. There is deliberately no built-in fallback account: a QR that
 * sends money to the wrong account is worse than no QR.
 */
function extractBankInfoFromSettings(settingsStrOrObj: any): BankInfo | null {
    if (!settingsStrOrObj) return null;
    try {
        const settings = typeof settingsStrOrObj === 'string' ? JSON.parse(settingsStrOrObj) : settingsStrOrObj;
        const pc = settings?.payment_config;
        if (!pc) return null;

        const bankName = (pc.bank_name || '').trim();
        const bankCode = (pc.bank_code || BANK_NAME_TO_CODE[bankName] || '').toUpperCase().trim();
        const accountNumber = (pc.account_number || '').trim();
        const accountName = (pc.account_name || '').trim();
        const qrCodeUrl = (pc.qr_code_url || '').trim();

        if (qrCodeUrl || (bankCode && accountNumber && accountName)) {
            return { bankName: bankName || bankCode, bankCode, accountNumber, accountName, qrCodeUrl };
        }
    } catch (e) {
        console.error('Error parsing branch payment config:', e);
    }
    return null;
}

function buildQrUrl(data: any, bank: BankInfo): string {
    if (bank.qrCodeUrl) return bank.qrCodeUrl;
    const amount = data?.totalAmount || data?.amount || 0;
    // The transfer content is the payment reference the server gave this order. The SePay webhook matches on it.
    const description = `${data?.pay_txt_code} `;
    return `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(bank.accountName)}`;
}

/** The branch's bank account: from the order data saved in this browser, or else from the branch's public page. */
async function resolveBankInfo(data: any): Promise<BankInfo | null> {
    const fromOrder = extractBankInfoFromSettings(data?.branch_settings);
    if (fromOrder) return fromOrder;
    if (!data?.branch_id) return null;
    try {
        const res = await fetch(buildUrl(`/api/branches/${data.branch_id}`), { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        return extractBankInfoFromSettings(json?.branch?.settings);
    } catch {
        return null;
    }
}

export default function QRPaymentPage() {
    const router = useRouter();
    const [paymentData, setPaymentData] = useState<any>(null);
    // The page no longer downloads the order from the server. What it shows was saved in this browser when the order
    // was placed. The server only hands out the payment status, to whoever holds the order token.
    const bookingDetails: any = null;
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isChecking, setIsChecking] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(true);
    const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
    const [showExpiredDialog, setShowExpiredDialog] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    // 'expired' = the 10 minutes ran out. 'closed' = the server says the order was cancelled or expired.
    const [closedReason, setClosedReason] = useState<'expired' | 'closed'>('expired');
    const [bankConfigMissing, setBankConfigMissing] = useState(false);
    const [bankInfo, setBankInfo] = useState<BankInfo>(EMPTY_BANK_INFO);

    const paymentDataRef = useRef<any>(null);
    // Set when the payment is over (paid, cancelled, expired): the countdown and the status checks stop.
    const finishedRef = useRef(false);
    const expiredHandledRef = useRef(false);

    // Prefetch trang đích để tránh lag sau khi thanh toán xong
    useEffect(() => {
        router.prefetch('/success-payment');
        router.prefetch('/checkout');
        router.prefetch('/');
    }, [router]);

    const clearPaymentStorage = () => {
        localStorage.removeItem('qrPaymentData');
        localStorage.removeItem('qrPaymentEndTime');
    };

    const orderIdentity = () => {
        const data = paymentDataRef.current;
        return {
            data,
            bookingId: Number(data?.bookingId || data?.booking_id) || 0,
            orderToken: String(data?.order_token || '')
        };
    };

    /** Takes the customer to the success page. Callers make sure it runs only once. */
    const goToSuccess = () => {
        const data = paymentDataRef.current;
        if (data) {
            localStorage.setItem(
                'lastCheckoutOrder',
                JSON.stringify({
                    ...data,
                    payment_status: 'paid',
                    paidAt: new Date().toISOString()
                })
            );
        }
        localStorage.removeItem('pendingOrder');
        clearPaymentStorage();
        toast.success('Thanh toán thành công!');
        router.replace('/success-payment');
    };

    const handleSuccess = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        goToSuccess();
    };

    /** The server says the order can no longer be paid (cancelled, failed or expired). */
    const handleClosed = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        clearPaymentStorage();
        setClosedReason('closed');
        setShowExpiredDialog(true);
    };

    /** The countdown reached zero. Runs once: it cancels the unpaid order, or finds out that it was paid after all. */
    const handleExpired = async () => {
        if (expiredHandledRef.current || finishedRef.current) return;
        expiredHandledRef.current = true;
        finishedRef.current = true;

        const { bookingId, orderToken } = orderIdentity();
        if (bookingId && orderToken) {
            const { httpStatus } = await cancelBookingByToken(bookingId, orderToken);
            // 409: the order was paid just before the deadline
            if (httpStatus === 409) {
                goToSuccess();
                return;
            }
        }

        clearPaymentStorage();
        setClosedReason('expired');
        setShowExpiredDialog(true);
    };

    useEffect(() => {
        let isCancelled = false;
        let timerId: ReturnType<typeof setInterval> | undefined;

        let data: any = null;
        try {
            const saved = localStorage.getItem('qrPaymentData');
            data = saved ? JSON.parse(saved) : null;
        } catch {
            data = null;
        }

        if (!data) {
            router.replace('/booking');
            return;
        }

        // An order needs its payment reference and its order token. Without them the page cannot build a correct
        // transfer or read the payment status, so it asks the customer to start again.
        const payCode = data.pay_txt_code || data.orderId;
        const bookingId = data.bookingId || data.booking_id;
        const storedEnd = Number(localStorage.getItem('qrPaymentEndTime'));
        const deadlineMs =
            Number.isFinite(storedEnd) && storedEnd > 0
                ? storedEnd
                : localDeadlineMs(data.payment_expires_at, Number(data.server_clock_offset_ms) || 0);

        if (!bookingId || !data.order_token || !isValidPayCode(payCode) || !deadlineMs) {
            clearPaymentStorage();
            toast.error('Phiên thanh toán không còn hợp lệ. Vui lòng đặt vé lại.');
            router.replace('/booking');
            return;
        }
        localStorage.setItem('qrPaymentEndTime', String(deadlineMs));

        const order = { ...data, pay_txt_code: payCode, orderId: payCode };
        setPaymentData(order);
        paymentDataRef.current = order;

        resolveBankInfo(order).then((bank) => {
            if (isCancelled) return;
            if (bank) {
                setBankInfo(bank);
                setQrCodeUrl(buildQrUrl(order, bank));
            } else {
                setBankConfigMissing(true);
            }
            setIsLoadingDetails(false);
        });

        const updateTimer = () => {
            const remaining = secondsLeft(deadlineMs);
            setTimeLeft(remaining);
            if (remaining <= 0) {
                if (timerId) clearInterval(timerId);
                handleExpired();
            }
        };

        updateTimer(); // Initial call
        timerId = setInterval(updateTimer, 1000);

        return () => {
            isCancelled = true;
            if (timerId) clearInterval(timerId);
        };
    }, [router]);

    // --- Auto polling: ask the server for the payment status until the payment is over ---
    useEffect(() => {
        const bookingId = Number(paymentData?.bookingId || paymentData?.booking_id) || 0;
        const orderToken = String(paymentData?.order_token || '');
        if (!bookingId || !orderToken) return;

        let isCancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let consecutiveFailures = 0;

        const schedule = (delayMs: number) => {
            if (!isCancelled && !finishedRef.current) timeoutId = setTimeout(checkStatus, delayMs);
        };

        async function checkStatus() {
            if (isCancelled || finishedRef.current) return;

            // No checks while the tab is hidden. The visibility handler below checks again as soon as it is shown.
            if (typeof document !== 'undefined' && document.hidden) {
                schedule(nextPollDelayMs(0));
                return;
            }

            const result = await fetchBookingStatus(bookingId, orderToken);
            if (isCancelled || finishedRef.current) return;

            if (result.ok) {
                consecutiveFailures = 0;
                const outcome = classifyPaymentStatus(result.data.payment_status);
                if (outcome === 'paid') {
                    handleSuccess();
                    return;
                }
                if (outcome === 'closed') {
                    handleClosed();
                    return;
                }
            } else if (result.httpStatus === 404) {
                // The token no longer matches an order: there is nothing left to wait for
                handleClosed();
                return;
            } else {
                consecutiveFailures += 1;
                if (consecutiveFailures === 3) {
                    toast.warning('Mất kết nối tới máy chủ. Đang thử lại...', { id: 'qr-offline' });
                }
            }

            schedule(nextPollDelayMs(consecutiveFailures));
        }

        const onVisibilityChange = () => {
            if (!document.hidden && !finishedRef.current) {
                if (timeoutId) clearTimeout(timeoutId);
                checkStatus();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        checkStatus();

        return () => {
            isCancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [paymentData]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedText(text);

            toast.success(`Đã sao chép ${label}`, {
                description: text,
                className: 'bg-[#0f172a] border-white/10 text-white',
                descriptionClassName: 'text-gray-400'
            });

            setTimeout(() => setCopiedText(null), 2000);
        } catch (err) {
            toast.error('Lỗi sao chép dữ liệu');
        }
    };

    const handleCheckPayment = async () => {
        const { bookingId, orderToken } = orderIdentity();
        if (!bookingId || !orderToken) {
            toast.error('Không tìm thấy thông tin đơn hàng');
            return;
        }

        setIsChecking(true);
        const result = await fetchBookingStatus(bookingId, orderToken);
        setIsChecking(false);

        if (!result.ok) {
            toast.error(
                result.httpStatus === 404 ? 'Không tìm thấy đơn hàng' : 'Lỗi kết nối, vui lòng thử lại'
            );
            return;
        }

        const outcome = classifyPaymentStatus(result.data.payment_status);
        if (outcome === 'paid') {
            handleSuccess();
        } else if (outcome === 'closed') {
            handleClosed();
        } else {
            setShowUnpaidDialog(true);
        }
    };

    const openCancelDialog = () => {
        setShowCancelDialog(true);
    };

    const performCancelPayment = async () => {
        const { bookingId, orderToken } = orderIdentity();
        // Stop counting and checking: the customer chose to leave
        finishedRef.current = true;

        let httpStatus: number | null = 200;
        if (bookingId && orderToken) {
            ({ httpStatus } = await cancelBookingByToken(bookingId, orderToken));
        }

        // 409: it was paid after all
        if (httpStatus === 409) {
            toast.success('Giao dịch đã được thanh toán thành công!');
            goToSuccess();
            return;
        }

        clearPaymentStorage();
        if (httpStatus === null) {
            toast.info('Chưa kết nối được máy chủ để hủy đơn. Đơn sẽ tự hết hạn sau ít phút.');
        } else {
            toast.info('Đã hủy giao dịch thành công');
        }
        router.replace('/booking');
    };

    // The branch has no complete bank account: do not show a QR that could send money to the wrong place
    if (bankConfigMissing) {
        return (
            <UserLayout className="bg-[#0f172a]" hideFooter>
                <div className="relative min-h-screen">
                    <div className="relative z-10 max-w-md mx-auto px-4 pt-40 text-center text-white space-y-5">
                        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
                        <h1 className="text-xl font-bold">Chưa thể thanh toán chuyển khoản</h1>
                        <p className="text-gray-300 leading-relaxed">
                            Chi nhánh này chưa cấu hình tài khoản nhận tiền nên hệ thống không tạo mã QR để tránh chuyển nhầm.
                            Vui lòng liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span>.
                        </p>
                        <Button onClick={performCancelPayment} className="bg-red-600 hover:bg-red-500 text-white">
                            Hủy đơn và quay lại
                        </Button>
                    </div>
                </div>
            </UserLayout>
        );
    }

    return (
        <UserLayout className="bg-[#0f172a]" hideFooter>
            <div className="relative min-h-screen pb-28 sm:pb-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 pt-28 sm:pt-36">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-1">
                        <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold">
                            <span className="hover:text-blue-400 cursor-pointer transition-colors" onClick={() => router.push('/')}>
                                Trang chủ
                            </span>
                            <span className="text-white/10 text-[10px]">&gt;</span>
                            <span className="text-blue-400 font-black">Thanh toán QR</span>
                        </div>
                    </div>

                    {/* Countdown Display */}
                    <div className="sticky top-[85px] lg:top-[115px] z-50 mb-6 -mx-1 px-1">
                        <div className="flex items-center justify-between gap-3 bg-[#0f172a]/90 backdrop-blur-xl border border-white/15 px-4 md:px-6 py-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center relative">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                </div>
                                <span className="text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    Hết hạn sau
                                </span>
                            </div>

                            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-xl border border-red-500/20">
                                <span className="font-mono text-red-500 text-lg md:text-xl font-black tracking-tighter tabular-nums drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                        {/* CỘT TRÁI: MÃ QR */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="bg-white/10 border-white/15 text-white overflow-hidden shadow-2xl rounded-2xl">
                                <CardHeader className="bg-white/5 border-b border-white/5 py-4">
                                    <CardTitle className="text-base font-bold flex items-center gap-2 uppercase tracking-wide">
                                        <QrCode className="w-4 h-4 text-blue-400" />
                                        Quét mã VietQR
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 pb-6 px-5">
                                    <div className="bg-white p-3 rounded-2xl mb-5 shadow-[0_0_40px_rgba(255,255,255,0.05)] border-4 border-white/10">
                                        {qrCodeUrl ? (
                                            <img src={qrCodeUrl} alt="QR" className="w-full h-auto rounded-lg" />
                                        ) : (
                                            <div className="aspect-square bg-gray-800 animate-pulse rounded-lg" />
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-center text-[13px] text-gray-400 leading-relaxed font-medium"></p>
                                        <div className="flex items-center justify-center gap-2.5 text-[11px] text-amber-200/90 bg-amber-500/10 py-3 px-4 rounded-xl border border-amber-500/20 shadow-sm">
                                            <Info className="w-4 h-4 text-amber-400 shrink-0" />
                                            <span className="font-bold tracking-tight">
                                                Vui lòng giữ nguyên nội dung chuyển khoản mặc định.
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* REASSURING PAYMENT STEPS */}
                            <div className="bg-gradient-to-br from-blue-500/10 to-emerald-500/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="p-4 space-y-4">
                                    <div className="flex gap-4 items-start">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 font-black text-sm">
                                            1
                                        </div>
                                        <div className="text-[13px] text-gray-300 leading-relaxed pt-1">
                                            <strong className="text-white">Thanh toán tự động:</strong> Hệ thống sẽ xác nhận và gửi vé ngay
                                            khi nhận được tiền.
                                        </div>
                                    </div>

                                    <div className="flex gap-4 items-start relative">
                                        <div className="absolute left-4 -top-3 w-[1px] h-3 bg-white/10" />
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 font-black text-sm">
                                            2
                                        </div>
                                        <div className="text-[13px] text-gray-300 leading-relaxed pt-1">
                                            <strong className="text-white">Ưu tiên xử lý:</strong> Nếu muốn nhận vé nhanh hơn, hãy ấn nút{' '}
                                            <span className="text-emerald-400 font-bold">"Xác nhận chuyển"</span> bên dưới.
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/5 px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-gray-500 font-medium">Hỗ trợ 24/7:</span>
                                        <span className="text-[11px] text-blue-400 font-black tracking-tight">036 643 1179</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Sẵn sàng</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CỘT PHẢI: CHI TIẾT & HÀNH ĐỘNG */}
                        <div className="lg:col-span-3 space-y-6">
                            {/* Accordion Container */}
                            <div className="bg-white/10 border border-white/15 rounded-2xl overflow-hidden shadow-xl">
                                <Accordion type="multiple" defaultValue={['item-1']} className="w-full">
                                    {/* 1. THÔNG TIN VÉ */}
                                    <AccordionItem value="item-1" className="border-white/10 px-4">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black uppercase tracking-wider text-emerald-400">
                                                    Thông tin vé
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-5 space-y-4">
                                            {isLoadingDetails ? (
                                                <div className="py-8 flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                                                    <p className="text-sm font-medium text-gray-400">Đang đồng bộ dữ liệu hóa đơn...</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-5">
                                                    {(() => {
                                                        const discountAmount = bookingDetails ? (bookingDetails.voucher_discount_amount || 0) : (paymentData?.voucher_discount_amount || 0);
                                                        const voucherScope = bookingDetails?.voucherDetails?.scope || bookingDetails?.voucher_details?.scope || paymentData?.voucherScope || paymentData?.voucher_details?.scope || 'all';
                                                        const applicableIds = parseApplicableIds(
                                                            bookingDetails?.voucherDetails?.applicable_ids || bookingDetails?.voucher_details?.applicable_ids || paymentData?.voucherDetails?.applicable_ids || paymentData?.voucher_details?.applicable_ids
                                                        );

                                                        const bType = bookingDetails?.booking_type || paymentData?.bookingType || paymentData?.booking_type || '';
                                                        const titleRaw = bookingDetails?.movie_title || paymentData?.movieTitle || '';
                                                        const isVROnly = bType === 'vr' || titleRaw === 'Gói Trải Nghiệm VR' || String(paymentData?.ticketType || '').startsWith('VR Booking');

                                                        const raw = bookingDetails?.ticket_package_name || paymentData?.ticketType || 'Vé xem phim';
                                                        const moviePkgs = parseMoviePackages(raw, {
                                                            quantity: bookingDetails?.ticket_count || paymentData?.ticketCount || 1,
                                                            price: Math.round((paymentData?.totalAmount || 0) / (bookingDetails?.ticket_count || paymentData?.ticketCount || 1))
                                                        });
                                                        const totalQty = moviePackagesTotalQty(moviePkgs);
                                                        const vrItems = bookingDetails?.vr_items || paymentData?.vr_items || [];

                                                        return (
                                                            <>
                                                                {/* Danh sách Gói Vé (Phim) - Chỉ hiện nếu KHÔNG PHẢI chỉ đặt VR */}
                                                                {!isVROnly && moviePkgs.length > 0 && (
                                                                    <div className="space-y-4 rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                                                                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                                                            <div className="text-[11px] text-gray-400 font-black uppercase tracking-widest">
                                                                                Chi tiết gói vé
                                                                            </div>
                                                                            <div className="text-[11px] text-white font-bold bg-white/10 px-2 py-0.5 rounded-full">
                                                                                {totalQty} VÉ
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                            {moviePkgs.map((pkg, idx) => {
                                                                                const isDiscounted = isLineDiscounted({
                                                                                    discountAmount,
                                                                                    scope: voucherScope,
                                                                                    applicableIds,
                                                                                    kind: 'movie',
                                                                                    packageId: pkg.package_id
                                                                                });
                                                                                return (
                                                                                    <div key={idx} className="flex justify-between items-center">
                                                                                        <div className="flex items-start gap-2 max-w-[65%]">
                                                                                            <span className="text-blue-400 mt-[3px] text-[10px]">●</span>
                                                                                            <span className="text-sm font-bold text-gray-200 leading-tight">
                                                                                                {pkg.name}
                                                                                                {isDiscounted ? <span className="inline-block ml-2 px-1.5 py-[2px] align-middle text-[8px] font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded shadow-sm">ĐƯỢC GIẢM</span> : null}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-4 text-right">
                                                                                            <span className="text-xs font-semibold text-gray-500">
                                                                                                x{pkg.quantity}
                                                                                            </span>
                                                                                            <span className="text-sm font-black text-white whitespace-nowrap tabular-nums">
                                                                                                {moviePackageLineTotal(pkg).toLocaleString('vi-VN')}₫
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Danh sách gói VR nếu có */}
                                                                {vrItems.length > 0 && (
                                                                    <div className="space-y-2 p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-inner">
                                                                        <div className="text-[11px] text-purple-300 font-black uppercase tracking-widest flex items-center justify-between">
                                                                            <span>Gói trải nghiệm VR</span>
                                                                            <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded">
                                                                                {vrItems.length} gói
                                                                            </span>
                                                                        </div>
                                                                        <div className="space-y-2 pt-1">
                                                                            {vrItems.map((it: any, idx: number) => {
                                                                                const lineTotal = vrLineTotal(it);
                                                                                const isDiscounted = isLineDiscounted({
                                                                                    discountAmount,
                                                                                    scope: voucherScope,
                                                                                    applicableIds,
                                                                                    kind: 'vr',
                                                                                    packageId: vrPackageId(it)
                                                                                });
                                                                                
                                                                                return (
                                                                                    <div key={idx} className="flex justify-between items-center text-[13px]">
                                                                                        <div className="flex items-center flex-wrap gap-2 max-w-[65%]">
                                                                                            <span className="text-purple-400 font-bold">•</span>
                                                                                            <span className="text-white font-medium">
                                                                                                {it.name || it.package_name || 'Gói VR'}
                                                                                            </span>
                                                                                            {it.duration_min && (
                                                                                                <span className="text-[11px] text-gray-400">({it.duration_min}')</span>
                                                                                            )}
                                                                                            {isDiscounted ? <span className="inline-block px-1.5 py-[2px] align-middle text-[8px] font-black text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded shadow-sm">ĐƯỢC GIẢM</span> : null}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 text-right shrink-0">
                                                                                            <span className="text-gray-400 text-xs">x{it.quantity}</span>
                                                                                            {lineTotal > 0 && (
                                                                                                <span className="text-purple-300 font-bold">
                                                                                                    {lineTotal.toLocaleString('vi-VN')}₫
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}

                                                    {/* Tổng thanh toán Breakdown */}
                                                    {(() => {
                                                        const vrList = bookingDetails?.vr_items || paymentData?.vr_items || [];
                                                        const baseAmount = bookingDetails ? (bookingDetails.original_total_price || 0) : (paymentData?.totalAmount + (paymentData?.voucher_discount_amount || 0) || 0);
                                                        const discountAmount = bookingDetails ? (bookingDetails.voucher_discount_amount || 0) : (paymentData?.voucher_discount_amount || 0);
                                                        const finalTotal = bookingDetails ? (bookingDetails.total_price || 0) : (paymentData?.totalAmount || 0);
                                                        const voucherScope = bookingDetails?.voucherDetails?.scope || bookingDetails?.voucher_details?.scope || paymentData?.voucherScope || paymentData?.voucher_details?.scope || 'all';
                                                        const breakdown = buildPriceBreakdown({
                                                            originalTotal: baseAmount,
                                                            vrItems: vrList,
                                                            discountAmount,
                                                            scope: voucherScope
                                                        });
                                                        const { movieSubtotal: calculatedMovieTotal, vrSubtotal: calculatedVrTotal, voucherLabel: voucherText } = breakdown;
                                                        const voucherDesc = bookingDetails?.voucherDetails?.description || bookingDetails?.voucher_details?.description || paymentData?.voucherDetails?.description || paymentData?.voucher_details?.description || '';

                                                        return (
                                                            <div className="px-3 pt-6 pb-2 border-t border-white/10 space-y-4">
                                                                <div className="space-y-4">
                                                                    {calculatedMovieTotal > 0 && (
                                                                        <div>
                                                                            <div className="flex justify-between items-center text-[13px]">
                                                                                <span className="text-gray-400 font-medium">Tiền gói vé phim:</span>
                                                                                <span className="text-gray-200 font-bold tabular-nums">
                                                                                    {calculatedMovieTotal.toLocaleString('vi-VN')} ₫
                                                                                </span>
                                                                            </div>
                                                                            {discountAmount > 0 && voucherScope === 'movie' && (
                                                                                <div className="flex justify-between items-start text-[13px] mt-1.5 pl-3 border-l-[3px] border-blue-500/30">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-gray-400 font-medium flex items-center gap-1.5">
                                                                                            Mã giảm giá
                                                                                            <span className="text-[9px] font-bold bg-blue-500/20 text-blue-300 px-1.5 rounded uppercase uppercase">Phim</span>
                                                                                        </span>
                                                                                        {voucherDesc && (
                                                                                            <span className="text-[10px] text-emerald-400/90 whitespace-pre-line leading-relaxed max-w-[200px] mt-1">{voucherDesc}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-rose-400 font-bold tabular-nums whitespace-nowrap mt-0.5">
                                                                                        - {discountAmount.toLocaleString('vi-VN')} ₫
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {calculatedVrTotal > 0 && (
                                                                        <div>
                                                                            <div className="flex justify-between items-center text-[13px]">
                                                                                <span className="text-gray-400 font-medium">Tiền gói VR:</span>
                                                                                <span className="text-gray-200 font-bold tabular-nums">
                                                                                    {calculatedVrTotal.toLocaleString('vi-VN')} ₫
                                                                                </span>
                                                                            </div>
                                                                            {discountAmount > 0 && voucherScope === 'vr' && (
                                                                                <div className="flex justify-between items-start text-[13px] mt-1.5 pl-3 border-l-[3px] border-purple-500/30">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-gray-400 font-medium flex items-center gap-1.5">
                                                                                            Mã giảm giá
                                                                                            <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 px-1.5 rounded uppercase">VR</span>
                                                                                        </span>
                                                                                        {voucherDesc && (
                                                                                            <span className="text-[10px] text-emerald-400/90 whitespace-pre-line leading-relaxed max-w-[200px] mt-1">{voucherDesc}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <span className="text-rose-400 font-bold tabular-nums whitespace-nowrap mt-0.5">
                                                                                        - {discountAmount.toLocaleString('vi-VN')} ₫
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {discountAmount > 0 && voucherScope === 'all' && (
                                                                        <div className="flex justify-between items-start text-[13px] pt-1">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                                                                                    Mã giảm giá
                                                                                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 rounded uppercase">{voucherText.replace('Giảm giá ', '').replace('(', '').replace(')', '')}</span>
                                                                                </span>
                                                                                {voucherDesc && (
                                                                                    <span className="text-[10px] text-emerald-400/90 whitespace-pre-line leading-relaxed max-w-[200px] mt-1">{voucherDesc}</span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-rose-400 font-bold tabular-nums whitespace-nowrap mt-0.5">
                                                                                - {discountAmount.toLocaleString('vi-VN')} ₫
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex justify-between items-center pt-3 border-t border-white/5 border-dashed">
                                                                    <span className="text-gray-300 font-black uppercase tracking-widest text-sm">Tổng cộng:</span>
                                                                    <span className="text-emerald-400 font-black text-2xl tracking-tighter tabular-nums drop-shadow-sm">
                                                                        {finalTotal.toLocaleString('vi-VN')} <span className="text-lg">₫</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Danh sách phim trong gói -> Chuyển thành ghi chú (Chỉ hiện khi có đặt phim) */}
                                                    {(() => {
                                                        const bType = bookingDetails?.booking_type || paymentData?.bookingType || paymentData?.booking_type || '';
                                                        const titleRaw = bookingDetails?.movie_title || paymentData?.movieTitle || '';
                                                        const isVROnly = bType === 'vr' || titleRaw === 'Gói Trải Nghiệm VR' || paymentData?.ticketType === 'VR Booking (1 gói)';
                                                        
                                                        if (isVROnly || !titleRaw || titleRaw.toLowerCase().includes('gói trải nghiệm vr')) {
                                                            return null;
                                                        }

                                                        const renderTitle = (title: string, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-1.5 text-center">
                                                                <span className="text-cyan-500/50">•</span>
                                                                <span>{title.trim()}</span>
                                                            </div>
                                                        );

                                                        let titlesElement = null;
                                                        try {
                                                            if (titleRaw.startsWith('[')) {
                                                                const parsed = JSON.parse(titleRaw);
                                                                if (Array.isArray(parsed) && parsed.length > 0) {
                                                                    titlesElement = parsed.map(renderTitle);
                                                                }
                                                            } else if (titleRaw.includes(' & ')) {
                                                                titlesElement = titleRaw.split(' & ').map(renderTitle);
                                                            } else {
                                                                titlesElement = renderTitle(titleRaw, 0);
                                                            }
                                                        } catch {
                                                            titlesElement = <span>{titleRaw}</span>;
                                                        }

                                                        if (!titlesElement) return null;

                                                        return (
                                                            <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 border-dashed mt-2 mx-1">
                                                                <div className="text-[11px] text-gray-400 font-extrabold uppercase tracking-widest text-center">
                                                                    Phim đang chiếu hôm nay
                                                                </div>
                                                                <div className="text-[12px] text-gray-300 font-medium leading-relaxed flex flex-wrap justify-center gap-x-4 gap-y-2">
                                                                    {titlesElement}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                </div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 2. CHI TIẾT CHUYỂN KHOẢN */}
                                    <AccordionItem value="item-2" className="border-none px-4">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex flex-col items-start gap-1 text-left">
                                                <span className="text-sm font-black uppercase tracking-wider text-blue-400">
                                                    Chi tiết chuyển khoản
                                                </span>
                                                <div className="text-xs text-gray-400 font-medium">Xem số tài khoản & nội dung</div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-4 space-y-4">
                                            {[
                                                {
                                                    label: 'Ngân hàng',
                                                    value: bankInfo.bankName || '—',
                                                    copy: bankInfo.bankName
                                                },
                                                {
                                                    label: 'Số tài khoản',
                                                    value: bankInfo.accountNumber || '—',
                                                    copy: bankInfo.accountNumber,
                                                    mono: true
                                                },
                                                {
                                                    label: 'Chủ tài khoản',
                                                    value: bankInfo.accountName || '—',
                                                    copy: bankInfo.accountName
                                                },
                                                {
                                                    label: 'Nội dung',
                                                    value: `${paymentData?.pay_txt_code || ''}`,
                                                    copy: `${paymentData?.pay_txt_code || ''}`,
                                                    mono: true,
                                                    bold: true
                                                }
                                            ].map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/20 hover:bg-white/10 transition-all duration-300 group"
                                                >
                                                    <div className="flex-1 min-w-0 mr-3">
                                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter mb-1">
                                                            {item.label}
                                                        </div>
                                                        <div
                                                            className={`text-[13px] truncate ${item.mono ? 'font-mono tracking-wider' : ''} font-bold text-white ${item.bold ? 'text-blue-200 underline underline-offset-4 decoration-blue-500/30' : ''}`}
                                                        >
                                                            {item.value}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(item.copy, item.label);
                                                        }}
                                                        className="h-10 w-10 p-0 text-gray-400 hover:bg-blue-500/10 hover:text-blue-400 transition-all rounded-full shrink-0"
                                                    >
                                                        {copiedText === item.copy ? (
                                                            <Check className="w-5 h-5 text-emerald-400 animate-in zoom-in" />
                                                        ) : (
                                                            <Copy className="w-5 h-5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>

                            {/* Action Bar for Desktop */}
                            <div className="hidden lg:flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-2">
                                <Button
                                    onClick={openCancelDialog}
                                    variant="ghost"
                                    className="w-auto h-14 px-6 bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-red-400 rounded-2xl transition-all duration-300 flex items-center justify-center shrink-0 active:scale-95 shadow-none group"
                                >
                                    <XCircle className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                    <span className="font-bold text-sm">Hủy giao dịch</span>
                                </Button>

                                <Button
                                    onClick={handleCheckPayment}
                                    disabled={isChecking}
                                    className="w-full lg:w-48 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 text-base font-bold rounded-2xl transition-all duration-300 shadow-none transform active:scale-95"
                                >
                                    {isChecking ? (
                                        <>
                                            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                            <span>Đang...</span>
                                        </>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Xác nhận chuyển <Check className="w-6 h-6" />
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FIXED ACTION BARS - Mobile */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 px-4 py-4 pb-7 bg-[#050915] border-t border-white/10 z-[60] flex items-center gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                <Button
                    onClick={openCancelDialog}
                    className="w-14 h-14 bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all duration-300 flex items-center justify-center shrink-0 active:scale-95 shadow-none"
                >
                    <XCircle className="w-6 h-6" />
                </Button>

                <Button
                    onClick={handleCheckPayment}
                    disabled={isChecking}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 text-base font-bold rounded-2xl transition-all duration-300 shadow-none transform active:scale-95"
                >
                    {isChecking ? (
                        <>
                            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                            <span>Đang xử lý...</span>
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Xác nhận chuyển <Check className="w-6 h-6" />
                        </span>
                    )}
                </Button>
            </div>

            {/* Unpaid Dialog */}
            <AlertDialog open={showUnpaidDialog} onOpenChange={setShowUnpaidDialog}>
                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-amber-400 text-center">
                            Chưa nhận được thanh toán
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-300 text-base leading-relaxed text-center">
                            Chúng tôi chưa nhận được thanh toán của bạn.
                            <br />
                            <br />
                            Nếu bạn đã chuyển khoản nhưng vẫn gặp lỗi,
                            <br />
                            vui lòng liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <AlertDialogCancel
                            onClick={() => {
                                setShowUnpaidDialog(false);
                                performCancelPayment();
                            }}
                            className="bg-white/5 border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                        >
                            Hủy thanh toán
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => setShowUnpaidDialog(false)}
                            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all duration-300 transform active:scale-95"
                        >
                            Thử lại
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Expired / closed dialog */}
            <AlertDialog open={showExpiredDialog} onOpenChange={() => { }}>
                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-red-400 text-center">
                            {closedReason === 'expired' ? 'Hết thời gian thanh toán' : 'Đơn hàng không còn hiệu lực'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-gray-300 text-base leading-relaxed text-center space-y-3">
                                <p>
                                    {closedReason === 'expired'
                                        ? 'Đơn hàng của bạn đã hết hạn thanh toán (10 phút).'
                                        : 'Đơn hàng đã bị hủy hoặc đã hết hạn thanh toán.'}{' '}
                                    Vui lòng đặt vé lại nếu bạn muốn tiếp tục.
                                </p>
                                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-left space-y-1">
                                    <p className="text-amber-300 font-bold">Nếu bạn đã chuyển khoản</p>
                                    <p>
                                        Liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span> và cung cấp:
                                    </p>
                                    <p>
                                        Nội dung chuyển khoản:{' '}
                                        <span className="font-mono font-bold text-white">{paymentData?.pay_txt_code}</span>
                                    </p>
                                    <p>
                                        Số tiền:{' '}
                                        <span className="font-bold text-white">
                                            {new Intl.NumberFormat('vi-VN').format(Number(paymentData?.totalAmount || paymentData?.amount || 0))}₫
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={() => {
                                setShowExpiredDialog(false);
                                router.replace('/booking');
                            }}
                            className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                        >
                            Quay lại đặt vé
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-white text-center">Hủy thanh toán?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-300 text-center">
                            Bạn có muốn hủy giao dịch này
                            <br />
                            và quay lại trang đặt vé không?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                            Đóng
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setShowCancelDialog(false);
                                performCancelPayment();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Hủy giao dịch
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </UserLayout>
    );
}
