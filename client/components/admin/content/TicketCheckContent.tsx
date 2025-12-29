import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  confirmBookingApi,
  getBookingByCodeApi,
  useTicketApi,
} from "@/lib/api";
import {
  AlertCircle,
  Phone,
  User,
  Film,
  Search,
  CheckCircle2,
  Mail,
  Ticket,
  Info,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

interface TicketInfo {
  id: number;
  booking_code: string;
  payment_status: string;
  user_id: number;
  name: string;
  phone: string;
  email: string;
  ticket_count: number;
  total_price: number | string;
  created_at: string;
  paid_at: string | null;
  expiry_date: string | null;
  checked_in_at: string | null;
  payment_method: string | null;
  userName: string;
  is_used: boolean;
  valid: boolean;
  can_use: boolean;
  pay_txt_code?: string;
  validity_days: number | null;
  expired: boolean;
  movie_title?: string;
  movie_duration?: string;
  ticket_package_name?: string;
}

export default function TicketCheckContent() {
  const [code, setCode] = useState("");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useLoading, setUseLoading] = useState(false);

  // States cho Alert Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<"checkin" | "payment">(
    "checkin",
  );



  const handleSearch = async () => {
    let searchCode = code.trim().toUpperCase();
    if (/^\d+$/.test(searchCode)) {
      searchCode = `CINESPHERE${searchCode}`;
    }

    if (!searchCode) {
      setError("Vui lòng nhập mã vé hoặc đơn hàng");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getBookingByCodeApi(searchCode);
      setTicketInfo(data);
    } catch (err: any) {
      setError(err.message || "Không tìm thấy thông tin");
      setTicketInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async () => {
    if (!ticketInfo) return;
    setUseLoading(true); // Bật hiệu ứng loading trên button

    try {
      if (confirmType === "checkin") {
        // 1. Xử lý xác nhận vào cổng
        const res = await useTicketApi(ticketInfo.booking_code);
        if (res?.status === "success") {
          toast.success("Thành công", {
            description: "Đã xác nhận cho khách vào cổng",
          });

          // Cập nhật giao diện ngay lập tức
          setTicketInfo({
            ...ticketInfo,
            is_used: true,
            can_use: false,
            valid: false,
            checked_in_at: new Date().toISOString(),
          });

          // CHỈ ĐÓNG MODAL KHI THÀNH CÔNG
          setConfirmOpen(false);
        }
      } else {
        // 2. Xử lý xác nhận thanh toán
        const payload = {
          user_id: ticketInfo.user_id,
          payment_id: ticketInfo.id,
          payment_status: "paid",
          transaction_id: null,
          paid_at: new Date().toISOString(),
        };
        const res = await confirmBookingApi(payload);
        toast.success("Thành công", { description: res.message });

        // Load lại dữ liệu mới nhất từ server
        await handleSearch();

        // CHỈ ĐÓNG MODAL KHI THÀNH CÔNG
        setConfirmOpen(false);
      }
    } catch (err: any) {
      toast.error("Lỗi hệ thống", {
        description: err.message || "Không thể thực hiện thao tác",
      });
      // Không đóng modal khi lỗi để nhân viên có thể xem thông báo lỗi
    } finally {
      setUseLoading(false); // Tắt hiệu ứng loading
    }
  };

  const formatDate = (str: string | null) =>
    str
      ? new Date(str).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "---";

  const parseJsonData = (data: string | undefined) => {
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            HỆ THỐNG KIỂM SOÁT
          </h1>
          <p className="text-xs text-slate-500 italic">
            * Nhập mã đơn hàng hoặc mã vé để tra cứu thông tin phim và trạng thái.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setCode("");
            setTicketInfo(null);
            setError(null);
            toast.info("Đã làm mới dữ liệu");
          }}
          className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 flex items-center justify-center bg-white border-slate-200"
          title="Làm mới"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Search Section */}
      <div className="max-w-3xl space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              className="pl-12 h-14 text-lg shadow-xl shadow-slate-100/50 border-slate-200 focus:ring-4 focus:ring-blue-100 rounded-2xl transition-all"
              placeholder="Nhập mã vé hoặc ID (VD: 1766461)..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            size="lg"
            className="h-14 px-8 bg-slate-900 hover:bg-slate-800 transition-all active:scale-95 rounded-2xl shadow-lg border-0 shadow-slate-300 font-bold"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Kiểm tra"}
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-full h-fit text-amber-600">
            <Info size={16} />
          </div>
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-bold mb-1 uppercase">
              Hướng dẫn đối soát nhanh:
            </p>
            <p>
              Nếu khách thanh toán qua Ngân hàng, tìm nội dung có mã{" "}
              <span className="font-mono font-bold bg-amber-200 px-1 rounded text-orange-700">
                CINESPHERE
              </span>{" "}
              khớp với ID.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="max-w-md animate-in fade-in zoom-in duration-300"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {ticketInfo && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-8 space-y-6">
            <Card
              className={`overflow-hidden border-none shadow-2xl shadow-slate-200/50 rounded-2xl transition-all ${ticketInfo.is_used ? "opacity-60 grayscale-[0.5]" : ""}`}
            >
              <CardContent className="p-0">
                <div className="bg-slate-50/50 p-6 border-b flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                      <Ticket className="w-5 h-5" />
                      <span className="text-lg">
                        Gói: {ticketInfo.ticket_package_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-7">
                      <span className="text-[11px] font-bold text-blue-500">
                        GIÁ 1 VÉ:{" "}
                        {Number(
                          Number(ticketInfo.total_price) /
                            ticketInfo.ticket_count,
                        ).toLocaleString("vi-VN")}{" "}
                        đ
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200/50 px-2 rounded">
                        ID: #{ticketInfo.id}
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white px-4 py-1.5 flex gap-2 items-center border-none font-black text-sm shadow-sm">
                    <User size={16} /> {ticketInfo.ticket_count} VÉ
                  </Badge>
                </div>

                <div className="p-8 space-y-8">
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Film size={14} /> DANH SÁCH PHIM & THỜI LƯỢNG:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {parseJsonData(ticketInfo.movie_title).map(
                        (title: string, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30"
                          >
                            <span className="font-bold text-slate-700 text-sm">
                              {title}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100">
                              {parseJsonData(ticketInfo.movie_duration)[i]} ph
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        Ngày đặt
                      </p>
                      <p className="text-sm font-semibold text-slate-600">
                        {formatDate(ticketInfo.created_at)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-green-500 uppercase">
                        Thanh toán
                      </p>
                      <p className="text-sm font-semibold text-green-600">
                        {formatDate(ticketInfo.paid_at)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-red-400 uppercase">
                        Hết hạn (
                        {(() => {
                          const days = differenceInDays(
                            new Date(ticketInfo.expiry_date),
                            new Date(),
                          );
                          return days < 0 ? "Đã hết hạn" : ` ${days} ngày nữa`;
                        })()}
                        )
                      </p>
                      <p className="text-sm font-semibold text-red-500">
                        {formatDate(ticketInfo.expiry_date)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <Card className="md:col-span-4 p-5 flex items-center gap-4 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-400">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Khách hàng
                  </p>
                  <p className="font-bold truncate text-slate-700">
                    {ticketInfo.name}
                  </p>
                </div>
              </Card>
              <Card className="md:col-span-3 p-5 flex items-center gap-4 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-400">
                  <Phone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    SĐT
                  </p>
                  <p className="font-bold text-slate-700">{ticketInfo.phone}</p>
                </div>
              </Card>
              <Card className="md:col-span-5 p-5 flex items-center gap-4 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-violet-50 rounded-xl text-violet-400">
                  <Mail size={20} />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Email đối soát
                  </p>
                  <p className="font-bold text-slate-700 break-all">
                    {ticketInfo.email}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card
              className={`border-2 transition-all shadow-xl ${
                ticketInfo.expired
                  ? "border-slate-400 bg-slate-50" // Giao diện khi hết hạn
                  : ticketInfo.valid && !ticketInfo.is_used
                    ? "border-green-500 bg-green-50/10"
                    : "border-slate-200 bg-white"
              }`}
            >
              <CardContent className="p-8 text-center space-y-6">
                <div className="space-y-2">
                  <h2
                    className={`text-3xl font-black uppercase tracking-tighter ${
                      ticketInfo.expired
                        ? "text-slate-500" // Màu chữ khi hết hạn
                        : ticketInfo.valid && !ticketInfo.is_used
                          ? "text-green-600"
                          : "text-slate-400"
                    }`}
                  >
                    {/* Ưu tiên hiển thị Hết hạn lên đầu tiên */}
                    {ticketInfo.expired
                      ? "VÉ HẾT HẠN"
                      : ticketInfo.valid && !ticketInfo.is_used
                        ? "VÉ HỢP LỆ"
                        : ticketInfo.is_used
                          ? "VÉ ĐÃ DÙNG"
                          : "CHƯA THANH TOÁN"}
                  </h2>

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Mã vé (Booking Code)
                    </span>
                    <span
                      className={`text-5xl font-mono font-black ${
                        ticketInfo.is_used || ticketInfo.expired
                          ? "text-slate-300 line-through decoration-slate-400/50"
                          : "text-blue-600"
                      }`}
                    >
                      {ticketInfo.booking_code}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  {/* Trường hợp 1: Vé đã hết hạn (Khóa mọi hành động) */}
                  {ticketInfo.expired ? (
                    <div className="py-5 px-6 rounded-2xl bg-slate-200 text-slate-600 font-bold border border-slate-300 flex flex-col gap-2 shadow-inner">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle size={24} />
                        <span className="text-xl uppercase font-black">
                          Không thể sử dụng
                        </span>
                      </div>
                      <p className="text-xs opacity-80">
                        Vé này đã quá hạn dùng và bị vô hiệu hóa
                      </p>
                    </div>
                  ) : /* Trường hợp 2: Chưa thanh toán */
                  ticketInfo.payment_status !== "paid" ? (
                    <Button
                      onClick={() => {
                        setConfirmType("payment");
                        setConfirmOpen(true);
                      }}
                      disabled={useLoading}
                      className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-lg font-black uppercase shadow-lg shadow-amber-200"
                    >
                      Xác nhận thanh toán
                    </Button>
                  ) : /* Trường hợp 3: Hợp lệ để vào cổng */
                  ticketInfo.can_use && !ticketInfo.is_used ? (
                    <Button
                      onClick={() => {
                        setConfirmType("checkin");
                        setConfirmOpen(true);
                      }}
                      disabled={useLoading}
                      className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg font-black uppercase shadow-lg shadow-green-200"
                    >
                      Xác nhận cho vào cổng
                    </Button>
                  ) : (
                    /* Trường hợp 4: Đã sử dụng */
                    <div className="space-y-4">
                      <div className="py-5 px-6 rounded-2xl bg-slate-50 text-slate-400 font-bold border border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-2 text-red-500">
                          <AlertCircle size={24} />
                          <span className="text-xl uppercase font-black">
                            Đã sử dụng
                          </span>
                        </div>
                        {ticketInfo.checked_in_at && (
                          <div className="mt-2 py-3 px-4 bg-red-50 rounded-xl border border-red-100 text-red-600">
                            <p className="text-[11px] uppercase tracking-wider font-bold opacity-70 flex items-center justify-center gap-1">
                              <Clock size={12} /> Thời gian vào:
                            </p>
                            <p className="text-lg font-mono font-bold tracking-tight">
                              {formatDate(ticketInfo.checked_in_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card thông tin thanh toán - Chuyển màu tối nếu hết hạn */}
            <Card
              className={`${ticketInfo.expired ? "bg-slate-700" : "bg-slate-900"} text-white overflow-hidden relative shadow-xl transition-colors`}
            >
              <CheckCircle2 className="absolute -top-4 -right-4 opacity-10 w-32 h-32" />
              <CardContent className="p-6 space-y-5 relative z-10">
                <div className="flex justify-between items-center text-[10px] opacity-60 font-black uppercase tracking-widest">
                  <span>Phương thức</span>
                  <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    {ticketInfo.payment_method || "VIETQR"}
                  </span>
                </div>
                <div className="pt-5 border-t border-slate-800 flex justify-between items-end">
                  <span className="text-xs font-bold opacity-60 uppercase">
                    Tổng thanh toán:
                  </span>
                  <span
                    className={`text-4xl font-black leading-none tracking-tighter ${ticketInfo.expired ? "text-slate-400" : "text-green-400"}`}
                  >
                    {Number(ticketInfo.total_price).toLocaleString("vi-VN")}
                    <span className="text-base ml-1 font-bold">đ</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* AlertDialog xác nhận hành động */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Ngăn không cho người dùng tự đóng modal bằng phím Esc hoặc click ra ngoài khi đang loading
          if (!useLoading) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-2xl font-black text-slate-900 uppercase">
              {confirmType === "checkin"
                ? "⚠️ Xác nhận vào cổng?"
                : "💰 Xác nhận thanh toán?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base leading-relaxed">
              {confirmType === "checkin"
                ? `Bạn đang thực hiện cho ${ticketInfo?.ticket_count} khách vào cổng. Hành động này không thể hoàn tác.`
                : `Bạn đã đối soát thành công số tiền ${Number(ticketInfo?.total_price).toLocaleString("vi-VN")}đ cho ID #${ticketInfo?.id}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel
              disabled={useLoading}
              className="h-12 px-6 rounded-xl font-bold"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // e.preventDefault() để AlertDialog không tự đóng khi click
                e.preventDefault();
                executeAction();
              }}
              disabled={useLoading}
              className={`h-12 px-8 rounded-xl font-black uppercase min-w-[160px] ${
                confirmType === "checkin"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {useLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Xác nhận ngay"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
