import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode, Info, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import UserLayout from "@/user/layouts/UserLayout";
import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function QRPaymentPage() {
        const navigate = useNavigate();
        const location = useLocation();
        const [paymentData, setPaymentData] = useState<any>(null);
        const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
        const [copiedText, setCopiedText] = useState<string | null>(null);
        const [timeLeft, setTimeLeft] = useState<number>(0);
        const [isChecking, setIsChecking] = useState(false);
        const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
        const [showExpiredDialog, setShowExpiredDialog] = useState(false);

        const BANK_INFO = {
                bankName: "Ngân Hàng OCB",
                accountNumber: "596310",
                accountName: "CONG TY TNHH CONG NGHE VR VIET NAM",
                bankCode: "OCB",
        };

        const paymentDataRef = useRef<any>(null); // Use ref to avoid stale closure in timer

        useEffect(() => {
                const savedData = localStorage.getItem("qrPaymentData");
                const stateData = location.state;

                if (!savedData && !stateData) {
                        navigate("/booking", { replace: true });
                        return;
                }

                const data = savedData ? JSON.parse(savedData) : stateData;
                setPaymentData(data);
                paymentDataRef.current = data; // Update ref
                generateQRCode(data);

                // --- Timer Logic ---
                const savedEndTime = localStorage.getItem("qrPaymentEndTime");
                let endTime = savedEndTime ? parseInt(savedEndTime, 10) : 0;

                if (!endTime || isNaN(endTime)) {
                        // 10 minutes from now if not set
                        endTime = Date.now() + 10 * 60 * 1000;
                        localStorage.setItem("qrPaymentEndTime", endTime.toString());
                }

                const updateTimer = () => {
                        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
                        setTimeLeft(remaining);

                        if (remaining <= 0) {
                                handleExpired();
                        }
                };

                updateTimer(); // Initial call
                const timerId = setInterval(updateTimer, 1000);

                return () => {
                        clearInterval(timerId);
                };
        }, []);

        const handleSuccess = () => {
                localStorage.removeItem("qrPaymentData");
                localStorage.removeItem("qrPaymentEndTime");
                toast.success("Thanh toán thành công!");
                navigate("/successPayment");
        };

        const handleExpired = async () => {
                // Use ref to get latest data inside closure
                const data = paymentDataRef.current;
                const bId = data?.bookingId || data?.booking_id;

                if (bId) {
                        try {
                                const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || "";
                                const res = await fetch(`${baseUrl}/api/confirm-booking`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                                payment_id: bId,
                                                payment_status: "failed",
                                        }),
                                });

                                // Check safeguard (409 Conflict)
                                if (res.status === 409) {
                                        localStorage.removeItem("qrPaymentData");
                                        localStorage.removeItem("qrPaymentEndTime");
                                        toast.success("Giao dịch đã được thanh toán thành công!");
                                        navigate("/successPayment", { replace: true });
                                        return;
                                }

                        } catch (error) {
                                console.error("Failed to update booking status:", error);
                        }
                }

                // Clear localStorage
                localStorage.removeItem("qrPaymentData");
                localStorage.removeItem("qrPaymentEndTime");

                // Show expired dialog
                setShowExpiredDialog(true);
        };

        const formatTime = (seconds: number) => {
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        const generateQRCode = (data: any) => {
                const amount = data.totalAmount || data.amount || 0;
                const orderId = data.orderId || data.booking_id || "";
                const description = `${orderId}`;
                const qrContent = `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`;
                setQrCodeUrl(qrContent);
        };

        const copyToClipboard = async (text: string, label: string) => {
                try {
                        await navigator.clipboard.writeText(text);
                        setCopiedText(text);

                        toast.success(`Đã sao chép ${label}`, {
                                description: text,
                                className: "bg-[#0f172a] border-white/10 text-white", // Khớp màu Card của bạn
                                descriptionClassName: "text-gray-400", // Chữ mờ hơn một chút
                        });

                        setTimeout(() => setCopiedText(null), 2000);
                } catch (err) {
                        toast.error("Lỗi sao chép dữ liệu");
                }
        };

        const handleCheckPayment = async () => {
                const bId = paymentData?.bookingId || paymentData?.booking_id;
                if (!bId) {
                        toast.error("Không tìm thấy thông tin đơn hàng");
                        return;
                }

                setIsChecking(true);
                try {
                        // Use backend base URL from environment variable
                        const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || "";
                        const res = await fetch(`${baseUrl}/api/bookings/${bId}`, { cache: "no-store" });
                        if (res.ok) {
                                const booking = await res.json();
                                if (booking.payment_status === 'paid') {
                                        // Payment confirmed - navigate to success
                                        handleSuccess();
                                } else {
                                        // Payment not yet confirmed - show dialog
                                        setShowUnpaidDialog(true);
                                }
                        } else {
                                toast.error("Không thể kiểm tra trạng thái thanh toán");
                        }
                } catch (error) {
                        toast.error("Lỗi kết nối, vui lòng thử lại");
                } finally {
                        setIsChecking(false);
                }
        };

        const handleCancelPayment = async () => {
                if (window.confirm("Bạn có chắc muốn hủy thanh toán và quay lại?")) {
                        // Call API to update booking status to 'failed'
                        const bId = paymentData?.bookingId || paymentData?.booking_id;
                        let isPaidSafeguard = false;

                        if (bId) {
                                try {
                                        const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || "";
                                        const res = await fetch(`${baseUrl}/api/confirm-booking`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                        payment_id: bId,
                                                        payment_status: "failed",
                                                }),
                                        });

                                        // Xử lý trường hợp Backend trả về 409 (Đã thanh toán rồi -> Không cho hủy)
                                        if (res.status === 409) {
                                                isPaidSafeguard = true;
                                                toast.success("Giao dịch đã được thanh toán thành công!");

                                                // Update persist data for Checkout page
                                                try {
                                                        const currentOrder = localStorage.getItem("lastCheckoutOrder");
                                                        let newOrder = currentOrder ? JSON.parse(currentOrder) : {};
                                                        // Merge current paymentData just in case
                                                        newOrder = {
                                                                ...newOrder,
                                                                ...paymentData,
                                                                payment_status: 'paid',
                                                                booking_id: bId
                                                        };
                                                        localStorage.setItem("lastCheckoutOrder", JSON.stringify(newOrder));
                                                } catch (e) { }

                                                localStorage.removeItem("qrPaymentData");
                                                localStorage.removeItem("qrPaymentEndTime");

                                                // Navigate immediately
                                                navigate("/successPayment", { replace: true });
                                                return;
                                        }
                                } catch (error) {
                                        console.error("Failed to update booking status:", error);
                                }
                        }

                        // Chỉ chạy logic hủy nếu KHÔNG PHẢI trường hợp đã thanh toán (409)
                        if (!isPaidSafeguard) {
                                localStorage.removeItem("qrPaymentData");
                                localStorage.removeItem("qrPaymentEndTime");
                                toast.info("Đã hủy giao dịch thành công");
                                navigate("/booking", { replace: true });
                        }
                }
        };

        return (
                <UserLayout
                        className="bg-[#050915]"
                        headerProps={{ onBookClick: () => { }, disableNav: true }}
                        hideFooter
                        contentClassName="text-white"
                >
                        <div className="relative min-h-screen pb-20">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_70%)] pointer-events-none" />

                                <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 sm:pt-24">

                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-1">
                                                <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold">
                                                        <span className="hover:text-blue-400 cursor-pointer transition-colors" onClick={() => navigate("/")}>Trang chủ</span>
                                                        <span className="text-white/10 text-[10px]">&gt;</span>
                                                        <span className="text-blue-400 font-black">Thanh toán QR</span>
                                                </div>

                                                {/* Countdown Display - Sleeker Design */}
                                                <div className="flex items-center gap-3 bg-red-500/5 backdrop-blur-md border border-red-500/20 px-5 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.05)] animate-in fade-in slide-in-from-right-4 duration-500">
                                                        <div className="flex items-center justify-center relative">
                                                                <span className="relative flex h-2 w-2">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-bold text-red-200/70 uppercase tracking-widest">
                                                                        Hết hạn sau:
                                                                </span>
                                                                <span className="font-mono text-red-400 text-lg font-black tracking-tighter tabular-nums drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]">
                                                                        {formatTime(timeLeft)}
                                                                </span>
                                                        </div>
                                                </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                                                {/* CỘT TRÁI: MÃ QR */}
                                                <div className="lg:col-span-2 space-y-6">
                                                        <Card className="bg-white/5 border-white/10 text-white overflow-hidden shadow-2xl rounded-2xl">
                                                                <CardHeader className="bg-white/5 border-b border-white/5 py-4">
                                                                        <CardTitle className="text-base font-bold flex items-center gap-2 uppercase tracking-wide">
                                                                                <QrCode className="w-4 h-4 text-blue-400" />
                                                                                Quét mã VietQR
                                                                        </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="pt-6 pb-6 px-5">
                                                                        <div className="bg-white p-3 rounded-2xl mb-5 shadow-[0_0_40px_rgba(255,255,255,0.05)] border-4 border-white/10">
                                                                                {qrCodeUrl ? (
                                                                                        <img
                                                                                                src={qrCodeUrl}
                                                                                                alt="QR"
                                                                                                className="w-full h-auto rounded-lg"
                                                                                        />
                                                                                ) : (
                                                                                        <div className="aspect-square bg-gray-800 animate-pulse rounded-lg" />
                                                                                )}
                                                                        </div>
                                                                        <div className="space-y-3">
                                                                                <p className="text-center text-[13px] text-gray-400 leading-relaxed font-medium">
                                                                                </p>
                                                                                <div className="flex items-center justify-center gap-2 text-[11px] text-amber-400/80 bg-amber-400/5 py-2 px-3 rounded-lg border border-amber-400/10">
                                                                                        <Info className="w-3.5 h-3.5" />
                                                                                        Vui lòng giữ nguyên nội dung chuyển khoản mặc định.
                                                                                </div>
                                                                        </div>
                                                                </CardContent>
                                                        </Card>
                                                </div>

                                                {/* CỘT PHẢI: CHI TIẾT & HÀNH ĐỘNG */}
                                                <div className="lg:col-span-3 space-y-6">
                                                        <Card className="bg-white/5 border-white/10 text-white shadow-xl rounded-2xl overflow-hidden">
                                                                <CardHeader className="border-b border-white/5 bg-white/5 py-4">
                                                                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-blue-400/80">
                                                                                Chi tiết chuyển khoản
                                                                        </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="p-5 space-y-4">
                                                                        {[
                                                                                {
                                                                                        label: "Ngân hàng",
                                                                                        value: BANK_INFO.bankName,
                                                                                        copy: BANK_INFO.bankName,
                                                                                },
                                                                                {
                                                                                        label: "Số tài khoản",
                                                                                        value: BANK_INFO.accountNumber,
                                                                                        copy: BANK_INFO.accountNumber,
                                                                                        mono: true,
                                                                                },
                                                                                {
                                                                                        label: "Chủ tài khoản",
                                                                                        value: BANK_INFO.accountName,
                                                                                        copy: BANK_INFO.accountName,
                                                                                },
                                                                                {
                                                                                        label: "Số tiền",
                                                                                        value: `${(paymentData?.totalAmount || 0).toLocaleString("vi-VN")} ₫`,
                                                                                        copy: (paymentData?.totalAmount || 0).toString(),
                                                                                        highlight: true,
                                                                                },
                                                                                {
                                                                                        label: "Nội dung",
                                                                                        value: `${paymentData?.orderId || ""}`,
                                                                                        copy: `${paymentData?.orderId || ""}`,
                                                                                        mono: true,
                                                                                        bold: true,
                                                                                },
                                                                        ].map((item, idx) => (
                                                                                <div
                                                                                        key={idx}
                                                                                        className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/20 hover:bg-white/10 transition-all duration-300 group"
                                                                                >
                                                                                        <div>
                                                                                                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter mb-1">
                                                                                                        {item.label}
                                                                                                </div>
                                                                                                <div
                                                                                                        className={`text-[13px] ${item.mono ? "font-mono tracking-wider" : ""} ${item.highlight ? "text-blue-400 font-black text-xl drop-shadow-[0_0_12px_rgba(96,165,250,0.4)]" : "font-bold text-white"} ${item.bold ? "text-blue-200 underline underline-offset-4 decoration-blue-500/30" : ""}`}
                                                                                                >
                                                                                                        {item.value}
                                                                                                </div>
                                                                                        </div>
                                                                                        <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => copyToClipboard(item.copy, item.label)}
                                                                                                className="h-9 w-9 p-0 text-gray-500 hover:bg-blue-500/10 hover:text-blue-400 transition-all rounded-full"
                                                                                        >
                                                                                                {copiedText === item.copy ? (
                                                                                                        <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in" />
                                                                                                ) : (
                                                                                                        <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                                                )}
                                                                                        </Button>
                                                                                </div>
                                                                        ))}
                                                                </CardContent>
                                                        </Card>

                                                        <div className="grid grid-cols-1 gap-3">
                                                                <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                                                                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                                                        <div className="text-[12px] text-gray-400 leading-relaxed">
                                                                                <strong className="text-blue-300 font-bold">Quy trình xác nhận:</strong> Sau khi chuyển khoản, ấn nút <span className="text-emerald-400 font-semibold">"Tôi đã chuyển khoản"</span> để hệ thống kiểm tra và gửi vé qua Email.
                                                                        </div>
                                                                </div>

                                                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-4">
                                                                        <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                                                                        <div className="text-[13px] text-orange-100/80 leading-relaxed">
                                                                                <strong className="text-orange-300 text-sm">Lưu ý:</strong> Vui lòng chụp ảnh màn hình biên lai
                                                                                sau khi chuyển khoản để đối chiếu khi cần thiết. Hỗ trợ:{" "}
                                                                                <b className="text-orange-200">036 643 1179</b>
                                                                        </div>
                                                                </div>
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-4 pt-6">
                                                                <Button
                                                                        onClick={handleCheckPayment}
                                                                        disabled={isChecking}
                                                                        className="w-full sm:w-80 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white h-14 text-base sm:text-lg font-black rounded-2xl transition-all duration-300 shadow-[0_8px_25px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_30px_-5px_rgba(16,185,129,0.4)] transform active:scale-95 order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                        {isChecking ? (
                                                                                <>
                                                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                                                        Đang kiểm tra...
                                                                                </>
                                                                        ) : (
                                                                                "Tôi đã chuyển khoản"
                                                                        )}
                                                                </Button>

                                                                <Button
                                                                        variant="ghost"
                                                                        onClick={handleCancelPayment}
                                                                        className="w-full sm:w-fit px-8 text-gray-500 hover:text-red-400 hover:bg-red-500/5 h-14 rounded-2xl transition-all duration-300 text-sm font-semibold order-2 sm:order-1"
                                                                >
                                                                        Hủy giao dịch
                                                                </Button>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        </div>

                        {/* Unpaid Dialog */}
                        <AlertDialog open={showUnpaidDialog} onOpenChange={setShowUnpaidDialog}>
                                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
                                        <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-amber-400">
                                                        Chưa nhận được thanh toán
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-gray-300 text-base leading-relaxed">
                                                        Chúng tôi chưa nhận được thanh toán của bạn. Vui lòng đợi vài giây để giao dịch được xử lý, sau đó thử lại.
                                                        <br /><br />
                                                        Nếu bạn đã chuyển khoản nhưng vẫn gặp lỗi này, vui lòng liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span> để được hỗ trợ.
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="gap-2">
                                                <AlertDialogCancel
                                                        onClick={() => setShowUnpaidDialog(false)}
                                                        className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                                                >
                                                        Thử lại
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                        onClick={() => {
                                                                setShowUnpaidDialog(false);
                                                                navigate("/", { replace: true });
                                                        }}
                                                        className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                                                >
                                                        Về trang chủ
                                                </AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>

                        {/* Expired Dialog */}
                        <AlertDialog open={showExpiredDialog} onOpenChange={() => { }}>
                                <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
                                        <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold text-red-400">
                                                        Hết thời gian thanh toán
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-gray-300 text-base leading-relaxed">
                                                        Đơn hàng của bạn đã hết hạn thanh toán (quá 10 phút). Vui lòng đặt vé lại nếu bạn muốn tiếp tục.
                                                        <br /><br />
                                                        Nếu bạn đã chuyển khoản nhưng quá thời gian, vui lòng liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span> để được hỗ trợ.
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogAction
                                                        onClick={() => {
                                                                setShowExpiredDialog(false);
                                                                navigate("/booking", { replace: true });
                                                        }}
                                                        className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                                                >
                                                        Quay lại đặt vé
                                                </AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
                </UserLayout>
        );
}
