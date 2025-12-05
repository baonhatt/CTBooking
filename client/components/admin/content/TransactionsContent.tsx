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
import { getTransactionById } from "@/lib/api";

interface Tx {
  id: string;
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
  totalShowtimes: number;
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
}: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (isDetailsOpen && selectedTxId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
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

  const handleViewDetails = (txId: number) => {
    setSelectedTxId(txId);
    setIsDetailsOpen(true);
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lịch sử giao dịch ({transactionsLength})</CardTitle>
            <button
              onClick={onRefresh}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Input
              placeholder="Tìm kiếm theo email"
              value={txQuery}
              onChange={(e) => setTxQuery(e.target.value)}
            />
            <select
              value={txStatus}
              onChange={(e) => setTxStatus?.(e.target.value as "paid" | "all")}
              className="px-3 py-2 border rounded-md bg-white"
            >
              <option value="paid">Đã thanh toán</option>
              <option value="all">Tất cả giao dịch</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold uppercase">Email</TableHead>
                <TableHead className="font-bold uppercase">Tên</TableHead>
                <TableHead className="font-bold uppercase">Phim</TableHead>
                <TableHead className="font-bold uppercase">Số vé</TableHead>
                <TableHead className="font-bold uppercase">Số tiền</TableHead>
                <TableHead className="font-bold uppercase">
                  Phương thức
                </TableHead>
                <TableHead className="font-bold uppercase">
                  Trạng thái
                </TableHead>
                <TableHead className="font-bold uppercase">
                  Ngày giao dịch
                </TableHead>
                <TableHead className="font-bold uppercase">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
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
                      onClick={() => handleViewDetails(Number(t.id))}
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

              {/* Movie & Showtime Section */}
              <div className="rounded-lg bg-purple-50 p-4 space-y-3">
                <h3 className="font-semibold text-purple-900">Thông tin suất chiếu</h3>
                <div className="flex gap-4">
                  {txDetails.showtime?.movie?.cover_image && (
                    <img
                      src={txDetails.showtime.movie.cover_image}
                      alt={txDetails.showtime.movie.title || "Movie"}
                      className="w-20 h-28 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Phim</p>
                      <p className="font-semibold">{txDetails.showtime?.movie?.title || "N/A"}</p>
                      {txDetails.showtime?.movie?.genres && (
                        <p className="text-xs text-gray-500">
                          {txDetails.showtime?.movie?.genres}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {txDetails.showtime?.movie?.rating !== null && txDetails.showtime?.movie?.rating !== undefined ? (
                        <Badge variant="outline">
                          ⭐ {Number(txDetails.showtime?.movie?.rating).toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">⭐ N/A</Badge>
                      )}
                      <Badge variant="outline">
                        {txDetails.showtime?.movie?.duration_min || "N/A"}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t space-y-1 text-sm">
                      <p>
                        <span className="text-gray-600">Suất chiếu:</span>{" "}
                        <span className="font-medium">
                          {txDetails.showtime?.start_time ? new Date(txDetails.showtime.start_time).toLocaleString("vi-VN") : "N/A"}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-600">Kết thúc:</span>{" "}
                        <span className="font-medium">
                          {txDetails.showtime?.end_time ? new Date(txDetails.showtime.end_time).toLocaleString("vi-VN") : "N/A"}
                        </span>
                      </p>

                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Details Section */}
              <div className="rounded-lg bg-amber-50 p-4 space-y-3">
                <h3 className="font-semibold text-amber-900">Chi tiết đặt vé</h3>
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
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
