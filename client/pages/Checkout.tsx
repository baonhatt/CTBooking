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
    const resultCode = params.get("resultCode");
    const amountParam = params.get("amount");
    const extraData = params.get("extraData");
    const transId =
      params.get("transId") ||
      params.get("requestId") ||
      params.get("orderId") ||
      (undefined as any);
    let pending: any = null;
    if (extraData) {
      try {
        pending = JSON.parse(decodeURIComponent(escape(atob(extraData))));
      } catch {}
    }
    if (!pending) {
      const s = localStorage.getItem("pendingOrder");
      pending = s ? JSON.parse(s) : null;
    }
    if (pending) {
      const merged = { ...pending };
      if (amountParam) merged.amount = Number(amountParam);
      setOrder(merged);
    }
    if (resultCode) {
      setStatus(resultCode === "0" ? "success" : "failed");
      const payment_status = resultCode === "0" ? "success" : "failed";
      if (pending && pending.booking_id && pending.user_id) {
        confirmBookingApi({
          user_id: Number(pending.user_id),
          payment_id: Number(pending.booking_id),
          payment_status,
          transaction_id: transId as any,
          paid_at: new Date().toISOString(),
        }).catch(() => {});
      }
      localStorage.removeItem("pendingOrder");
      window.history.replaceState({}, document.title, window.location.pathname);
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
              {status && (
                <div
                  className={
                    status === "success" ? "text-green-600" : "text-red-600"
                  }
                >
                  Trạng thái: {status === "success" ? "Thành công" : "Thất bại"}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-600">Phim</span>
                <span className="font-medium">{order.movie}</span>
                <span className="text-gray-600">Ngày</span>
                <span className="font-medium">{order.dateDisplay}</span>
                <span className="text-gray-600">Giờ</span>
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
            <div>Không có đơn hàng đang chờ.</div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/")}>
            Quay lại
          </Button>
          <Button
            disabled={!order || loading || !isLoggedIn}
            onClick={payWithMomo}
          >
            Thanh toán MoMo
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
