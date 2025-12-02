import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

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

interface MoviesContentProps {
  data: MovieData[];
  totalPages: number;
  currentPage: number;
  setPage: (page: number) => void;
  movieStatus: Record<string, "active" | "inactive">;
  onEdit: (type: "movie", data: any) => void;
  onCreate: () => void;
  moviesLength: number;
  formatLocalDateTime: (date: Date) => React.ReactNode;
}

const MoviesContent: React.FC<MoviesContentProps> = ({ data, totalPages, currentPage, setPage, movieStatus, onEdit, onCreate, moviesLength, formatLocalDateTime }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tổng cộng: {moviesLength} phim</h3>
        <Button onClick={onCreate}>
          + Thêm phim mới
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tên phim</TableHead>
                <TableHead>Thể loại</TableHead>
                <TableHead>Thời lượng</TableHead>
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
                    {/* 1. Thêm thẻ ảnh (Image Tag) */}
                    {movie.posterUrl && (
                      <img
                        src={movie.posterUrl}
                        alt={`Poster ${movie.title}`}
                        className="w-20 h-15 object-cover rounded shadow-md"
                        loading="lazy"
                      />
                    )}
                    {/* 2. Tên phim */}
                    <span className="font-medium">{movie.title}</span>
                  </TableCell>
                  <TableCell>{movie.genres.join(", ")}</TableCell>
                  <TableCell>{movie.duration}</TableCell>
                  <TableCell>{movie.price.toLocaleString('en-US')}</TableCell>
                  <TableCell>{movie.rating ?? ""}</TableCell>
                  <TableCell>
                    {movie.release_date ? formatLocalDateTime(new Date(movie.release_date)) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={movieStatus[movie.id] === "active" ? "default" : "secondary"}>
                      {movieStatus[movie.id] === "active" ? "Đang chiếu" : "Đã ẩn"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onEdit("movie", {
                      ...movie,
                      status: movieStatus[movie.id] || "active"
                    })}>
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
            {/* Nút Trước (Previous) */}
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)); }}
              aria-disabled={currentPage === 1}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>

          {/* Các số trang */}
          {Array.from({ length: totalPages }).map((_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={currentPage === i + 1}
                onClick={(e) => { e.preventDefault(); setPage(i + 1); }}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            {/* Nút Sau (Next) */}
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, currentPage + 1)); }}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export default MoviesContent;