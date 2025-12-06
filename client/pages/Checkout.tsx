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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("vnp_OrderInfo");
    let bookingId_vnpay = "";
    if (raw) {
      // raw chỉ là số dạng chuỗi "54"
      bookingId_vnpay = raw;
      // Lưu booking_id vào sessionStorage để load lại vẫn có
      sessionStorage.setItem("lastVnpayBookingId", raw);
    } else {
      // Nếu URL không có, check sessionStorage
      const saved = sessionStorage.getItem("lastVnpayBookingId");
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

    // Nếu không có booking_id (VNPay) và không có pending data (MoMo), redirect trang chủ
    if (!bookingId_vnpay && !pending && !resultCode) {
      navigate("/");
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg bg-white">
        <CardHeader>
          <CardTitle>Thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          {order ? (
            <div className="space-y-3 text-sm">
              {status === "success" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-green-800 mb-2">✓ Vé đã thanh toán thành công!</h3>
                  <p className="text-green-700">Vui lòng kiểm tra email để nhận mã vé.</p>
                </div>
              )}
              {status === "failed" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-red-800 mb-2">✗ Thanh toán thất bại</h3>
                  <p className="text-red-700">Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-600">Phim</span>
                <span className="font-medium">{order.movie}</span>
                <span className="text-gray-600">Ngày</span>
                <span className="font-medium">{order.dateDisplay}</span>
                <span className="text-gray-600">Giờ chiếu</span>
                <span className="font-medium">{order.showtime}</span>
                <span className="text-gray-600">Họ tên</span>
                <span className="font-medium">{order.name}</span>
                <span className="text-gray-600">Số lượng</span>
                <span className="font-medium">{order.quantity}</span>
                <span className="text-gray-600">Tổng tiền</span>
                <span className="font-semibold text-blue-600">
                  {order.amount?.toLocaleString("vi-VN")}₫
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            Quay lại
          </Button>
        </CardFooter>
        {!isLoggedIn && (
          <div className="px-6 pb-6 text-sm text-red-600">
            Vui lòng đăng nhập trước khi thanh toán.
            <button
              className="ml-2 text-blue-600 underline"
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
  );
}
