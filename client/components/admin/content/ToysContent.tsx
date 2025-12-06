import React from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ToyData {
  id: number;
  name: string;
  category?: string;
  price: number;
  stock: number;
  status: string;
  image_url?: string;
}
interface Props {
  data: ToyData[];
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onEdit: (type: "toy", data: any) => void;
  onCreate: () => void;
  toysLength: number;
  deleteToyApi: (id: number) => Promise<any>;
  setToys: React.Dispatch<React.SetStateAction<ToyData[]>>;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
}

export default function ToysContent({
  data,
  totalPages,
  currentPage,
  setPage,
  onEdit,
  onCreate,
  toysLength,
  deleteToyApi,
  setToys,
  onRefresh,
  searchQuery = "",
  onSearchChange = () => { },
  isLoading = false,
}: Props) {
  const handleDelete = async (id: number) => {
    try {
      await deleteToyApi(id);
      setToys((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      alert(e?.message || "Lỗi xóa đồ chơi");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm đồ chơi theo tên hoặc danh mục..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <h3 className="text-lg font-semibold whitespace-nowrap">
          Tổng: {toysLength}
        </h3>
        <div className="flex gap-2">
          <Button onClick={onRefresh} variant="outline">
            ↻ Refresh
          </Button>
          <Button onClick={onCreate}>+ Thêm đồ chơi</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Tồn kho</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                : data.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.id}</TableCell>
                  <TableCell>{x.name}</TableCell>
                  <TableCell>{x.category || ""}</TableCell>
                  <TableCell>{x.price.toLocaleString("en-US")}</TableCell>
                  <TableCell>{x.stock}</TableCell>
                  <TableCell>{x.status}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit("toy", x)}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(x.id)}
                    >
                      Xóa
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
    </div>
  );
}
