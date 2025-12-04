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
import { getMovieById } from "@/lib/api";

interface MovieData {
  id: string;
  title: string;
  year: number;
  duration: string;
  genres: string[];
  posterUrl: string;
  release_date: string | null;
  rating: number | null;
  price: number;
}
interface Props {
  data: MovieData[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  movieStatus: Record<string, "active" | "inactive">;
  onEdit: (type: "movie", data: any) => void;
  onCreate: () => void;
  moviesLength: number;
  formatLocalDateTime: (date: Date) => React.ReactNode;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function MoviesContent({
  data,
  totalPages,
  currentPage,
  setPage,
  movieStatus,
  onEdit,
  onCreate,
  moviesLength,
  formatLocalDateTime,
  onRefresh,
  searchQuery = "",
  onSearchChange = () => { },
}: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (isDetailsOpen && selectedMovieId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          const details = await getMovieById(selectedMovieId);
          setMovieDetails(details);
        } catch (err) {
          setDetailsError("Không thể tải thông tin phim");
          console.error("Lỗi load movie details:", err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedMovieId]);

  const handleViewDetails = (movieId: number) => {
    setSelectedMovieId(movieId);
    setIsDetailsOpen(true);
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm phim theo tên hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <h3 className="text-lg font-semibold whitespace-nowrap">
          Tổng: {moviesLength}
        </h3>
        <div className="flex gap-2">
          <Button onClick={onRefresh} variant="outline">
            ↻ Refresh
          </Button>
          <Button onClick={onCreate}>+ Thêm phim mới</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tên phim</TableHead>
                <TableHead>Thể loại</TableHead>
                <TableHead>Thời lượng(phút)</TableHead>
                <TableHead>Giá vé TB</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Ngày ra mắt</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((movie) => (
                <TableRow key={movie.id}>
                  <TableCell className="font-medium w-16">{movie.id}</TableCell>
                  <TableCell className="flex items-center space-x-3">
                    {movie.posterUrl && (
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-20 h-15 object-cover rounded shadow-md"
                        loading="lazy"
                      />
                    )}
                    <span className="font-medium">{movie.title}</span>
                  </TableCell>
                  <TableCell>{movie.genres.join(", ")}</TableCell>
                  <TableCell>{movie.duration}</TableCell>
                  <TableCell>{movie.price.toLocaleString("en-US")}</TableCell>
                  <TableCell>{movie.rating ?? ""}</TableCell>
                  <TableCell>
                    {movie.release_date
                      ? formatLocalDateTime(new Date(movie.release_date))
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        movieStatus[movie.id] === "active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {movieStatus[movie.id] === "active"
                        ? "Đang chiếu"
                        : "Đã ẩn"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(Number(movie.id))}
                    >
                      Xem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onEdit("movie", {
                          ...movie,
                          status: movieStatus[movie.id] || "active",
                        })
                      }
                    >
                      Sửa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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

      {/* Movie Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết phim</DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <span>Đang tải...</span>
            </div>
          ) : detailsError ? (
            <div className="text-center py-8 text-red-600">{detailsError}</div>
          ) : movieDetails ? (
            <div className="space-y-6">
              {/* Poster & Basic Info */}
              <div className="flex gap-4">
                {movieDetails.cover_image && (
                  <img
                    src={movieDetails.cover_image}
                    alt={movieDetails.title}
                    className="w-32 h-48 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">
                    {movieDetails.title}
                  </h2>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-gray-600">Thể loại:</span>{" "}
                      <span className="font-medium">
                        {Array.isArray(movieDetails.genres)
                          ? movieDetails.genres.join(", ")
                          : "N/A"}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Rating:</span>{" "}
                      <span className="font-medium">
                        {movieDetails.rating}/10
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Thời lượng(phút):</span>{" "}
                      <span className="font-medium">
                        {movieDetails.duration_min}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Giá vé:</span>{" "}
                      <span className="font-medium text-blue-600">
                        {movieDetails.price.toLocaleString("vi-VN")}₫
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {movieDetails.description && (
                <div>
                  <h3 className="font-semibold mb-2">Mô tả</h3>
                  <p className="text-sm text-gray-700">
                    {movieDetails.description}
                  </p>
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Tổng suất chiếu</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {movieDetails.stats.totalShowtimes}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Tổng vé đã bán</p>
                  <p className="text-2xl font-bold text-green-600">
                    {movieDetails.stats.totalTicketsSold}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-600">Đơn thanh toán thành công</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {movieDetails.stats.successfulBookings}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Tổng doanh thu</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {movieDetails.stats.totalRevenue.toLocaleString("vi-VN")}₫
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
