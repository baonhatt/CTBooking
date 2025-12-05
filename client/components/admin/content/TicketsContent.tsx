import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createTicketApi, updateTicketApi } from "@/lib/api";

interface TicketPackage {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  type?: string;
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
}

interface Props {
  data: TicketPackage[];
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onCreate: () => void;
  onEdit: (data: TicketPackage) => void;
  setTickets: React.Dispatch<React.SetStateAction<TicketPackage[]>>;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  onRefresh: () => Promise<void>;
  deleteTicketApi: (id: number) => Promise<any>;
}

export default function TicketsContent(props: Props) {
  const { toast } = useToast();
  const {
    data,
    totalPages,
    currentPage,
    setPage,
    onCreate,
    onEdit,
    setTickets,
    isEditOpen,
    setIsEditOpen,
    editData,
    setEditData,
    onRefresh,
    deleteTicketApi,
  } = props;

  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Gói vé</CardTitle>
          <div className="flex gap-2">
            <Button onClick={onCreate}>Thêm gói vé</Button>
            <Button variant="outline" onClick={onRefresh}>Làm mới</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Thứ tự</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.type || ""}</TableCell>
                  <TableCell>{Number(t.price).toLocaleString("vi-VN")} đ</TableCell>
                  <TableCell>{t.display_order ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Hoạt động" : "Đã ẩn"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(t)}>Sửa</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingId === t.id}
                      onClick={async () => {
                        try {
                          setIsDeletingId(t.id);
                          await deleteTicketApi(t.id);
                          setTickets((prev) => prev.filter((x) => x.id !== t.id));
                          toast({ title: "Thành công", description: "Xóa gói vé thành công" });
                        } finally {
                          setIsDeletingId(null);
                        }
                      }}
                    >
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination className="mt-3">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.max(1, currentPage - 1));
                  }}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
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
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editData?.id ? "Chỉnh sửa gói vé" : "Thêm gói vé"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên gói</Label>
              <Input
                value={editData?.name || ""}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Mã</Label>
              <Input
                value={editData?.code || ""}
                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
              />
            </div>
            <div>
              <Label>Loại</Label>
              <Input
                value={editData?.type || ""}
                onChange={(e) => setEditData({ ...editData, type: e.target.value })}
              />
            </div>
            <div>
              <Label>Mô tả</Label>
              <textarea
                value={editData?.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full h-24 border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <Label>Giá</Label>
              <Input
                type="text"
                value={editData?.price !== undefined && editData?.price !== null ? Number(editData.price).toLocaleString("en-US") : ""}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/,/g, ""));
                  setEditData({ ...editData, price: isNaN(v) ? 0 : v });
                }}
              />
            </div>
            <div>
              <Label>Tính năng (phân tách bằng dấu phẩy)</Label>
              <Input
                value={editData?.features || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    features: e.target.value, // chỉ lưu thẳng chuỗi
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nhóm tối thiểu</Label>
                <Input
                  value={editData?.min_group_size ?? ""}
                  onChange={(e) => setEditData({ ...editData, min_group_size: Number(e.target.value || 0) })}
                />
              </div>
              <div>
                <Label>Nhóm tối đa</Label>
                <Input
                  value={editData?.max_group_size ?? ""}
                  onChange={(e) => setEditData({ ...editData, max_group_size: Number(e.target.value || 0) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Thứ tự hiển thị</Label>
                <Input
                  value={editData?.display_order ?? 0}
                  onChange={(e) => setEditData({ ...editData, display_order: Number(e.target.value || 0) })}
                />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <select
                  value={editData?.is_active ? "active" : "inactive"}
                  onChange={(e) => setEditData({ ...editData, is_active: e.target.value === "active" })}
                  className="w-full h-10 border rounded-md px-3"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Đã ẩn</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
              <Button
                onClick={async () => {
                  try {
                    if (!editData?.id) {
                      await createTicketApi({
                        name: editData.name,
                        code: editData.code,
                        description: editData.description,
                        price: Number(editData.price || 0),
                        features: editData.features || [],
                        type: editData.type,
                        min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                        max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                        is_member_only: !!editData.is_member_only,
                        is_active: !!editData.is_active,
                        display_order: editData.display_order ? Number(editData.display_order) : 0,
                      });
                    } else {
                      await updateTicketApi(Number(editData.id), {
                        name: editData.name,
                        code: editData.code,
                        description: editData.description,
                        price: Number(editData.price || 0),
                        features: editData.features || [],
                        type: editData.type,
                        min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                        max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                        is_member_only: !!editData.is_member_only,
                        is_active: !!editData.is_active,
                        display_order: editData.display_order ? Number(editData.display_order) : 0,
                      });
                    }
                    await onRefresh();
                    toast({ title: "Thành công", description: editData?.id ? "Cập nhật gói vé thành công" : "Thêm gói vé thành công" });
                  } finally {
                    setIsEditOpen(false);
                  }
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
