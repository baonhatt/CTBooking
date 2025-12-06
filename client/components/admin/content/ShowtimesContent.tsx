import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getShowtimeById } from "@/lib/api";

interface ShowtimeData {
  id: number;
  movie_id: number;
  movie_title: string;
  start_time: string;
  total_sold: number;
}
interface Props {
  data: ShowtimeData[];
  onEdit: (type: "showtime", data: ShowtimeData) => void;
  onCreate: () => void;
  formatLocalDateTime: (date: Date) => React.ReactNode;
  deleteShowtimeApi: (id: number) => Promise<any>;
  setShowtimes: React.Dispatch<React.SetStateAction<ShowtimeData[]>>;
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  sortKey: "start_time" | "created_at" | "movie_title";
  setSortKey: (k: "start_time" | "created_at" | "movie_title") => void;
  todayOnly: boolean;
  setTodayOnly: (v: boolean) => void;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
}

export default function ShowtimesContent({
  data,
  onEdit,
  onCreate,
  formatLocalDateTime,
  deleteShowtimeApi,
  setShowtimes,
  totalPages,
  currentPage,
  setPage,
  sortKey,
  setSortKey,
  todayOnly,
  setTodayOnly,
  onRefresh,
  searchQuery = "",
  onSearchChange = () => { },
  isLoading = false,
}: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<number | null>(
    null
  );
  const [showtimeDetails, setShowtimeDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (isDetailsOpen && selectedShowtimeId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          const details = await getShowtimeById(selectedShowtimeId);
          setShowtimeDetails(details);
        } catch (err) {
          setDetailsError("Không thể tải thông tin suất chiếu");
          console.error("Lỗi load showtime details:", err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedShowtimeId]);

  const handleViewDetails = (showtimeId: number) => {
    setSelectedShowtimeId(showtimeId);
    setIsDetailsOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteShowtimeApi(id);
      setShowtimes((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      alert(e?.message || "Lỗi xóa suất chiếu");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm suất chiếu theo tên phim..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold whitespace-nowrap">
            Tổng: {data.length}
          </h3>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="border rounded px-2 py-1"
          >
            <option value="start_time">Thời gian chiếu</option>
            <option value="created_at">Thời gian tạo</option>
            <option value="movie_title">Tên phim</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
            />{" "}
            Hôm nay
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} variant="outline">
            ↻ Refresh
          </Button>
          <Button onClick={onCreate}>+ Thêm suất chiếu mới</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Phim</TableHead>
                <TableHead>Thời gian chiếu</TableHead>
                <TableHead>Vé đã bán</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                : data.map((showtime) => {
                const CAPACITY = 100;
                const isFull = showtime.total_sold >= CAPACITY;
                return (
                  <TableRow key={showtime.id}>
                    <TableCell className="font-medium">{showtime.id}</TableCell>
                    <TableCell>{showtime.movie_title}</TableCell>
                    <TableCell>
                      {formatLocalDateTime(new Date(showtime.start_time))}
                    </TableCell>
                    <TableCell>{showtime.total_sold}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isFull
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        }
                      >
                        {isFull ? "FULL" : "Đang chiếu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(showtime.id)}
                      >
                        Xem
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit("showtime", showtime)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(showtime.id)}
                      >
                        Xóa
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      {/* Showtime Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết suất chiếu</DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <span>Đang tải...</span>
            </div>
          ) : detailsError ? (
            <div className="text-center py-8 text-red-600">{detailsError}</div>
          ) : showtimeDetails ? (
            <div className="space-y-6">
              {/* Movie Info */}
              <div className="flex gap-4">
                {showtimeDetails.movie.cover_image && (
                  <img
                    src={showtimeDetails.movie.cover_image}
                    alt={showtimeDetails.movie.title}
                    className="w-24 h-32 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">
                    {showtimeDetails.movie.title}
                  </h2>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600">Thể loại:</span>{" "}
                      {Array.isArray(showtimeDetails.movie.genres)
                        ? showtimeDetails.movie.genres.join(", ")
                        : "N/A"}
                    </p>
                    <p>
                      <span className="text-gray-600">Thời lượng(phút):</span>{" "}
                      {showtimeDetails.movie.duration_min}
                    </p>
                    <p>
                      <span className="text-gray-600">Rating:</span>{" "}
                      {showtimeDetails.movie.rating}/10
                    </p>
                  </div>
                </div>
              </div>

              {/* Showtime Details */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Thông tin suất chiếu</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Thời gian bắt đầu</p>
                    <p className="font-medium">
                      {new Date(showtimeDetails.start_time).toLocaleString(
                        "vi-VN"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Thời gian kết thúc</p>
                    <p className="font-medium">
                      {showtimeDetails.end_time
                        ? new Date(showtimeDetails.end_time).toLocaleString(
                          "vi-VN"
                        )
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tổng vé đã bán</p>
                    <p className="font-medium">
                      {showtimeDetails.total_sold} vé
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Thống kê bán vé</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">Tổng đơn đặt vé</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {showtimeDetails.stats.totalBookings}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Đơn thanh toán thành công</p>
                    <p className="text-2xl font-bold text-green-600">
                      {showtimeDetails.stats.successfulBookings}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-600">Đơn thanh toán thất bại</p>
                    <p className="text-2xl font-bold text-red-600">
                      {showtimeDetails.stats.failedBookings}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600">Tổng vé bán được</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {showtimeDetails.stats.totalTickets} vé
                    </p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 col-span-2">
                    <p className="text-sm text-gray-600">Tổng doanh thu</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {showtimeDetails.stats.totalRevenue.toLocaleString(
                        "vi-VN"
                      )}₫
                    </p>
                  </div>
                </div>
              </div>


            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
