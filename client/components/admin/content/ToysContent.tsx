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
import { Switch } from "@/components/ui/switch";
import { Search, RefreshCw, Edit3, Trash2, Plus, Package } from "lucide-react";
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
  showActiveOnly?: boolean;
  setShowActiveOnly?: (v: boolean) => void;
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
  showActiveOnly = false,
  setShowActiveOnly = () => { },
}: Props) {
  const handleDelete = async (id: number) => {
    try {
      // Soft delete: update status to inactive instead of deleting
      const response = await fetch(`/api/toys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      if (!response.ok) throw new Error("Failed to update toy status");

      // Update local state
      setToys((prev) => prev.map((toy) =>
        toy.id === id ? { ...toy, status: "inactive" } : toy
      ));
    } catch (e: any) {
      alert(e?.message || "Lỗi cập nhật trạng thái đồ chơi");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900">Quản lý đồ chơi</h3>
          <p className="text-xs text-slate-500">Tổng cộng {toysLength} sản phẩm trong kho</p>
        </div>
        <div className="flex flex-1 w-full md:max-w-xl gap-2 ml-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm đồ chơi theo tên hoặc danh mục..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                Chỉ hiện khả dụng
              </span>
              <Switch
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
                className="scale-75 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 cursor-pointer"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 flex items-center justify-center bg-white border-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={onCreate}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 gap-2 text-white font-bold h-10 px-4"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </Button>
          </div>
        </div>
      </div>
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-16 text-center text-[10px] uppercase font-bold text-slate-400">ID</TableHead>
                <TableHead className="w-16 text-[10px] uppercase font-bold text-slate-500">Ảnh</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Sản phẩm</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Phân loại</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Đơn giá</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Tồn kho</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Trạng Thái</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={`sk-${idx}`}>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 rounded-lg" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center h-32 text-muted-foreground italic"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="opacity-20" />
                      <span>Không có đồ chơi nào trong kho</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((x) => (
                  <TableRow key={x.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-slate-500">
                      #{x.id}
                    </TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                        {x.image_url ? (
                          <img src={x.image_url} alt={x.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={16} className="text-slate-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-slate-700">{x.name}</TableCell>
                    <TableCell>
                      {x.category ? (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                          {x.category}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">---</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-blue-600">
                      {x.price.toLocaleString("vi-VN")}đ
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${x.stock === 0 ? "text-red-500" : "text-slate-700"}`}>
                        {x.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {x.status === "active" ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                          Đã ẩn
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit("toy", x)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit3 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(x.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
