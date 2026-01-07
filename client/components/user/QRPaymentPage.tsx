import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function QRPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isChecking, setIsChecking] = useState(false);
  const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const BANK_INFO = {
    bankName: "Ngân Hàng OCB",
    accountNumber: "SEPPTH15806",
    accountName: "TRAN THI THUY DUONG",
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

    // Fetch full booking details (Ticket Info)
    const fetchBookingDetails = async () => {
      const bId = data?.bookingId || data?.booking_id;
      if (bId) {
        try {
          const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || "";
          const res = await fetch(`${baseUrl}/api/bookings/${bId}`);
          if (res.ok) {
            const json = await res.json();
            setBookingDetails(json);
          }
        } catch (error) {
          console.error("Error fetching booking details:", error);
        }
      }
    };
    fetchBookingDetails();

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
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
  };

  const generateQRCode = (data: any) => {
    const amount = data.totalAmount || data.amount || 0;
    const orderId = data.orderId || data.booking_id || "";
    const description = `${orderId} `;
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

  const openCancelDialog = () => {
    setShowCancelDialog(true);
  };

  const performCancelPayment = async () => {
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
  };

  return (
    <UserLayout
      className="bg-[#050915]"
      headerProps={{ onBookClick: () => { }, disableNav: true }}
      hideFooter
      contentClassName="text-white"
    >
      <div className="relative min-h-screen pb-28 sm:pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-20 sm:pt-24">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold">
              <span className="hover:text-blue-400 cursor-pointer transition-colors" onClick={() => navigate("/")}>Trang chủ</span>
              <span className="text-white/10 text-[10px]">&gt;</span>
              <span className="text-blue-400 font-black">Thanh toán QR</span>
            </div>
          </div>

          {/* Countdown Display - Sticky & Sleeker Design */}
          <div className="sticky top-[85px] lg:top-[115px] z-50 mb-6 -mx-1 px-1">
            <div className="flex items-center justify-between gap-3 bg-[#050915]/80 backdrop-blur-xl border border-white/10 px-4 md:px-6 py-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-2 duration-500">
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
                    <div className="flex items-center justify-center gap-2.5 text-[11px] text-amber-200/90 bg-amber-500/10 py-3 px-4 rounded-xl border border-amber-500/20 shadow-sm">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold tracking-tight">Vui lòng giữ nguyên nội dung chuyển khoản mặc định.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* REASSURING PAYMENT STEPS - Moved up for better immediate trust */}
              <div className="bg-gradient-to-br from-blue-500/10 to-emerald-500/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="p-4 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 font-black text-sm">1</div>
                    <div className="text-[13px] text-gray-300 leading-relaxed pt-1">
                      <strong className="text-white">Thanh toán tự động:</strong> Hệ thống sẽ xác nhận và gửi vé ngay khi nhận được tiền.
                    </div>
                  </div>

                  <div className="flex gap-4 items-start relative">
                    <div className="absolute left-4 -top-3 w-[1px] h-3 bg-white/10" />
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 font-black text-sm">2</div>
                    <div className="text-[13px] text-gray-300 leading-relaxed pt-1">
                      <strong className="text-white">Ưu tiên xử lý:</strong> Nếu muốn nhận vé nhanh hơn, hãy ấn nút <span className="text-emerald-400 font-bold">"Xác nhận chuyển"</span> bên dưới.
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
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <Accordion type="multiple" defaultValue={["item-1"]} className="w-full">
                  {/* 1. THÔNG TIN VÉ (Quan trọng nhất - Mở mặc định hoặc ưu tiên) */}
                  <AccordionItem value="item-1" className="border-white/10 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase tracking-wider text-emerald-400">
                          Thông tin vé
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-5 space-y-4">
                      <div className="space-y-5">
                        {/* Tên vé & Số lượng & Đơn giá */}
                        <div className="space-y-3 px-1">
                          <div className="flex justify-between items-center text-[13px]">
                            <span className="text-gray-400 font-medium">Tên vé:</span>
                            <span className="text-blue-400 font-black tracking-tight">
                              {bookingDetails?.ticket_package_name || paymentData?.ticketType || "Vé xem phim"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[13px]">
                            <span className="text-gray-400 font-medium">Số lượng:</span>
                            <span className="text-white font-black">
                              {bookingDetails?.ticket_count || paymentData?.ticketCount || 0} vé
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[13px]">
                            <span className="text-gray-400 font-medium">Đơn giá:</span>
                            <span className="text-gray-300 font-bold tabular-nums">
                              {Math.round((paymentData?.totalAmount || 0) / (bookingDetails?.ticket_count || paymentData?.ticketCount || 1)).toLocaleString("vi-VN")} ₫
                            </span>
                          </div>
                        </div>

                        {/* Danh sách phim trong gói */}
                        <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
                          <div className="text-[11px] text-gray-500 font-black uppercase tracking-widest">Danh sách phim</div>
                          <div className="text-[13px] text-white font-bold leading-relaxed space-y-1">
                            {(() => {
                              try {
                                const titleRaw = bookingDetails?.movie_title || "";
                                const parsed = JSON.parse(titleRaw);
                                if (Array.isArray(parsed)) {
                                  return parsed.map((title: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className="text-cyan-500 mt-1">•</span>
                                      <span>{title}</span>
                                    </div>
                                  ));
                                }
                                return titleRaw;
                              } catch {
                                return bookingDetails?.movie_title || "Đang tải...";
                              }
                            })()}
                          </div>
                        </div>

                        {/* Tổng thanh toán */}
                        <div className="px-1 pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 font-bold">Tổng thanh toán:</span>
                            <span className="text-emerald-400 font-black text-2xl tracking-tighter tabular-nums">
                              {(paymentData?.totalAmount || 0).toLocaleString("vi-VN")} ₫
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* 2. CHI TIẾT CHUYỂN KHOẢN (Ẩn mặc định, user click thì mới xem) */}
                  <AccordionItem value="item-2" className="border-none px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex flex-col items-start gap-1 text-left">
                        <span className="text-sm font-black uppercase tracking-wider text-blue-400">
                          Chi tiết chuyển khoản
                        </span>
                        <div className="text-xs text-gray-400 font-medium">
                          Xem số tài khoản & nội dung
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-4">
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
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter mb-1">
                              {item.label}
                            </div>
                            <div
                              className={`text-[13px] truncate ${item.mono ? "font-mono tracking-wider" : ""} font-bold text-white ${item.bold ? "text-blue-200 underline underline-offset-4 decoration-blue-500/30" : ""}`}
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

              {/* Action Bar for Desktop (hidden on mobile) */}
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
              {/* Removed Payment Steps from here */}
            </div>
          </div>
        </div>
      </div>

      {/* FIXED ACTION BARS - Moved to ROOT LEVEL for absolute viewport sticky */}
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
        <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-amber-400 text-center">
              Chưa nhận được thanh toán
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 text-base leading-relaxed text-center">
              Chúng tôi chưa nhận được thanh toán của bạn.
              <br /><br />
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

      {/* Expired Dialog */}
      <AlertDialog open={showExpiredDialog} onOpenChange={() => { }}>
        <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-400 text-center">
              Hết thời gian thanh toán
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 text-base leading-relaxed text-center">
              Đơn hàng của bạn đã hết hạn thanh toán (10 phút).
              <br />
              Vui lòng đặt vé lại nếu bạn muốn tiếp tục.
              <br /><br />
              Gặp sự cố? Liên hệ hotline <span className="font-bold text-blue-400">036 643 1179</span>.
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

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-white text-center">
              Hủy thanh toán?
            </AlertDialogTitle>
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
