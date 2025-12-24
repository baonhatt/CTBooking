import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Info, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import UserLayout from "@/user/layouts/UserLayout";

export default function QRPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const BANK_INFO = {
    bankName: "Ngân Hàng OCB",
    accountNumber: "596310",
    accountName: "CONG TY TNHH CONG NGHE VR VIET NAM",
    bankCode: "OCB",
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
    const amount = data.totalAmount || data.amount || 0;
    const orderId = data.orderId || data.booking_id || "";
    const description = `CINESPHERE ${orderId}`;
    const qrContent = `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`;
    setQrCodeUrl(qrContent);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: `${label} đã được sao chép`,
    });
  };

  // Logic "Chữa cháy": Thoát và xóa session
  const handleConfirmPaid = () => {
    alert(
      "Cảm ơn bạn! Cinesphere đã ghi nhận yêu cầu thanh toán. \n\nNhân viên sẽ kiểm tra và gửi vé qua Email của bạn trong vòng 24h tới. Bạn có thể yên tâm đóng trình duyệt.",
    );
    localStorage.removeItem("qrPaymentData");
    localStorage.removeItem("qrPaymentEndTime");
    navigate("/", { replace: true });
  };

  const handleCancelPayment = () => {
    if (window.confirm("Bạn có chắc muốn hủy thanh toán và quay lại?")) {
      localStorage.removeItem("qrPaymentData");
      localStorage.removeItem("qrPaymentEndTime");
      navigate("/booking", { replace: true });
    }
  };

  return (
    <UserLayout
      className="bg-[#050915]"
      headerProps={{ onBookClick: () => {}, disableNav: true }}
      hideFooter
      contentClassName="text-white"
    >
      <div className="relative min-h-screen pb-20">
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <span
              className="hover:text-white cursor-pointer"
              onClick={() => navigate("/")}
            >
              Home
            </span>
            <span>&gt;</span>
            <span className="text-blue-400">Thanh toán QR</span>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Cột trái: QR Code (2 phần) */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/5 border-white/10 text-white overflow-hidden shadow-2xl">
                <CardHeader className="bg-white/5 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-400" />
                    Quét mã VietQR
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-white p-3 rounded-xl mb-4 shadow-inner">
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
                  <p className="text-center text-xs text-gray-400 leading-relaxed">
                    Mở ứng dụng Ngân hàng hoặc Ví điện tử để quét mã. <br />
                    Vui lòng giữ nguyên nội dung chuyển khoản mặc định.
                  </p>
                </CardContent>
              </Card>

              {/* Nút hành động chính cho Mobile hiển thị rõ */}
              <Button
                onClick={handleConfirmPaid}
                // Thêm text-white để đảm bảo chữ không bị đổi màu khi hover
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-14 text-lg font-bold rounded-xl transition-all shadow-lg"
              >
                Tôi đã chuyển khoản thành công
              </Button>
            </div>

            {/* Cột phải: Thông tin (3 phần) */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="bg-white/5 border-white/10 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg uppercase tracking-wider text-blue-400">
                    Chi tiết chuyển khoản
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                      value: `CINESPHERE ${paymentData?.orderId || ""}`,
                      copy: `CINESPHERE ${paymentData?.orderId || ""}`,
                      mono: true,
                      bold: true,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5"
                    >
                      <div>
                        <div className="text-[10px] uppercase text-gray-500 mb-1">
                          {item.label}
                        </div>
                        <div
                          className={`text-sm ${item.mono ? "font-mono" : ""} ${item.highlight ? "text-emerald-400 font-bold text-lg" : "font-medium"} ${item.bold ? "text-blue-300 underline underline-offset-4" : ""}`}
                        >
                          {item.value}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item.copy, item.label)}
                        // Thêm hover:bg-white/10 để nền chỉ hơi sáng lên thay vì trắng xóa
                        // Thêm hover:text-blue-400 để icon nổi bật hơn
                        className="text-gray-400 hover:bg-white/10 hover:text-blue-400 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Hướng dẫn & Lưu ý */}
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3">
                  <Info className="w-5 h-5 text-blue-400 shrink-0" />
                  <div className="text-xs text-blue-100/80 leading-relaxed">
                    <strong>Quy trình xác nhận:</strong> Sau khi bạn bấm xác
                    nhận chuyển tiền, nhân viên Cinesphere sẽ đối soát và gửi vé
                    qua Email của bạn trong vòng 24h.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0" />
                  <div className="text-xs text-orange-100/80 leading-relaxed">
                    <strong>Lưu ý:</strong> Vui lòng chụp ảnh màn hình biên lai
                    sau khi chuyển khoản để đối chiếu khi cần thiết. Hỗ trợ:{" "}
                    <b>036 643 1179</b>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={handleCancelPayment}
                // Chỉnh lại để khi hover nó ra màu đỏ tối, không bị trắng
                className="w-full text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                Hủy giao dịch và quay lại
              </Button>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
