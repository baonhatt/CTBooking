import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Mail, Ticket, User, Film, ShoppingCart, ArrowLeft, Sparkles } from "lucide-react";
import UserLayout from "@/user/layouts/UserLayout";
import {
  createMomoPaymentApi,
  API_BASE_URL,
  confirmBookingApi,
  getBookingByIdApi,
} from "@/lib/api";

export default function Checkout() {
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    !!localStorage.getItem("authUser"),
  );
  const formatMoney = (n: number | string) => new Intl.NumberFormat("en-US").format(Number(n || 0));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("vnp_OrderInfo");
    let bookingId_vnpay = "";
    if (raw) {
      // raw chỉ là số dạng chuỗi "54"
      bookingId_vnpay = raw;
      // Lưu booking_id vào localStorage để load lại vẫn có (bền hơn sessionStorage)
      localStorage.setItem("lastVnpayBookingId", raw);
    } else {
      // Nếu URL không có, check localStorage
      const saved = localStorage.getItem("lastVnpayBookingId");
      if (saved) {
        bookingId_vnpay = saved;
      }
    }
    // Handle MoMo callback
    const resultCode = params.get("resultCode");
    const amountParam = params.get("amount");
    const extraData = params.get("extraData");
    const transId =
      params.get("transId") ||
      params.get("requestId") ||
      params.get("orderId") ||
      (undefined as any);

    // Handle VNPay callback
    const vnpResponseCode = params.get("vnp_ResponseCode");
    const vnpTxnRef = params.get("vnp_TxnRef");
    const vnpTransactionNo = params.get("vnp_TransactionNo");

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
      const isFirstCallback = raw && (vnpResponseCode && vnpTxnRef);

      (async () => {
        try {
          const bookingData = await getBookingByIdApi(Number(bookingId_vnpay));
          if (bookingData) {
            const pendingFromApi = {
              orderId: `ORDER_${bookingData.id}`,
              movie: "",
              dateDisplay: "",
              name: bookingData.name,
              phone: bookingData.phone,
              email: bookingData.email,
              emailBook: bookingData.email,
              quantity: bookingData.ticket_count,
              amount: bookingData.total_price,
              method: "vnpay",
              booking_id: bookingData.id,
              user_id: bookingData.user_id,
              payment_status: bookingData.payment_status,
            };
            setOrder(pendingFromApi);
            try { localStorage.setItem("lastCheckoutOrder", JSON.stringify(pendingFromApi)); } catch { }

            // Chỉ gọi handleVNPayCallback nếu là lần đầu callback (URL có vnp params)
            if (isFirstCallback) {
              handleVNPayCallback(vnpResponseCode, vnpTxnRef, vnpTransactionNo, pendingFromApi);
            } else {
              // Load lại hoặc vào từ sessionStorage - chỉ show status, không gọi update API
              if (bookingData.payment_status === "paid") {
                setStatus("success");
              } else if (bookingData.payment_status === "failed") {
                setStatus("failed");
              }
            }
          }
        } catch (err) {
          console.error("Error fetching booking:", err);
        }
      })();
      return;
    }

    if (!pending) {
      const s = localStorage.getItem("pendingOrder");
      pending = s ? JSON.parse(s) : null;
    }
    // Fallback: nếu không có pending, thử lấy snapshot cuối cùng
    if (!pending) {
      const last = localStorage.getItem("lastCheckoutOrder");
      pending = last ? JSON.parse(last) : null;
    }

    // Nếu không có booking_id (VNPay) và không có pending data (MoMo), redirect trang chủ
    if (!bookingId_vnpay && !pending && !resultCode) {
      // Thử lấy từ localStorage trước khi về trang chủ
      const savedId = localStorage.getItem("lastVnpayBookingId");
      const savedOrder = localStorage.getItem("lastCheckoutOrder");
      if (savedId) {
        bookingId_vnpay = savedId;
        (async () => {
          try {
            const bookingData = await getBookingByIdApi(Number(bookingId_vnpay));
            if (bookingData) {
              const pendingFromApi = {
                orderId: `ORDER_${bookingData.id}`,
                movie: "",
                dateDisplay: "",
                name: bookingData.name,
                phone: bookingData.phone,
                email: bookingData.email,
                emailBook: bookingData.email,
                quantity: bookingData.ticket_count,
                amount: bookingData.total_price,
                method: "vnpay",
                booking_id: bookingData.id,
                user_id: bookingData.user_id,
                payment_status: bookingData.payment_status,
              };
              setOrder(pendingFromApi);
              setStatus(
                bookingData.payment_status === "paid"
                  ? "success"
                  : bookingData.payment_status === "failed"
                    ? "failed"
                    : "",
              );
              localStorage.setItem("lastCheckoutOrder", JSON.stringify(pendingFromApi));
            }
          } catch { }
        })();
      } else if (savedOrder) {
        try {
          const o = JSON.parse(savedOrder);
          setOrder(o);
          setStatus(o.payment_status === "paid" ? "success" : o.payment_status === "failed" ? "failed" : "");
        } catch { }
      } else {
        navigate("/");
      }
      return;
    }

    // Nếu có pending data, set order
    if (pending) {
      const merged = { ...pending };
      if (amountParam) merged.amount = Number(amountParam);
      setOrder(merged);
    }

    // MoMo payment handling
    if (resultCode) {
      // Kiểm tra nếu lần đầu callback (có extraData) hay load lại (extraData rỗng nhưng còn resultCode)
      const isFirstMomoCallback = !!extraData;

      setStatus(resultCode === "0" ? "success" : "failed");
      const payment_status = resultCode === "0" ? "paid" : "failed";

      // Chỉ gọi confirmBookingApi nếu là lần đầu callback
      if (isFirstMomoCallback && pending && pending.booking_id) {
        confirmBookingApi({
          user_id: Number(pending.user_id || 0),
          payment_id: Number(pending.booking_id),
          payment_status,
          transaction_id: transId as any,
          paid_at: new Date().toISOString(),
        }).then(() => {
          // Xóa URL params sau khi update thành công
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch(() => { });
      }
      try {
        const snap = { ...(pending || {}), payment_status };
        localStorage.setItem("lastCheckoutOrder", JSON.stringify(snap));
      } catch { }
      localStorage.removeItem("pendingOrder");
    }

    const onAuthChanged = () =>
      setIsLoggedIn(!!localStorage.getItem("authUser"));
    window.addEventListener("user-auth-changed", onAuthChanged as any);
    window.addEventListener("storage", onAuthChanged as any);
    return () => {
      window.removeEventListener("user-auth-changed", onAuthChanged as any);
      window.removeEventListener("storage", onAuthChanged as any);
    };
  }, []);

  useEffect(() => {
    if (!order?.booking_id) return;
    (async () => {
      try {
        const bookingData = await getBookingByIdApi(Number(order.booking_id));
        if (bookingData) {
          const newStatus =
            bookingData.payment_status === "paid"
              ? "success"
              : bookingData.payment_status === "failed"
                ? "failed"
                : "";
          if (newStatus) setStatus(newStatus);
          if ((bookingData as any).booking_code) {
            setBookingCode((bookingData as any).booking_code);
          }
          const merged = {
            ...order,
            amount: bookingData.total_price ?? order.amount,
            payment_status: bookingData.payment_status ?? order.payment_status,
            name: bookingData.name ?? order.name,
            phone: bookingData.phone ?? order.phone,
            email: bookingData.email ?? order.email,
          } as any;
          setOrder(merged);
          try { localStorage.setItem("lastCheckoutOrder", JSON.stringify(merged)); } catch { }
        }
      } catch { }
    })();
  }, [order?.booking_id]);

  const handleVNPayCallback = (vnpResponseCode: string | null, vnpTxnRef: string | null, vnpTransactionNo: string | null, pendingData: any) => {
    const isSuccess = vnpResponseCode === "00";
    setStatus(isSuccess ? "success" : "failed");

    if (isSuccess && pendingData && pendingData.booking_id) {
      console.log("Confirming VNPay booking...");
      confirmBookingApi({
        user_id: Number(pendingData.user_id || 0),
        payment_id: Number(pendingData.booking_id),
        payment_status: "paid",
        transaction_id: vnpTransactionNo || vnpTxnRef,
        paid_at: new Date().toISOString(),
      }).then(() => {
        // Xóa URL params sau khi update thành công, tránh gọi API lặp lại khi load lại trang
        window.history.replaceState({}, document.title, window.location.pathname);
      }).catch((err) => {
        console.error("Error confirming booking:", err);
      });
    } else if (!isSuccess && pendingData && pendingData.booking_id) {
      console.log("VNPay payment failed, updating status to failed...");
      confirmBookingApi({
        user_id: Number(pendingData.user_id || 0),
        payment_id: Number(pendingData.booking_id),
        payment_status: "failed",
        transaction_id: vnpTransactionNo || vnpTxnRef,
        paid_at: new Date().toISOString(),
      }).then(() => {
        // Xóa URL params sau khi update thành công
        window.history.replaceState({}, document.title, window.location.pathname);
      }).catch((err) => {
        console.error("Error confirming booking:", err);
      });
    }
    localStorage.removeItem("pendingOrder");
  };

  async function payWithMomo() {
    if (!order) return;
    try {
      setLoading(true);
      const partnerCode =
        (import.meta as any).env?.VITE_MOMO_PARTNER_CODE || "";
      const partnerName =
        (import.meta as any).env?.VITE_MOMO_PARTNER_NAME || "CineSphere";
      const storeId =
        (import.meta as any).env?.VITE_MOMO_STORE_ID || "devstore";
      const clientBase = (import.meta as any).env?.VITE_CLIENT_BASE_URL || window.location.origin;
      const serverBase = (import.meta as any).env?.VITE_SERVER_BASE_URL || clientBase;
      const redirectPath = (import.meta as any).env?.VITE_MOMO_REDIRECT_URL || "/checkout";
      const ipnPath = (import.meta as any).env?.VITE_MOMO_IPN_URL || "/api/momo/ipn";
      const redirectUrl = `${clientBase}${redirectPath}`;
      const ipnUrl = `${serverBase}${ipnPath}`;
      const accessKey = (import.meta as any).env?.VITE_MOMO_ACCESS_KEY || "";
      const secretKey = (import.meta as any).env?.VITE_MOMO_SECRET_KEY || "";
      const requestId = Date.now().toString();
      const orderId = order.orderId || `ORDER_${Date.now()}`;
      const orderInfo = `${order.movie || "Movie"} | ${order.quantity} vé`;
      const extraDataEncoded = btoa(
        unescape(encodeURIComponent(JSON.stringify(order))),
      );
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
        lang: "vi",
        extraData: extraDataEncoded,
        requestType: "captureWallet",
        signature: "",
        accessKey,
        secretKey,
      } as any;
      const res = await createMomoPaymentApi(payload);
      if (res?.payUrl) {
        localStorage.setItem(
          "pendingOrder",
          JSON.stringify({ ...order, orderId }),
        );
        window.location.href = res.payUrl;
        return;
      }
      throw new Error("Không nhận được liên kết thanh toán MoMo");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const resolveImageUrl = (u: string | undefined | null) => {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${API_BASE_URL}${path}`;
  };
  const getGenresText = (g: any) => {
    try {
      if (Array.isArray(g)) return g.join(" • ");
      if (typeof g === "string") {
        const parsed = JSON.parse(g);
        if (Array.isArray(parsed)) return parsed.join(" • ");
        return g;
      }
      return "";
    } catch {
      return typeof g === "string" ? g : "";
    }
  };

  return (
    <UserLayout
      className="bg-gradient-dark"
      headerProps={{ onBookClick: () => { }, forceDark: true }}
      hideFooter
    >
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.4),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.3),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.35),transparent_30%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
        </div>

        <div className="container mx-auto px-4 relative z-10 pt-32 md:pt-40 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl mx-auto"
          >
            {/* Ticket Card */}
            {order && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className={`backdrop-blur-md text-white rounded-2xl overflow-hidden ${
                  status === "success"
                    ? "bg-gradient-to-b from-emerald-700/30 via-emerald-600/20 to-teal-700/20 border border-emerald-400/50 shadow-[0_0_40px_rgba(34,197,94,0.3)]"
                    : "bg-white/5 border border-white/15 shadow-2xl"
                }`}
              >
                {/* Status Badge */}
                {status === "success" && (
                  <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-4 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(34,197,94,0.35)]">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-semibold">Thanh toán thành công</span>
                  </div>
                )}
                {status === "failed" && (
                  <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-6 py-3 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                    <XCircle className="h-5 w-5" />
                    <span className="font-semibold">Thanh toán thất bại</span>
                  </div>
                )}

                {/* Movie Poster */}
                {order.poster && (
                  <div className="relative h-48 md:h-56 overflow-hidden">
                    <img 
                      src={resolveImageUrl(order.poster)} 
                      alt={order.movie} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{order.movie}</h2>
                      {order.duration && (
                        <p className="text-white/90 text-xs md:text-sm">Thời lượng: {order.duration} phút</p>
                      )}
                      {order.genres && (
                        <p className="text-white/80 text-xs md:text-sm mt-0.5">{getGenresText(order.genres)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Booking Details */}
                <div className="p-5 md:p-6 space-y-4">
                  {/* Ticket Info */}
                  <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-white/20">
                    <div>
                      <p className="text-xs text-white/80 mb-1">Số lượng vé</p>
                      <p className="text-lg font-bold text-white">{order.quantity} vé</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/80 mb-1">Tổng tiền</p>
                      <p className="text-xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                        {formatMoney(order.amount)}₫
                      </p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-white/80">Họ tên</span>
                      <span className="font-semibold text-sm text-white">{order.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-white/80">Email</span>
                      <span className="font-semibold text-xs text-white text-right">{order.email}</span>
                    </div>
                    {order.phone && (
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-xs text-white/80">Số điện thoại</span>
                        <span className="font-semibold text-sm text-white">{order.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Booking Code (if success) */}
                  {status === "success" && bookingCode && (
                    <div className="pt-4 border-t-2 border-dashed border-white/20">
                      <p className="text-xs text-white/80 mb-2 text-center">Mã đặt vé</p>
                      <div className="bg-black/20 border border-white/20 rounded-lg p-4 text-center">
                        <p className="text-2xl font-mono font-bold text-white tracking-wider mb-3">
                          {bookingCode}
                        </p>
                        {/* Simple Barcode Representation */}
                        <div className="flex items-center justify-center gap-0.5 mb-2">
                          {bookingCode.split('').map((char, i) => (
                            <div 
                              key={i}
                              className="w-0.5 bg-white"
                              style={{ height: `${16 + (char.charCodeAt(0) % 25)}px` }}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-white/80">Vui lòng lưu mã này để check-in tại rạp</p>
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {status === "success" && (
                    <div className="bg-cyan-500/10 border border-cyan-400/30 rounded-lg p-3 flex items-start gap-2">
                      <Mail className="h-4 w-4 text-cyan-300 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-white/90">
                        <strong>Lưu ý:</strong> Mã đặt vé đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.
                      </p>
                    </div>
                  )}

                  {/* Failed Message */}
                  {status === "failed" && (
                    <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3">
                      <p className="text-xs text-red-200">
                        <strong>Thanh toán không thành công.</strong> Vui lòng thử lại hoặc liên hệ hỗ trợ nếu vấn đề vẫn tiếp tục.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Button */}
                <div className="px-5 md:px-6 pb-5">
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg"
                    onClick={() => { 
                      try { 
                        localStorage.removeItem("pendingOrder"); 
                        localStorage.removeItem("lastCheckoutOrder"); 
                        localStorage.removeItem("lastVnpayBookingId"); 
                      } catch { } 
                      navigate("/"); 
                    }}
                  >
                    Về trang chủ
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Loading State */}
            {!order && (
              <div className="bg-white/5 border border-white/10 text-white rounded-2xl shadow-2xl p-8">
                <div className="space-y-4">
                  <div className="h-64 bg-white/10 rounded-lg animate-pulse"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              </div>
            )}

            {!isLoggedIn && (
              <div className="mt-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-200">
                  Vui lòng đăng nhập trước khi thanh toán.{" "}
                  <button
                    className="font-semibold text-yellow-200 underline hover:text-yellow-100"
                    onClick={() => {
                      window.dispatchEvent(new Event("open-login"));
                      navigate("/");
                    }}
                  >
                    Đăng nhập
                  </button>
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </UserLayout>
  );
}
