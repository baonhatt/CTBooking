import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

interface ToyData {
  id: number;
  name: string;
  category?: string;
  price: number;
  stock: number;
  status: string;
  image_url?: string;
}

interface ToysContentProps {
  data: ToyData[];
  totalPages: number;
  currentPage: number;
  setPage: (page: number) => void;
  onEdit: (type: "toy", data: ToyData) => void;
  onCreate: () => void;
  toysLength: number;
  deleteToyApi: (id: number) => Promise<any>;
  setToys: React.Dispatch<React.SetStateAction<ToyData[]>>;
}

const ToysContent: React.FC<ToysContentProps> = ({ data, totalPages, currentPage, setPage, onEdit, onCreate, toysLength, deleteToyApi, setToys }) => {

  const handleDelete = async (id: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa đồ chơi này không?")) {
      try {
        await deleteToyApi(id);
        setToys(prev => prev.filter(t => t.id !== id));
      } catch (e: any) {
        alert(e?.message || "Lỗi xóa đồ chơi");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tổng cộng: {toysLength} đồ chơi</h3>
        <Button onClick={onCreate}>
          + Thêm đồ chơi mới
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Ảnh</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Tồn kho</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((toy) => (
                <TableRow key={toy.id}>
                  <TableCell className="font-medium w-16">{toy.id}</TableCell>
                  <TableCell>
                    {toy.image_url && <img src={toy.image_url} alt={toy.name} className="h-10 w-10 object-cover rounded" />}
                  </TableCell>
                  <TableCell>{toy.name}</TableCell>
                  <TableCell>{toy.category}</TableCell>
                  <TableCell>{toy.price.toLocaleString('en-US')}</TableCell>
                  <TableCell>{toy.stock.toLocaleString('en-US')}</TableCell>
                  <TableCell>
                    <Badge variant={toy.status === "active" ? "default" : "secondary"}>
                      {toy.status === "active" ? "Kinh doanh" : "Ngừng bán"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit("toy", toy)}>
                      Sửa
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(toy.id)}>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ToysContent;