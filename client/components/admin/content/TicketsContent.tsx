import React, { useMemo, useState } from 'react';
import { Clock, History, Loader2, RefreshCw, Edit3, Trash2, Info, Ticket as TicketIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { createTicketApi, updateTicketApi } from '@/lib/api';
import { getMoviesAdmin } from '@/lib/api/movies';
import { Table as AntTable } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAdminPermissions } from '@/lib/useAdminPermissions';

interface TicketPackage {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  combo?: number[];
  type?: string;
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
  updated_at?: string;
}

interface Props {
  data: TicketPackage[];
  totalPages: number;
  currentPage: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize?: number;
  totalItems?: number;
  onCreate: () => void;
  onEdit: (data: TicketPackage) => void;
  setTickets: React.Dispatch<React.SetStateAction<TicketPackage[]>>;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editData: any;
  setEditData: (data: any) => void;
  onRefresh: () => Promise<void>;
  deleteTicketApi: (id: number) => Promise<any>;
  isLoading?: boolean;
  showActiveOnly: boolean;
  setShowActiveOnly: (v: boolean) => void;
}

export default function TicketsContent(props: Props) {
  const {
    data,
    totalPages,
    currentPage,
    setPage,
    pageSize,
    totalItems,
    onCreate,
    onEdit,
    setTickets,
    isEditOpen,
    setIsEditOpen,
    editData,
    setEditData,
    onRefresh,
    deleteTicketApi,
    showActiveOnly,
    setShowActiveOnly
  } = props;
  const { isLoading = false } = props as any;

  const { isViewer, isSuperAdmin, hasPermission } = useAdminPermissions();
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [movies, setMovies] = useState<any[]>([]);

  const resolvedPageSize = useMemo(() => {
    if (pageSize && Number.isFinite(pageSize)) return pageSize;
    if (totalItems && totalPages > 0) return Math.max(1, Math.ceil(totalItems / totalPages));
    return 10;
  }, [pageSize, totalItems, totalPages]);

  const totalForPagination = useMemo(() => {
    if (typeof totalItems === 'number' && Number.isFinite(totalItems)) return totalItems;
    return Math.max(0, totalPages) * resolvedPageSize;
  }, [resolvedPageSize, totalItems, totalPages]);

  const columns: ColumnsType<TicketPackage> = useMemo(
    () => [
      {
        title: 'Tên gói',
        dataIndex: 'name',
        key: 'name',
        width: 360,
        ellipsis: true,
        render: (_: any, t: TicketPackage) => (
          <div className="flex flex-col gap-0.5 py-2 min-w-0">
            <span className="font-bold text-slate-900 truncate" title={t.name}>
              {t.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono truncate" title={t.code || 'N/A'}>
              CODE: {t.code || 'N/A'}
            </span>
          </div>
        )
      },
      {
        title: 'Phân loại',
        dataIndex: 'type',
        key: 'type',
        width: 140,
        align: 'center',
        render: (v) => (
          <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-600 bg-white">
            TYPE-{v || '0'}
          </Badge>
        )
      },
      {
        title: 'Giá niêm yết',
        dataIndex: 'price',
        key: 'price',
        width: 160,
        align: 'center',
        render: (v) => <span className="font-black text-slate-700">{Number(v || 0).toLocaleString('vi-VN')} đ</span>
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updated_at',
        key: 'updated_at',
        width: 190,
        render: (v) => (
          <div className="flex flex-col text-[10px]">
            <span className="text-slate-600 font-bold flex items-center gap-1">
              <History size={10} className="text-slate-400" />
              {v ? format(new Date(v), 'HH:mm') : '-'}
            </span>
            <span className="text-slate-400 italic cursor-help" title={v ? new Date(v).toLocaleString('vi-VN') : ''}>
              {v ? formatDistanceToNow(new Date(v), { addSuffix: true, locale: vi }) : ''}
            </span>
          </div>
        )
      },
      {
        title: 'Trạng Thái',
        dataIndex: 'is_active',
        key: 'is_active',
        align: 'center',
        width: 140,
        render: (v) => (
          <Badge
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border-none shadow-sm ${
              v ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {v ? 'HOẠT ĐỘNG' : 'ĐÃ ẨN'}
          </Badge>
        )
      },
      {
        title: 'Thao tác',
        key: 'actions',
        align: 'right',
        width: 130,
        render: (_: any, t: TicketPackage) => {
          const canEdit = !isViewer && (isSuperAdmin || hasPermission('tickets.edit'));
          const canDelete = !isViewer && (isSuperAdmin || hasPermission('tickets.delete'));
          return (
            <div className="flex items-center justify-end pr-2 gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-orange-50 text-orange-600"
                  onClick={() => onEdit(t)}
                >
                  <Edit3 size={16} />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-red-50 text-red-600"
                  disabled={isDeletingId === t.id}
                  onClick={async () => {
                    const confirmDelete = window.confirm('Bạn có chắc chắn muốn ngừng hoạt động gói vé này?');
                    if (!confirmDelete) return;
                    try {
                      setIsDeletingId(t.id);
                      await deleteTicketApi(t.id);
                      await onRefresh();
                      toast.success('Thành công', {
                        description: 'Gói vé đã được ngừng hoạt động'
                      });
                    } catch (error: any) {
                      toast.error('Lỗi', {
                        description: error.message || 'Không thể thực hiện thao tác'
                      });
                    } finally {
                      setIsDeletingId(null);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          );
        }
      }
    ],
    [deleteTicketApi, isDeletingId, onEdit, onRefresh, isViewer, isSuperAdmin, hasPermission]
  );

  React.useEffect(() => {
    if (isEditOpen) {
      getMoviesAdmin({ status: 'active', pageSize: 100 }).then((res) => {
        setMovies(res.items);
      });
    }
  }, [isEditOpen]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900">Quản lý gói vé</h3>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 w-fit">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Chỉ hiện khả dụng</span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
              className="scale-75 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 cursor-pointer"
            />
          </div>
        </div>
        <div className="flex gap-2 ml-auto">
          {!isViewer && (isSuperAdmin || hasPermission('tickets.create')) && (
            <Button
              onClick={onCreate}
              className="h-10 px-6 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              + Thêm gói vé
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="h-10 w-10 rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white font-sans w-full min-w-0">
        <CardContent className="p-0">
          <AntTable
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={isLoading}
            tableLayout="fixed"
            scroll={{ x: 980 }}
            pagination={{
              current: currentPage,
              pageSize: resolvedPageSize,
              total: totalForPagination,
              showSizeChanger: false,
              onChange: (p) => setPage(p)
            }}
            locale={{ emptyText: <div className="py-10 text-center text-slate-400">Không có dữ liệu</div> }}
            className="[&_.ant-table]:rounded-none [&_.ant-table-thead>tr>th]:bg-slate-50/80"
          />
        </CardContent>
      </Card>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden font-sans bg-slate-50">
          <DialogHeader className="px-6 py-5 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <TicketIcon size={20} className="text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                {editData?.id ? 'Chỉnh sửa gói vé' : 'Thêm gói vé'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-6 flex-1 space-y-8">
            <div className="space-y-6">
              {/* Thông tin cơ bản */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                  <Info size={14} className="text-blue-500" /> Thông tin cơ bản
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Tên gói <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Vd: Vé đơn"
                      value={editData?.name || ''}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Mã</Label>
                    <Input
                      placeholder="Vd: GV1"
                      value={editData?.code || ''}
                      onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Loại</Label>
                    <Input
                      placeholder="Vd: 1"
                      value={editData?.type || ''}
                      onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">
                      Giá (VNĐ) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="300,000"
                      value={
                        editData?.price !== undefined && editData?.price !== null
                          ? Number(editData.price).toLocaleString('en-US')
                          : ''
                      }
                      onChange={(e) => {
                        const v = Number(e.target.value.replace(/,/g, ''));
                        setEditData({ ...editData, price: isNaN(v) ? 0 : v });
                      }}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Mô tả</Label>
                  <textarea
                    placeholder="Vé dành cho 1 người xem cả nhân"
                    value={editData?.description || ''}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full h-20 border rounded-md px-3 py-2 mt-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tính năng và Combo */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Tính năng & Combo</h3>
                <div>
                  <Label className="text-sm font-medium">Tính năng (phân tách bằng dấu phẩy)</Label>
                  <Input
                    placeholder="ghế ấm,nệm ấm"
                    value={editData?.features || ''}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        features: e.target.value
                      })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Combo Phim ({editData?.combo?.length || 0})</Label>
                  <div className="border rounded-md p-3 h-36 overflow-y-auto space-y-2 mt-1.5 bg-gray-50">
                    {movies.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">Không có phim nào</p>
                    ) : (
                      movies.map((movie) => (
                        <div key={movie.id} className="flex items-center space-x-2 hover:bg-white p-1.5 rounded">
                          <Checkbox
                            id={`movie-${movie.id}`}
                            checked={(editData.combo || []).includes(movie.id)}
                            onCheckedChange={(checked) => {
                              const current = editData.combo || [];
                              if (checked) {
                                setEditData({
                                  ...editData,
                                  combo: [...current, movie.id]
                                });
                              } else {
                                setEditData({
                                  ...editData,
                                  combo: current.filter((id: number) => id !== movie.id)
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`movie-${movie.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {movie.title}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Cài đặt nâng cao */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Cài đặt nâng cao</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Nhóm tối thiểu</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={editData?.min_group_size ?? ''}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          min_group_size: Number(e.target.value || 0)
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Nhóm tối đa</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={editData?.max_group_size ?? ''}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          max_group_size: Number(e.target.value || 0)
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Thứ tự hiển thị</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editData?.display_order ?? 0}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          display_order: Number(e.target.value || 0)
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Trạng thái</Label>
                    <select
                      value={editData?.is_active ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          is_active: e.target.value === 'active'
                        })
                      }
                      className="w-full h-10 border rounded-md px-3 mt-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Đã ẩn</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button
              disabled={isSaving}
              onClick={async () => {
                try {
                  setIsSaving(true);
                  if (!editData?.id) {
                    await createTicketApi({
                      name: editData.name,
                      code: editData.code,
                      description: editData.description,
                      price: Number(editData.price || 0),
                      features: editData.features || [],
                      combo: editData.combo || [],
                      type: editData.type,
                      min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                      max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                      is_member_only: !!editData.is_member_only,
                      is_active: !!editData.is_active,
                      display_order: editData.display_order ? Number(editData.display_order) : 0
                    });
                  } else {
                    await updateTicketApi(Number(editData.id), {
                      name: editData.name,
                      code: editData.code,
                      description: editData.description,
                      price: Number(editData.price || 0),
                      features: editData.features || [],
                      combo: editData.combo || [],
                      type: editData.type,
                      min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                      max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                      is_member_only: !!editData.is_member_only,
                      is_active: !!editData.is_active,
                      display_order: editData.display_order ? Number(editData.display_order) : 0
                    });
                  }
                  await onRefresh();
                  toast.success('Thành công', {
                    description: editData?.id ? 'Cập nhật gói vé thành công' : 'Thêm gói vé thành công'
                  });
                } finally {
                  setIsSaving(false);
                  setIsEditOpen(false);
                }
              }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                </span>
              ) : (
                'Lưu'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
