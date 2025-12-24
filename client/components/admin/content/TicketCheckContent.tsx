import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const handleSearch = async () => {
    let searchCode = code.trim().toUpperCase();

    // Tự động thêm ORDER nếu chỉ nhập số
    if (/^\d+$/.test(searchCode)) {
      searchCode = `ORDER${searchCode}`;
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

  const handleConfirmUse = async () => {
    if (!ticketInfo?.booking_code) return;
    try {
      setUseLoading(true);
      const res = await useTicketApi(ticketInfo.booking_code);
      if (res?.status === "success") {
        toast({ title: "Thành công", description: "Đã xác nhận vào cổng" });
        setTicketInfo({
          ...ticketInfo,
          is_used: true,
          can_use: false,
          valid: false,
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Lỗi", description: err.message });
    } finally {
      setUseLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!ticketInfo) return;
    try {
      setUseLoading(true);
      const payload = {
        user_id: ticketInfo.user_id,
        payment_id: ticketInfo.id,
        payment_status: "paid",
        transaction_id: null,
        paid_at: new Date().toISOString(),
      };
      const res = await confirmBookingApi(payload);
      toast({ title: "Thành công", description: res.message });
      handleSearch();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Lỗi", description: err.message });
    } finally {
      setUseLoading(false);
    }
  };

  const formatDate = (str: string | null) =>
    str
      ? new Date(str).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
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
    <div className="max-w-8xl mx-auto space-y-8 pb-20">
      <div className="space-y-1">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          HỆ THỐNG KIỂM SOÁT
        </h1>
        <p className="text-muted-foreground italic text-sm">
          * Nhập mã đơn hàng hoặc mã vé để tra cứu thông tin phim và trạng thái.
        </p>
      </div>

      {/* Search & Instruction Section */}
      <div className="max-w-3xl space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              className="pl-12 h-14 text-lg shadow-sm border-slate-200 focus:ring-2"
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
            className="h-14 px-8 bg-slate-900 hover:bg-slate-800"
          >
            {isLoading ? "Đang quét..." : "Kiểm tra"}
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
                ORDER
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-8 space-y-6">
            <Card
              className={`overflow-hidden border-slate-200 shadow-sm transition-all ${ticketInfo.is_used ? "opacity-60 grayscale-[0.5]" : ""}`}
            >
              <CardContent className="p-0">
                <div className="bg-slate-50/50 p-6 border-b flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                      <Ticket className="w-5 h-5" />
                      <span>Gói: {ticketInfo.ticket_package_name}</span>
                    </div>
                    {/* Hiển thị giá 1 vé */}
                    <span className="text-[11px] font-bold text-blue-500 ml-7">
                      GIÁ 1 VÉ:{" "}
                      {Number(
                        Number(ticketInfo.total_price) /
                          ticketInfo.ticket_count,
                      ).toLocaleString("vi-VN")}{" "}
                      đ
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Số người vào:
                    </span>
                    <Badge className="bg-red-500 text-white px-4 py-1.5 flex gap-2 items-center border-none font-black text-sm shadow-sm">
                      <User size={16} /> {ticketInfo.ticket_count} VÉ
                    </Badge>
                  </div>
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
                        Hết hạn
                      </p>
                      <p className="text-sm font-semibold text-red-500">
                        {formatDate(ticketInfo.expiry_date)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Thông tin khách hàng Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <Card className="md:col-span-4 p-5 flex items-center gap-4 border-slate-100 bg-white shadow-sm">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
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
              <Card className="md:col-span-3 p-5 flex items-center gap-4 border-slate-100 bg-white shadow-sm">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Phone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    SĐT
                  </p>
                  <p className="font-bold text-slate-700">{ticketInfo.phone}</p>
                </div>
              </Card>
              <Card className="md:col-span-5 p-5 flex items-center gap-4 border-slate-100 bg-white shadow-sm">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Mail size={20} />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Email (Dùng để check tại quầy)
                  </p>
                  <p className="font-bold text-slate-700 break-all">
                    {ticketInfo.email}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          {/* Right Sidebar: Status & Payment */}
          <div className="lg:col-span-4 space-y-6">
            <Card
              className={`border-2 transition-all ${ticketInfo.valid ? "border-green-500 bg-green-50/10" : "border-slate-200 shadow-lg"} ${ticketInfo.is_used ? "bg-slate-50" : ""}`}
            >
              <CardContent className="p-8 text-center space-y-6">
                <div className="space-y-2">
                  <h2
                    className={`text-3xl font-black uppercase tracking-tighter ${ticketInfo.valid ? "text-green-600" : "text-slate-400"}`}
                  >
                    {ticketInfo.valid
                      ? "VÉ HỢP LỆ"
                      : ticketInfo.is_used
                        ? "VÉ ĐÃ DÙNG"
                        : "KHÔNG HỢP LỆ"}
                  </h2>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Mã vé (Booking Code)
                    </span>
                    <span
                      className={`text-4xl font-mono font-bold ${ticketInfo.is_used ? "text-slate-300 line-through decoration-slate-400/50" : "text-blue-600"}`}
                    >
                      {ticketInfo.booking_code}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  {ticketInfo.payment_status !== "paid" ? (
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={useLoading}
                      className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-lg font-black uppercase shadow-lg shadow-amber-200"
                    >
                      Xác nhận thanh toán
                    </Button>
                  ) : ticketInfo.can_use && !ticketInfo.is_used ? (
                    <Button
                      onClick={handleConfirmUse}
                      disabled={useLoading}
                      className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg font-black uppercase shadow-lg shadow-green-200"
                    >
                      Xác nhận cho vào cổng
                    </Button>
                  ) : (
                    /* Trạng thái đã sử dụng màu đen mờ */
                    <div className="py-5 px-6 rounded-2xl bg-black/5 text-slate-400 font-bold italic border border-black/5 flex flex-col gap-1">
                      <span className="text-xl uppercase not-italic">
                        Đã sử dụng vào cổng
                      </span>
                      <span className="text-[10px] font-medium opacity-60">
                        Vé này đã quét check-in trước đó
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white overflow-hidden relative shadow-xl">
              <div className="absolute -top-4 -right-4 opacity-10">
                <CheckCircle2 className="w-32 h-32" />
              </div>
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
                  <span className="text-4xl font-black text-green-400 leading-none tracking-tighter">
                    {Number(ticketInfo.total_price).toLocaleString("vi-VN")}
                    <span className="text-base ml-1 font-bold">đ</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
