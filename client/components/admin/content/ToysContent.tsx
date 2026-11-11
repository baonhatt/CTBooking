import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw, Plus, Package, Pencil } from 'lucide-react';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';
import { AdminDialog } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';

interface ToyData {
  id: number;
  name: string;
  category?: string;
  price: number;
  stock: number;
  status: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  created_by_staff_name?: string;
  updated_by_staff_name?: string;
}
interface Props {
  data: ToyData[];
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  onEdit: (type: 'toy', data: any) => void;
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

// One label + value pair in the detail dialog
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-slate-500">{label}</Label>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
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
  searchQuery = '',
  onSearchChange = () => {},
  isLoading = false,
  showActiveOnly = false,
  setShowActiveOnly = () => {}
}: Props) {
  const hasPermission = useHasStaffPermission();
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedToy, setSelectedToy] = useState<ToyData | null>(null);
  const [toyToDelete, setToyToDelete] = useState<ToyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSearchChange(localSearch);
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      if (deleteToyApi) {
        await deleteToyApi(id);
      } else {
        // Fallback when no delete API is provided: set status to inactive
        const response = await fetch(`/api/toys/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'inactive' })
        });
        if (!response.ok) throw new Error('Failed to update toy status');
      }

      // Update local state
      setToys((prev) => prev.map((toy) => (toy.id === id ? { ...toy, status: 'inactive' } : toy)));
      notify.deleted('đồ chơi');
      setToyToDelete(null);
    } catch (e: any) {
      notify.error(e, 'Lỗi cập nhật trạng thái đồ chơi');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditFromDetail = () => {
    if (!selectedToy) return;
    setIsDetailDialogOpen(false);
    onEdit('toy', selectedToy);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Quản lý đồ chơi & quà tặng" description={`Tổng cộng ${toysLength} vật phẩm trong hệ thống`} />

      {/* TOOLBAR */}
      <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên đồ chơi, sản phẩm..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" className={`${ADMIN_BTN_PRIMARY} shrink-0 gap-1.5`}>
              <Search className="h-4 w-4" /> {ADMIN_TEXT.search}
            </Button>
          </form>
          <div className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="whitespace-nowrap text-xs font-medium text-slate-500">Chỉ hiện khả dụng</span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
              className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
            />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-start gap-2.5 xl:w-auto xl:justify-end">
          {hasPermission('toys', 'create') && (
            <Button onClick={onCreate} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
              <Plus className="h-4 w-4" /> Thêm mới
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLocalSearch('');
              onSearchChange('');
              onRefresh();
            }}
            className={`${ADMIN_BTN_OUTLINE} gap-2`}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> {ADMIN_TEXT.refresh}
          </Button>
        </div>
      </div>

      <div className={`${ADMIN_CARD} overflow-hidden`}>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={searchQuery || showActiveOnly ? 'Không tìm thấy đồ chơi nào' : 'Chưa có đồ chơi nào trong kho'}
          />
        ) : (
          <Table>
            <TableHeader className={ADMIN_TABLE_HEAD}>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={`${ADMIN_TH} py-3`}>Ảnh</TableHead>
                <TableHead className={`${ADMIN_TH} py-3`}>Sản phẩm</TableHead>
                <TableHead className={`${ADMIN_TH} py-3`}>Phân loại</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 text-center`}>Đơn giá</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 text-center`}>Tồn kho</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 text-center`}>Trạng thái</TableHead>
                <TableHead className={`${ADMIN_TH} py-3 pr-6 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((x) => (
                <TableRow key={x.id} className="h-[52px] border-b border-slate-200 transition-colors hover:bg-slate-50">
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {x.image_url ? (
                        <img src={x.image_url} alt={x.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={16} className="text-slate-300" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">{x.name}</TableCell>
                  <TableCell>
                    {x.category ? (
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {x.category}
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-400">---</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-bold text-blue-600">{x.price.toLocaleString('vi-VN')}đ</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${x.stock === 0 ? 'text-red-500' : 'text-slate-700'}`}>{x.stock}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={x.status === 'active' ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="pr-6">
                    <RowActions>
                      <RowActionButton
                        action="view"
                        onClick={() => {
                          setSelectedToy(x);
                          setIsDetailDialogOpen(true);
                        }}
                      />
                      {hasPermission('toys', 'edit') && <RowActionButton action="edit" onClick={() => onEdit('toy', x)} />}
                      {hasPermission('toys', 'delete') && (
                        <RowActionButton action="delete" onClick={() => setToyToDelete(x)} />
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalLabel={`${toysLength} vật phẩm`}
      />

      {/* DETAIL DIALOG */}
      <AdminDialog
        open={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        mode="view"
        size="lg"
        title="Chi tiết đồ chơi"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsDetailDialogOpen(false)} className={ADMIN_BTN_OUTLINE}>
              {ADMIN_TEXT.close}
            </Button>
            {hasPermission('toys', 'edit') && (
              <Button type="button" onClick={openEditFromDetail} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
                <Pencil className="h-4 w-4" /> {ADMIN_TEXT.edit}
              </Button>
            )}
          </>
        }
      >
        {selectedToy && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Tên đồ chơi">
                <span className="font-medium">{selectedToy.name}</span>
              </DetailField>
              <DetailField label="Danh mục">{selectedToy.category || '-'}</DetailField>
              <DetailField label="Giá">
                <span className="font-medium">{new Intl.NumberFormat('vi-VN').format(selectedToy.price)} VNĐ</span>
              </DetailField>
              <DetailField label="Tồn kho">{selectedToy.stock}</DetailField>
              <DetailField label="Trạng thái">
                <StatusBadge status={selectedToy.status === 'active' ? 'active' : 'inactive'} />
              </DetailField>
            </div>
            {selectedToy.image_url && (
              <DetailField label="Hình ảnh">
                <img src={selectedToy.image_url} alt={selectedToy.name} className="h-32 w-32 rounded-lg object-cover" />
              </DetailField>
            )}
            <div className="border-t border-slate-200 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">Thông tin tạo & cập nhật</h4>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Ngày tạo">
                  {selectedToy.created_at ? new Date(selectedToy.created_at).toLocaleString('vi-VN') : '-'}
                </DetailField>
                <DetailField label="Tạo bởi">{selectedToy.created_by_staff_name || '-'}</DetailField>
                <DetailField label="Cập nhật lần cuối">
                  {selectedToy.updated_at ? new Date(selectedToy.updated_at).toLocaleString('vi-VN') : '-'}
                </DetailField>
                <DetailField label="Cập nhật bởi">{selectedToy.updated_by_staff_name || '-'}</DetailField>
              </div>
            </div>
          </div>
        )}
      </AdminDialog>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={!!toyToDelete}
        onOpenChange={(open) => !open && !isDeleting && setToyToDelete(null)}
        variant="danger"
        description={
          <>
            Bạn có chắc muốn xóa đồ chơi <strong>{toyToDelete?.name}</strong>? Vật phẩm sẽ chuyển sang trạng thái ngừng hoạt động.
          </>
        }
        busy={isDeleting}
        onConfirm={() => toyToDelete && handleDelete(toyToDelete.id)}
      />
    </div>
  );
}
