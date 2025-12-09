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
import Header from "@/components/Header";
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
            // Tạo pending object từ booking data - đầy đủ như MoMo extraData
            const pendingFromApi = {
              orderId: `ORDER_${bookingData.id}`,
              movie: bookingData.showtime?.movie?.title || "",
              dateDisplay: bookingData.showtime?.start_time
                ? new Date(bookingData.showtime.start_time).toLocaleDateString("vi-VN")
                : "",
              showtime: bookingData.showtime?.start_time
                ? new Date(bookingData.showtime.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                : "",
              showtimeId: bookingData.showtime_id,
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
            try { localStorage.setItem("lastCheckoutOrder", JSON.stringify(pendingFromApi)); } catch {}

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
                movie: bookingData.showtime?.movie?.title || "",
                dateDisplay: bookingData.showtime?.start_time
                  ? new Date(bookingData.showtime.start_time).toLocaleDateString("vi-VN")
                  : "",
                showtime: bookingData.showtime?.start_time
                  ? new Date(bookingData.showtime.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                  : "",
                showtimeId: bookingData.showtime_id,
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
          } catch {}
        })();
      } else if (savedOrder) {
        try {
          const o = JSON.parse(savedOrder);
          setOrder(o);
          setStatus(o.payment_status === "paid" ? "success" : o.payment_status === "failed" ? "failed" : "");
        } catch {}
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
      if (isFirstMomoCallback && pending && pending.booking_id && pending.user_id) {
        confirmBookingApi({
          user_id: Number(pending.user_id),
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
      } catch {}
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
          const merged = {
            ...order,
            amount: bookingData.total_price ?? order.amount,
            payment_status: bookingData.payment_status ?? order.payment_status,
            name: bookingData.name ?? order.name,
            phone: bookingData.phone ?? order.phone,
            email: bookingData.email ?? order.email,
            movie: bookingData.showtime?.movie?.title ?? order.movie,
            dateDisplay: bookingData.showtime?.start_time
              ? new Date(bookingData.showtime.start_time).toLocaleDateString("vi-VN")
              : order.dateDisplay,
            showtime: bookingData.showtime?.start_time
              ? new Date(bookingData.showtime.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
              : order.showtime,
          } as any;
          setOrder(merged);
          try { localStorage.setItem("lastCheckoutOrder", JSON.stringify(merged)); } catch {}
        }
      } catch {}
    })();
  }, [order?.booking_id]);

  const handleVNPayCallback = (vnpResponseCode: string | null, vnpTxnRef: string | null, vnpTransactionNo: string | null, pendingData: any) => {
    const isSuccess = vnpResponseCode === "00";
    setStatus(isSuccess ? "success" : "failed");

    if (isSuccess && pendingData && pendingData.booking_id && pendingData.user_id) {
      console.log("Confirming VNPay booking...");
      confirmBookingApi({
        user_id: Number(pendingData.user_id),
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
    } else if (!isSuccess && pendingData && pendingData.booking_id && pendingData.user_id) {
      console.log("VNPay payment failed, updating status to failed...");
      confirmBookingApi({
        user_id: Number(pendingData.user_id),
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
      const redirectUrl =
        (import.meta as any).env?.VITE_MOMO_REDIRECT_URL ||
        window.location.origin + "/checkout";
      const ipnUrl =
        (import.meta as any).env?.VITE_MOMO_IPN_URL ||
        (API_BASE_URL
          ? API_BASE_URL + "/api/momo/ipn"
          : window.location.origin + "/api/momo/ipn");
      const accessKey = (import.meta as any).env?.VITE_MOMO_ACCESS_KEY || "";
      const secretKey = (import.meta as any).env?.VITE_MOMO_SECRET_KEY || "";
      const requestId = Date.now().toString();
      const orderId = order.orderId || `ORDER_${Date.now()}`;
      const orderInfo = `${order.movie || "Movie"} | ${order.quantity} vé | ${order.showtime || "--:--"}`;
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

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header onBookClick={() => {}} />
      <div className="max-w-3xl mx-auto p-4 pt-24">
      <Card className="w-full bg-black/40 border border-white/10 text-white">
        <CardHeader>
          <CardTitle className="text-blue-400">Thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          {order ? (
            <div className="space-y-3 text-sm">
              {status === "success" && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-green-300 mb-2">✓ Vé đã thanh toán thành công!</h3>
                  <p className="text-green-200">Vui lòng kiểm tra email để nhận mã vé.</p>
                </div>
              )}
              {status === "failed" && (
                <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-red-300 mb-2">✗ Thanh toán thất bại</h3>
                  <p className="text-red-200">Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <span className="text-cyan-200">Phim</span>
                <span className="font-medium text-white">{order.movie}</span>
                <span className="text-cyan-200">Ngày</span>
                <span className="font-medium text-white">{order.dateDisplay}</span>
                <span className="text-cyan-200">Giờ chiếu</span>
                <span className="font-medium text-white">{order.showtime}</span>
                <span className="text-cyan-200">Họ tên</span>
                <span className="font-medium text-white">{order.name}</span>
                <span className="text-cyan-200">Email</span>
                <span className="font-medium text-white">{order.email}</span>
                <span className="text-cyan-200">Số lượng</span>
                <span className="font-medium text-white">{order.quantity}</span>
                <span className="text-white">Tổng tiền</span>
                <span className="font-semibold text-blue-400">
                  {formatMoney(order.amount)}₫
                </span>
              </div>
              {status === "success" && (
                <div className="text-xs sm:text-sm text-yellow-300 mt-1">
                  Vui lòng kiểm tra kỹ email, mã đặt vé sẽ gửi tới email này.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-6 bg-white/10 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 bg-white/10 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10" onClick={() => { try { localStorage.removeItem("pendingOrder"); localStorage.removeItem("lastCheckoutOrder"); localStorage.removeItem("lastVnpayBookingId"); } catch {} ; navigate("/"); }}>
            Quay lại
          </Button>
        </CardFooter>
        {!isLoggedIn && (
          <div className="px-6 pb-6 text-sm text-red-300">
            Vui lòng đăng nhập trước khi thanh toán.
            <button
              className="ml-2 text-blue-300 underline"
              onClick={() => {
                window.dispatchEvent(new Event("open-login"));
                navigate("/");
              }}
            >
              Đăng nhập
            </button>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
