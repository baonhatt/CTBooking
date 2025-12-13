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

interface Tx {
  id: string;
  transactionId: string;
  email: string;
  userName: string;
  movieTitle: string;
  ticketCount: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: Date;
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
  console.log(data);
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
  const unitPrice = (() => {
    const per = txDetails?.booking_details?.price_per_ticket;
    if (per !== undefined && per !== null) return Number(per);
    const total = Number(txDetails?.booking_details?.total_price || 0);
    const count = Math.max(1, Number(txDetails?.booking_details?.ticket_count || 1));
    return total && count ? Math.round(total / count) : 0;
  })();
  const matchedTicket = allTickets.find((t: any) => {
    const p = Number(t?.price || 0);
    return Number.isFinite(p) && Math.round(p) === Math.round(unitPrice || 0);
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lịch Sử Giao Dịch ({transactionsLength})</CardTitle>
            <button
              onClick={onRefresh}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 transition"
            >
              ↻ Làm Mới
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input
              placeholder="Tìm kiếm theo email"
              value={txQuery}
              onChange={(e) => setTxQuery(e.target.value)}
              className="flex-1 min-w-[320px]"
            />
            <select
              value={txStatus}
              onChange={(e) => setTxStatus?.(e.target.value as "paid" | "all")}
              className="px-3 py-2 border rounded-md bg-white w-44"
            >
              <option value="paid">Đã thanh toán</option>
              <option value="all">Tất cả giao dịch</option>
            </select>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod?.(e.target.value)}
              className="px-3 py-2 border rounded-md bg-white w-44"
            >
              <option value="">Tất cả phương thức</option>
              <option value="cash">Tiền mặt</option>
              <option value="momo">MoMo</option>
              <option value="vnpay">VNPay</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="px-3 py-2 border rounded-md bg-white w-52"
            >
              <option value="created_at">Theo thời gian tạo</option>
              <option value="paid_at">Theo thời gian thanh toán</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
              className="px-3 py-2 border rounded-md bg-white w-36"
            >
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
            <Button
              variant="secondary"
              className="ml-auto"
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
              Xóa Bộ Lọc
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-600">Từ</span>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate?.(e.target.value)} className="w-44" />
            <span className="text-sm text-gray-600">Đến</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate?.(e.target.value)} className="w-44" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold">Mã Giao Dịch</TableHead>
                <TableHead className="font-bold">Email</TableHead>
                <TableHead className="font-bold">Tên</TableHead>
                <TableHead className="font-bold">Phim</TableHead>
                <TableHead className="font-bold">Số Vé</TableHead>
                <TableHead className="font-bold">Số Tiền</TableHead>
                <TableHead className="font-bold">
                  Phương Thức
                </TableHead>
                <TableHead className="font-bold">
                  Trạng Thái
                </TableHead>
                <TableHead className="font-bold">
                  Ngày Giao Dịch
                </TableHead>
                <TableHead className="font-bold">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-16" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold text-sm">
                      {t.id}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {t.email}
                    </TableCell>
                    <TableCell>{t.userName || "-"}</TableCell>
                    <TableCell>{t.movieTitle}</TableCell>
                    <TableCell>{t.ticketCount}</TableCell>
                    <TableCell>
                      {t.totalPrice.toLocaleString("vi-VN")} đ
                    </TableCell>
                    <TableCell className="capitalize">
                      {t.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          t.paymentStatus === "paid"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : t.paymentStatus === "pending"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        {t.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.createdAt.toLocaleString("vi-VN")}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(t)}
                    >
                      Xem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.max(1, currentPage - 1));
                  }}
                  aria-disabled={currentPage === 1}
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
                  aria-disabled={currentPage === totalPages}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      {/* Transaction Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết giao dịch</DialogTitle>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <span>Đang tải...</span>
            </div>
          ) : detailsError ? (
            <div className="text-center py-8 text-red-600">{detailsError}</div>
          ) : txDetails ? (
            <div className="space-y-6">
              {/* User Info Section */}
              <div className="rounded-lg bg-blue-50 p-4 space-y-3">
                <h3 className="font-semibold text-blue-900">Thông tin khách hàng</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-600">Tên khách hàng</p>
                    <p className="font-medium">{txDetails.user?.fullname || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-sm">{txDetails.user?.email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Số điện thoại</p>
                    <p className="font-medium">{txDetails.user?.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Trạng thái tài khoản</p>
                    <Badge variant={txDetails.user?.is_active ? "secondary" : "outline"}>
                      {txDetails.user?.is_active ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </div>
                </div>
              </div>


              {/* Booking Details Section */}
              <div className="rounded-lg bg-amber-50 p-4 space-y-3">
                <h3 className="font-semibold text-amber-900">Chi tiết đặt vé</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-600">Phim đã đặt</p>
                    <p className="font-medium">{selectedTxSummary?.movieTitle || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Loại vé</p>
                    <p className="font-medium">
                      {matchedTicket?.name
                        ? matchedTicket.name
                        : unitPrice
                          ? `${unitPrice.toLocaleString("vi-VN")} đ / vé`
                          : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-sm text-gray-600">Số lượng vé</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {txDetails.booking_details?.ticket_count || "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Tổng tiền</p>
                    <p className="text-xl font-bold text-green-600">
                      {txDetails.booking_details?.total_price ? txDetails.booking_details.total_price.toLocaleString("vi-VN") : "N/A"} đ
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Info Section */}
              <div className="rounded-lg bg-green-50 p-4 space-y-3">
                <h3 className="font-semibold text-green-900">Thông tin thanh toán</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phương thức:</span>
                    <span className="font-medium capitalize">{txDetails.payment_info?.payment_method || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trạng thái:</span>
                    <Badge
                      className={
                        txDetails.payment_info?.payment_status === "paid"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : txDetails.payment_info?.payment_status === "pending"
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                      }
                    >
                      {txDetails.payment_info?.payment_status || "N/A"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mã giao dịch:</span>
                    <span className="font-mono text-xs">{txDetails.payment_info?.transaction_id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Thời gian tạo:</span>
                    <span className="font-medium">
                      {txDetails.payment_info?.created_at ? new Date(txDetails.payment_info.created_at).toLocaleString("vi-VN") : "N/A"}
                    </span>
                  </div>
                  {txDetails.payment_info?.paid_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Thời gian thanh toán:</span>
                      <span className="font-medium">
                        {new Date(txDetails.payment_info.paid_at).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  )}
                  {txDetails.payment_info?.expiry_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ngày hết hạn:</span>
                      <span className="font-medium">
                        {new Date(txDetails.payment_info.expiry_date).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  )}
                  {typeof txDetails.payment_info?.days_left === "number" && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Thời gian còn lại:</span>
                      <span className="font-medium">
                        {Math.max(0, Number(txDetails.payment_info.days_left))} ngày
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
