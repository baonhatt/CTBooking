import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface ShowtimeData {
  id: number;
  movie_id: number;
  movie_title: string;
  start_time: string;
  price: number;
  total_sold: number;
}

interface ShowtimesContentProps {
  data: ShowtimeData[];
  onEdit: (type: "showtime", data: ShowtimeData) => void;
  onCreate: () => void;
  formatLocalDateTime: (date: Date) => React.ReactNode;
  deleteShowtimeApi: (id: number) => Promise<any>;
  setShowtimes: React.Dispatch<React.SetStateAction<ShowtimeData[]>>;

  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

const ShowtimesContent: React.FC<ShowtimesContentProps> = ({ data, onEdit, onCreate, formatLocalDateTime, deleteShowtimeApi, setShowtimes, totalPages, currentPage, setPage }) => {
  const handleDelete = async (id: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa suất chiếu này không?")) {
      try {
        await deleteShowtimeApi(id);
        setShowtimes(prev => prev.filter(s => s.id !== id));
      } catch (e: any) {
        alert(e?.message || "Lỗi xóa suất chiếu");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tổng cộng: {data.length} suất chiếu</h3>
        <Button onClick={onCreate}>
          + Thêm suất chiếu mới
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Phim</TableHead>
                <TableHead>Thời gian chiếu</TableHead>
                <TableHead>Giá vé</TableHead>
                <TableHead>Vé đã bán</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((showtime) => (
                <TableRow key={showtime.id}>
                  <TableCell className="font-medium">{showtime.id}</TableCell>
                  <TableCell>{showtime.movie_title}</TableCell>
                  <TableCell>
                    {formatLocalDateTime(new Date(showtime.start_time))}
                  </TableCell>
                  <TableCell>{showtime.price.toLocaleString('en-US')}</TableCell>
                  <TableCell>{showtime.total_sold}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit("showtime", showtime)}>
                      Sửa
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(showtime.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                {/* Nút Trước (Previous) */}
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)); }}
                  // Sửa lỗi TypeScript/UI bằng cách dùng aria-disabled và class
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
                  // Sửa lỗi TypeScript/UI bằng cách dùng aria-disabled và class
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShowtimesContent;