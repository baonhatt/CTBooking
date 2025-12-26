import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTransactionById, getTickets } from "@/lib/api";
import {
  CheckCheck,
  CheckIcon,
  Copy,
  TicketIcon,
  UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Tx {
  id: string;
  userId?: number | null;
  transactionId: string;
  email: string;
  userName: string;
  ticket_package_name: string;
  ticketCount: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  is_used: boolean;
  createdAt: Date;
  expired: boolean;
}
interface Metrics {
  totalUsers: number;
  totalMovies: number;
  revenueTotal: number;
  revenueCount: number;
  avgRevenuePerUser: number;
  totalToys: number;
  totalTransactions: number;
}
interface Props {
  data: Tx[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  txQuery: string;
  setTxQuery: (q: string) => void;
  metrics: Metrics;
  transactionsLength: number;
  onRefresh: () => void;
  txStatus?: "paid" | "all";
  setTxStatus?: (status: "paid" | "all") => void;
  sortKey?: "created_at" | "paid_at";
  sortDir?: "asc" | "desc";
  setSortKey?: (k: "created_at" | "paid_at") => void;
  setSortDir?: (d: "asc" | "desc") => void;
  paymentMethod?: string;
  setPaymentMethod?: (m: string) => void;
  fromDate?: string;
  toDate?: string;
  setFromDate?: (v: string) => void;
  setToDate?: (v: string) => void;
  isLoading?: boolean;
}

export default function TransactionsContent({
  data,
  totalPages,
  currentPage,
  setPage,
  txQuery,
  setTxQuery,
  metrics,
  transactionsLength,
  onRefresh,
  txStatus = "paid",
  setTxStatus,
  sortKey = "created_at",
  sortDir = "desc",
  setSortKey = () => {},
  setSortDir = () => {},
  paymentMethod = "",
  setPaymentMethod = () => {},
  fromDate = "",
  toDate = "",
  setFromDate = () => {},
  setToDate = () => {},
  isLoading = false,
}: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [selectedTxSummary, setSelectedTxSummary] = useState<Tx | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  useEffect(() => {
    if (isDetailsOpen && selectedTxId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          if (!allTickets.length) {
            try {
              const { items } = await getTickets({ page: 1, pageSize: 200 });
              setAllTickets(items || []);
            } catch {}
          }
          const details = await getTransactionById(selectedTxId);
          setTxDetails(details);
        } catch (err) {
          setDetailsError("Không thể tải thông tin giao dịch");
          console.error("Lỗi load transaction details:", err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedTxId]);

  const handleViewDetails = (tx: Tx) => {
    setSelectedTxId(Number(tx.id));
    setSelectedTxSummary(tx);
    setIsDetailsOpen(true);
  };
  const SectionHeader = ({ color, title, icon }) => (
    <div className={`flex items-center gap-2 ${color} mb-2`}>
      {icon}
      <h3 className="font-bold uppercase text-xs tracking-widest">{title}</h3>
    </div>
  );

  // Thêm dấu "?" sau tên các thuộc tính để TypeScript hiểu chúng không bắt buộc
  const InfoRow = ({
    label,
    value,
    color = "text-gray-800",
    bold,
    large,
  }: {
    label: string;
    value: any;
    color?: string;
    bold?: boolean;
    large?: boolean; // Thêm dấu ? ở đây
  }) => (
    <div>
      <p className="text-[10px] text-gray-400 uppercase font-bold leading-tight">
        {label}
      </p>
      <p
        className={`
      ${large ? "text-2xl font-black" : "text-sm"} 
      ${bold ? "font-bold" : "font-medium"} 
      ${color} mt-0.5
    `}
      >
        {value || "---"}
      </p>
    </div>
  );

  const TicketStatusBadge = ({ paymentStatus, isUsed }) => {
    if (paymentStatus === "pending") {
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200 py-1">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse" />{" "}
          CHỜ THANH TOÁN
        </Badge>
      );
    }
    if (isUsed) {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-1 font-bold">
          ĐÃ SỬ DỤNG
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 py-1 font-bold">
        SẴN SÀNG SỬ DỤNG
      </Badge>
    );
  };

  const formatDate = (date, onlyDate = false) => {
    if (!date) return "---";
    const d = new Date(date);
    return onlyDate ? d.toLocaleDateString("vi-VN") : d.toLocaleString("vi-VN");
  };
  const CopyableText = ({ text, label }: { text: string; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      if (!text) return;
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Đã sao chép ${label || ""}`);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        onClick={handleCopy}
        className="group flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all"
      >
        <span className="font-mono">{text}</span>
        {copied ? (
          <CheckCheck size={14} className="text-emerald-500" />
        ) : (
          <Copy
            size={14}
            className="text-slate-400 group-hover:text-blue-500"
          />
        )}
      </div>
    );
  };
  return (
    <div className="space-y-6">
      <Card className="shadow-md border-none">
        <CardHeader className="border-b bg-gray-50/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                Lịch Sử Giao Dịch
                <Badge variant="secondary" className="rounded-full">
                  {transactionsLength}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Quản lý và đối soát thông tin đặt vé hệ thống.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Làm Mới
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Thanh công cụ Bộ lọc (Toolbar) */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[300px]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <Input
                placeholder="Tìm email hoặc mã giao dịch..."
                value={txQuery}
                onChange={(e) => setTxQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <select
              value={txStatus}
              onChange={(e) => setTxStatus?.(e.target.value as any)}
              className="h-10 px-3 border rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40"
            >
              <option value="paid">Đã thanh toán</option>
              <option value="all">Tất cả trạng thái</option>
            </select>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod?.(e.target.value)}
              className="h-10 px-3 border rounded-md bg-white text-sm w-44"
            >
              <option value="">Tất cả phương thức</option>
              <option value="cash">Tiền mặt</option>
              <option value="momo">MoMo</option>
              <option value="vnpay">VNPay</option>
              <option value="vietqr">VietQR</option>
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="h-10 px-3 border rounded-md bg-white text-sm w-48"
            >
              <option value="created_at">Thời gian tạo</option>
              <option value="paid_at">Thời gian thanh toán</option>
            </select>

            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
              className="h-10 px-3 border rounded-md bg-white text-sm w-32"
            >
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-600 hover:bg-red-50 h-10 px-3 flex items-center gap-2 border border-dashed border-gray-200"
              onClick={() => {
                setTxQuery("");
                setTxStatus?.("paid");
                setSortKey?.("created_at");
                setSortDir?.("desc");
                setPaymentMethod?.("");
                setFromDate?.("");
                setToDate?.("");
                setPage(1);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Xóa Bộ Lọc
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 w-fit">
            <span className="text-xs font-bold uppercase text-gray-400">
              Khoảng thời gian:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Từ</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate?.(e.target.value)}
                className="w-40 h-9 bg-white"
              />
              <span className="text-sm text-gray-500 font-medium">Đến</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate?.(e.target.value)}
                className="w-40 h-9 bg-white"
              />
            </div>
          </div>

          {/* Bảng dữ liệu đã tối ưu cột */}
          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold w-[80px]">ID</TableHead>
                  <TableHead className="font-bold">Khách Hàng</TableHead>
                  <TableHead className="font-bold">Vé</TableHead>
                  <TableHead className="font-bold text-center">Số Vé</TableHead>
                  <TableHead className="font-bold">Tổng Tiền</TableHead>
                  <TableHead className="font-bold text-center">
                    Thanh Toán
                  </TableHead>
                  <TableHead className="font-bold">Trạng Thái Vé</TableHead>
                  <TableHead className="font-bold text-right">
                    Hành Động
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={`sk-${idx}`}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-10 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data.map((t) => {
                      // 1. Tối ưu logic xác định trạng thái hiển thị
                      const getStatusConfig = () => {
                        // Trường hợp 1: Thanh toán thất bại/Đã hủy
                        if (t.paymentStatus === "failed") {
                          return {
                            text: "Đã Hủy",
                            style: "border-red-200 bg-red-50 text-red-700",
                            ticketText: "Đã Hủy",
                            ticketStyle:
                              "bg-red-100 text-red-700 border-red-200 animate-pulse",
                          };
                        }

                        // Trường hợp 2: Chờ thanh toán
                        if (t.paymentStatus === "pending") {
                          return {
                            text: "Chờ Thanh Toán",
                            style:
                              "border-amber-200 bg-amber-50 text-amber-700",
                            ticketText: "Chờ Thanh Toán",
                            ticketStyle:
                              "bg-orange-100 text-orange-700 border-orange-200",
                          };
                        }

                        // Trường hợp 3: Đã thanh toán (Cần check thêm expired và is_used)
                        if (t.paymentStatus === "paid") {
                          // Ưu tiên check Hết hạn trước
                          if (!t.is_used && t.expired) {
                            return {
                              text: "Đã Thanh Toán",
                              style:
                                "border-emerald-200 bg-emerald-50 text-emerald-700",
                              ticketText: "Hết Hạn Sử Dụng",
                              ticketStyle:
                                "bg-gray-500 text-white border-gray-600", // Màu xám đậm/đen để tách biệt hẳn
                            };
                          }

                          return {
                            text: "Đã Thanh Toán",
                            style:
                              "border-emerald-200 bg-emerald-50 text-emerald-700",
                            ticketText: t.is_used
                              ? "Đã Sử Dụng"
                              : "Chưa Sử Dụng",
                            ticketStyle: t.is_used
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-emerald-100 text-emerald-700 border-emerald-200",
                          };
                        }

                        return {
                          text: "N/A",
                          style: "bg-gray-100 text-gray-400",
                          ticketText: "N/A",
                          ticketStyle: "bg-gray-100 text-gray-400",
                        };
                      };

                      const config = getStatusConfig();

                      return (
                        <TableRow
                          key={t.id}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <TableCell className="font-mono text-xs text-gray-500">
                            #{t.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm text-gray-900">
                                {t.userName || "Khách Vãng Lai"}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {t.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate font-medium text-sm">
                            {t.ticket_package_name}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {t.ticketCount}
                          </TableCell>
                          <TableCell className="font-bold text-blue-700">
                            {t.totalPrice.toLocaleString("vi-VN")}đ
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold uppercase text-gray-400">
                                {t.paymentMethod}
                              </span>
                              <Badge
                                variant="outline"
                                className={`${config.style} px-2 py-0 h-5 text-[10px] font-medium`}
                              >
                                {config.text}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`${config.ticketStyle} shadow-sm border whitespace-nowrap text-[11px] font-bold`}
                            >
                              {config.ticketText}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(t)}
                              className="h-8 hover:bg-blue-600 hover:text-white transition-all shadow-sm text-xs"
                            >
                              Xem chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground italic">
              Hiển thị {data.length} giao dịch trên trang này.
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.max(1, currentPage - 1));
                    }}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === i + 1}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(Math.min(totalPages, currentPage + 1));
                    }}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* --- MODAL CHI TIẾT GIAO DỊCH (TỐI ƯU TOÀN DIỆN) --- */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {/* Tăng max-w-2xl lên max-w-4xl để không gian rộng rãi, chuyên nghiệp hơn */}
        <DialogContent className="max-w-4xl p-0 border-none shadow-2xl overflow-hidden bg-white flex flex-col max-h-[92vh] [&>button]:hidden">
          {/* HEADER CỐ ĐỊNH */}
          <div className="bg-slate-900 p-5 text-white shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  Chi Tiết Giao Dịch
                </DialogTitle>
                <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-1 italic">
                  ID Hệ thống:
                  <CopyableText
                    text={txDetails?.id?.toString() || ""}
                    label="ID hệ thống"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {txDetails?.payment_info?.payment_status === "paid" && (
                  <div className="bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">
                      Đã thanh toán
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* NỘI DUNG CUỘN */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-500 text-sm italic">
                  Đang tải dữ liệu...
                </span>
              </div>
            ) : detailsError ? (
              <div className="text-center py-12 bg-red-50/50 rounded-lg border border-red-100 m-4">
                <p className="text-red-600 italic text-sm">{detailsError}</p>
              </div>
            ) : txDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cột 1: Khách Hàng */}
                  <div className="space-y-3">
                    <SectionHeader
                      color="text-blue-600"
                      title="Khách Hàng"
                      icon={<UserIcon size={14} />}
                    />
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 shadow-sm">
                      <InfoRow
                        label="Họ và Tên"
                        value={txDetails.user?.fullname}
                        bold
                      />
                      <InfoRow
                        label="Email"
                        value={txDetails.user?.email}
                        color="text-blue-600"
                      />
                      <InfoRow
                        label="Email Tài Khoản"
                        value={
                          txDetails.user?.email_auth
                            ? txDetails.user?.email_auth
                            : "VÃNG LAI"
                        }
                        color="text-red-600"
                      />
                      <div className="flex justify-between items-end border-t border-slate-200/60 pt-2">
                        <InfoRow
                          label="Số điện thoại"
                          value={txDetails.user?.phone}
                        />
                        <Badge
                          variant={
                            txDetails.user?.is_active
                              ? "default"
                              : "destructive"
                          }
                          className="text-[9px] h-4"
                        >
                          {txDetails.user?.is_active ? "Hoạt động" : "Vô hiệu"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Gói & Phim */}
                  <div className="space-y-3">
                    <SectionHeader
                      color="text-amber-600"
                      title="Gói & Phim"
                      icon={<TicketIcon size={14} />}
                    />
                    <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-100 space-y-3 shadow-sm">
                      <div className="flex justify-between">
                        <InfoRow
                          label="Loại Vé"
                          value={txDetails.ticket_package?.name}
                          bold
                        />
                        <span className="text-[13px] font-bold text-slate-600">
                          {txDetails.ticket_package?.ticket_unit_price?.toLocaleString()}
                          đ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 border-t border-amber-200/30 pt-2 min-h-[40px]">
                        {txDetails.ticket_package?.movies?.map((m: any) => (
                          <Badge
                            key={m.id}
                            variant="outline"
                            className="bg-white text-[9px] border-amber-200 text-amber-800"
                          >
                            {m.title}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex justify-between items-end border-t border-amber-200/30 pt-2">
                        <InfoRow
                          label="Số lượng"
                          value={txDetails.booking_details?.ticket_count}
                          large
                          color="text-amber-700"
                        />
                        <div className="text-right">
                          <p className="text-[9px] text-amber-600 uppercase font-bold">
                            Tổng tiền
                          </p>
                          <p className="text-2xl font-black text-emerald-700">
                            {txDetails.booking_details?.total_price?.toLocaleString()}
                            đ
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phần 3: Trạng thái & Đối soát */}
                <div className="space-y-3">
                  <SectionHeader
                    color="text-emerald-600"
                    title="Đối Soát & Trạng Thái"
                    icon={<CheckIcon size={14} />}
                  />
                  <div
                    className={`bg-white rounded-xl border shadow-sm divide-y divide-slate-100 overflow-hidden ${
                      txDetails.payment_info?.expired
                        ? "border-red-200"
                        : "border-slate-200"
                    }`}
                  >
                    {/* Hàng 1: Trạng thái và Check-in */}
                    <div
                      className={`flex justify-between p-4 items-center ${
                        txDetails.payment_info?.expired
                          ? "bg-red-50/30"
                          : "bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* LOGIC MỚI: Ưu tiên hiển thị Đã quá hạn nếu expired = true và chưa dùng */}
                        {txDetails.payment_info?.expired &&
                        !txDetails.booking_details?.is_used ? (
                          <Badge
                            variant="destructive"
                            className="bg-red-600 uppercase text-[10px] animate-pulse"
                          >
                            Đã quá hạn
                          </Badge>
                        ) : (
                          <TicketStatusBadge
                            paymentStatus={
                              txDetails.payment_info?.payment_status
                            }
                            isUsed={txDetails.booking_details?.is_used}
                          />
                        )}
                      </div>

                      {txDetails.booking_details?.is_used ? (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            Thời điểm sử dụng
                          </p>
                          <p className="text-[12px] font-bold text-blue-600 italic">
                            {formatDate(
                              txDetails.booking_details.checked_in_at,
                            )}
                          </p>
                        </div>
                      ) : (
                        txDetails.payment_info?.expired && (
                          <div className="text-right text-red-600">
                            <p className="text-[10px] uppercase font-bold opacity-70">
                              Trạng thái vé
                            </p>
                            <p className="text-[11px] font-bold italic">
                              Vô hiệu hóa do hết hạn
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {/* Hàng 2: Mã đặt chỗ & Đối soát */}
                    <div className="grid grid-cols-1 md:grid-cols-3 p-4 gap-6">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Phương thức
                        </p>
                        <span className="text-[13px] font-bold text-slate-700 uppercase">
                          {txDetails.payment_info?.payment_method}
                        </span>
                      </div>

                      <div className="md:border-x md:px-6">
                        <p className="text-[10px] text-blue-500 uppercase font-bold mb-1 italic">
                          Mã đặt chỗ (Booking Code)
                        </p>
                        <div
                          className={`flex items-center gap-2 ${
                            txDetails.payment_info?.expired &&
                            !txDetails.booking_details?.is_used
                              ? "opacity-40 grayscale pointer-events-none" // Làm mờ và chặn tương tác khi hết hạn
                              : ""
                          }`}
                        >
                          {txDetails.booking_details?.booking_code && (
                            <CopyableText
                              text={txDetails.booking_details.booking_code}
                              label="mã đặt chỗ"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Nội dung chuyển khoản (Đối soát)
                        </p>
                        <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 text-[11px] font-mono">
                          <CopyableText
                            text={
                              txDetails.booking_details?.pay_txt_code ||
                              txDetails.booking_details?.transaction_id ||
                              ""
                            }
                            label="nội dung đối soát"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 3: Timeline */}
                    <div className="grid grid-cols-4 p-4 gap-2 bg-slate-50/30 text-center">
                      <InfoRow
                        label="Ngày tạo"
                        value={formatDate(
                          txDetails.booking_details?.created_at,
                        )}
                      />
                      <InfoRow
                        label="Thanh toán"
                        value={formatDate(txDetails.payment_info?.paid_at)}
                      />
                      <InfoRow
                        label="Hạn dùng"
                        value={formatDate(txDetails.payment_info?.expiry_date)}
                        color="text-red-500"
                      />
                      <InfoRow
                        label="Còn lại"
                        value={
                          txDetails.payment_info?.expired
                            ? "Đã hết hạn sử dụng"
                            : txDetails.payment_info?.days_left === 0
                              ? "Hết hạn hôm nay"
                              : txDetails.payment_info?.days_left === null
                                ? "---"
                                : `${txDetails.payment_info?.days_left} ngày`
                        }
                        color={
                          txDetails.payment_info?.expired
                            ? "text-red-600 font-black"
                            : (txDetails.payment_info?.days_left ?? 0) <= 2
                              ? "text-orange-500"
                              : "text-emerald-600"
                        }
                        bold
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* FOOTER CỐ ĐỊNH */}
          <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
              className="h-10 px-10 border-slate-300 hover:bg-white font-bold text-xs uppercase"
            >
              Đóng cửa sổ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
