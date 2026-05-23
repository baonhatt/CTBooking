import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Search, RefreshCw, Edit3, Trash2, Plus, Package } from 'lucide-react';
import { Table as AntTable } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAdminPermissions } from '@/lib/useAdminPermissions';

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
  pageSize?: number;
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

export default function ToysContent({
  data,
  totalPages,
  currentPage,
  setPage,
  pageSize,
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
  const { isViewer, isSuperAdmin, hasPermission } = useAdminPermissions();
  const handleDelete = async (id: number) => {
    try {
      // Soft delete: update status to inactive instead of deleting
      const response = await fetch(`/api/toys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' })
      });
      if (!response.ok) throw new Error('Failed to update toy status');

      // Update local state
      setToys((prev) => prev.map((toy) => (toy.id === id ? { ...toy, status: 'inactive' } : toy)));
    } catch (e: any) {
      alert(e?.message || 'Lỗi cập nhật trạng thái đồ chơi');
    }
  };

  const resolvedPageSize = useMemo(() => {
    if (pageSize && Number.isFinite(pageSize)) return pageSize;
    if (toysLength > 0 && totalPages > 0) return Math.max(1, Math.ceil(toysLength / totalPages));
    return 10;
  }, [pageSize, totalPages, toysLength]);

  const columns: ColumnsType<ToyData> = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 90,
        align: 'center',
        render: (v) => <span className="font-mono text-xs text-slate-500">#{v}</span>
      },
      {
        title: 'Ảnh',
        dataIndex: 'image_url',
        key: 'image_url',
        width: 90,
        render: (url: any, x: ToyData) => (
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
            {url ? <img src={url} alt={x.name} className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-300" />}
          </div>
        )
      },
      {
        title: 'Sản phẩm',
        dataIndex: 'name',
        key: 'name',
        width: 260,
        ellipsis: true,
        render: (v) => (
          <span className="font-bold text-slate-700 truncate block" title={String(v || '')}>
            {v}
          </span>
        )
      },
      {
        title: 'Phân loại',
        dataIndex: 'category',
        key: 'category',
        width: 170,
        ellipsis: true,
        render: (v) =>
          v ? (
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
              {v}
            </span>
          ) : (
            <span className="text-slate-400 italic text-xs">---</span>
          )
      },
      {
        title: 'Đơn giá',
        dataIndex: 'price',
        key: 'price',
        align: 'center',
        width: 130,
        render: (v) => <span className="font-bold text-blue-600">{Number(v || 0).toLocaleString('vi-VN')}đ</span>
      },
      {
        title: 'Tồn kho',
        dataIndex: 'stock',
        key: 'stock',
        align: 'center',
        width: 110,
        render: (v) => <span className={`font-bold ${Number(v) === 0 ? 'text-red-500' : 'text-slate-700'}`}>{v}</span>
      },
      {
        title: 'Trạng Thái',
        dataIndex: 'status',
        key: 'status',
        align: 'center',
        width: 150,
        render: (v) =>
          v === 'active' ? (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Hoạt động
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
              Đã ẩn
            </span>
          )
      },
      {
        title: 'Thao tác',
        key: 'actions',
        align: 'right',
        width: 130,
        render: (_: any, x: ToyData) => {
          const canEdit = !isViewer && (isSuperAdmin || hasPermission('toys.edit'));
          const canDelete = !isViewer && (isSuperAdmin || hasPermission('toys.delete'));
          return (
            <div className="flex items-center justify-end gap-2 pr-2">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit('toy', x)}
                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Chỉnh sửa"
                >
                  <Edit3 size={16} />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(x.id)}
                  className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa"
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          );
        }
      }
    ],
    [onEdit, isViewer, isSuperAdmin, hasPermission]
  );
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
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {!isViewer && (isSuperAdmin || hasPermission('toys.create')) && (
              <Button
                onClick={onCreate}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 gap-2 text-white font-bold h-10 px-4"
              >
                <Plus className="w-4 h-4" /> Thêm mới
              </Button>
            )}
          </div>
        </div>
      </div>
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white w-full min-w-0">
        <CardContent className="p-0">
          <AntTable
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={isLoading}
            tableLayout="fixed"
            scroll={{ x: 1020 }}
            pagination={{
              current: currentPage,
              pageSize: resolvedPageSize,
              total: toysLength,
              showSizeChanger: false,
              onChange: (p) => setPage(p)
            }}
            locale={{
              emptyText: (
                <div className="py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Package size={32} className="opacity-20" />
                    <span>Không có đồ chơi nào trong kho</span>
                  </div>
                </div>
              )
            }}
            className="[&_.ant-table]:rounded-none [&_.ant-table-thead>tr>th]:bg-slate-50/80"
          />
        </CardContent>
      </Card>
    </div>
  );
}
