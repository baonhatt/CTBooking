import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, XCircle, Clock, QrCode } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import UserLayout from "@/user/layouts/UserLayout";

export default function QRPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "checking" | "success" | "failed"
  >("pending");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const checkPaymentRef = useRef<NodeJS.Timeout | null>(null);

  // Thông tin ngân hàng
  const BANK_INFO = {
    bankName: "Techcombank",
    accountNumber: "0914475148",
    accountName: "CONG TY CINESPHERE",
    bankCode: "TCB",
  };
// Hàm xử lý khi hết giờ
const handleExpire = () => {
  localStorage.removeItem("qrPaymentData");
  localStorage.removeItem("qrPaymentEndTime");

  setPaymentStatus("failed");

  // Điều hướng sau 1 tick để tránh setState race
  setTimeout(() => {
    navigate("/booking", { replace: true });
  }, 0);
};

// Cập nhật hàm Hủy thanh toán

const handleCancelPayment = () => {
  const confirmed = window.confirm("Bạn có chắc muốn hủy thanh toán?");
  if (!confirmed) return;

  if (countdownRef.current) clearInterval(countdownRef.current);
  if (checkPaymentRef.current) clearInterval(checkPaymentRef.current);

  localStorage.removeItem("qrPaymentData");
  localStorage.removeItem("qrPaymentEndTime");

  navigate("/booking", { replace: true });
};


useEffect(() => {
  const savedData = localStorage.getItem("qrPaymentData");
  const stateData = location.state;

  if (!savedData && !stateData) {
    navigate("/booking", { replace: true });
    return;
  }

  const data = savedData ? JSON.parse(savedData) : stateData;
  setPaymentData(data);
  generateQRCode(data);


  

}, []);


  const generateQRCode = (data: any) => {
    // Tạo nội dung chuyển khoản theo chuẩn VietQR
    const amount = data.totalAmount || data.amount || 0;
    const orderId = data.orderId || data.booking_id || "";
    const description = `CINESPHERE ${orderId}`;

    // VietQR API format
    const qrContent = `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`;

    setQrCodeUrl(qrContent);
  };



  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: `${label} đã được sao chép vào clipboard`,
    });
  };





  if (paymentStatus === "success") {
    return (
      <UserLayout
        className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
        headerProps={{ onBookClick: () => {}, disableNav: true }}
        hideFooter
        contentClassName="text-white"
      >
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">Thanh toán thành công!</h2>
              <p className="text-gray-400">
                Vé của bạn đã được gửi đến email: {paymentData?.email}
              </p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/")}
              >
                Về trang chủ
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    );
  }

  if (paymentStatus === "failed") {
    return (
      <UserLayout
        className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
        headerProps={{ onBookClick: () => {}, disableNav: true }}
        hideFooter
        contentClassName="text-white"
      >
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold">Hết thời gian thanh toán</h2>
              <p className="text-gray-400">
                Phiên thanh toán đã hết hạn. Vui lòng đặt vé lại.
              </p>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/booking")}
              >
                Đặt vé lại
              </Button>
            </CardContent>
          </Card>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout
      className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
      headerProps={{ onBookClick: () => {}, disableNav: true }}
      hideFooter
      contentClassName="text-white"
    >
      <div className="relative min-h-screen">
        {/* Gradient overlays */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto p-4 pt-28">
          <div className="text-sm py-6 mb-4">
            <button
              className="text-blue-300 hover:text-blue-400 underline"
              onClick={() => navigate("/")}
            >
              Home
            </button>
            <span className="mx-2 text-white/60">&gt;</span>
            <button
              className="text-blue-300 hover:text-blue-400 underline"
              onClick={() => navigate("/booking")}
            >
              Đặt vé
            </button>
            <span className="mx-2 text-white/60">&gt;</span>
            <span className="text-white">Thanh toán QR</span>
          </div>


          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code Section */}
            <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <QrCode className="w-6 h-6" />
                  Quét mã QR để thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="aspect-square flex items-center justify-center bg-gray-200">
                      <span className="text-gray-500">Đang tạo mã QR...</span>
                    </div>
                  )}
                </div>
                <div className="text-center text-sm text-gray-400">
                  Sử dụng app ngân hàng để quét mã QR
                </div>
              </CardContent>
            </Card>

            {/* Payment Info Section */}
            <div className="space-y-4">
              <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">
                    Thông tin chuyển khoản
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-400">Ngân hàng</div>
                        <div className="font-medium">{BANK_INFO.bankName}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(BANK_INFO.bankName, "Tên ngân hàng")
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-400">
                          Số tài khoản
                        </div>
                        <div className="font-medium font-mono">
                          {BANK_INFO.accountNumber}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            BANK_INFO.accountNumber,
                            "Số tài khoản",
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-400">
                          Chủ tài khoản
                        </div>
                        <div className="font-medium">
                          {BANK_INFO.accountName}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            BANK_INFO.accountName,
                            "Chủ tài khoản",
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                      <div>
                        <div className="text-xs text-gray-400">Số tiền</div>
                        <div className="font-bold text-lg text-emerald-400">
                          {(
                            paymentData?.totalAmount ||
                            paymentData?.amount ||
                            0
                          ).toLocaleString("vi-VN")}
                          ₫
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            (
                              paymentData?.totalAmount ||
                              paymentData?.amount ||
                              0
                            ).toString(),
                            "Số tiền",
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                      <div>
                        <div className="text-xs text-gray-400">
                          Nội dung chuyển khoản
                        </div>
                        <div className="font-medium font-mono text-sm">
                          CINESPHERE{" "}
                          {paymentData?.orderId || paymentData?.booking_id}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            `CINESPHERE ${paymentData?.orderId || paymentData?.booking_id}`,
                            "Nội dung",
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-md border border-white/15 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">
                    Chi tiết đơn hàng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phim</span>
                    <span className="font-medium">
                      {paymentData?.movieTitle || paymentData?.movie}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loại vé</span>
                    <span className="font-medium">
                      {paymentData?.ticketType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Số lượng</span>
                    <span className="font-medium">
                      {paymentData?.quantity} vé
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">Tổng tiền</span>
                    <span className="font-bold text-emerald-400">
                      {(
                        paymentData?.totalAmount ||
                        paymentData?.amount ||
                        0
                      ).toLocaleString("vi-VN")}
                      ₫
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                className="w-full bg-transparent border-white/30 text-white hover:bg-white/10"
                onClick={handleCancelPayment}
              >
                Hủy thanh toán
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <Card className="mt-6 bg-blue-500/10 backdrop-blur-md border border-blue-500/30 text-white">
            <CardContent className="pt-6">
              <h3 className="font-bold mb-3 text-blue-300">
                Hướng dẫn thanh toán:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                <li>Mở ứng dụng ngân hàng trên điện thoại</li>
                <li>Quét mã QR hoặc nhập thông tin chuyển khoản bên trên</li>
                <li>Kiểm tra kỹ số tiền và nội dung chuyển khoản</li>
                <li>Xác nhận giao dịch</li>
              </ol>
              <div className="mt-4 p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
                <p className="text-xs text-orange-300">
                  <strong>Lưu ý:</strong> Vui lòng nhập đúng nội dung chuyển
                  khoản để hệ thống tự động xác nhận thanh toán.
                  <br /> Nếu có vấn đề cần hỗ trợ vui lòng liên hệ{" "}
                  <b>036 643 1179</b>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </UserLayout>
  );
}
