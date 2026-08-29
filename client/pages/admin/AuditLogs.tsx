import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Eye, FilterX } from 'lucide-react';

interface AuditLog {
  id: number;
  staffId: number;
  staffEmail: string;
  staffFullname: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  createdAt: string;
}

interface Staff {
  id: number;
  email: string;
  fullname: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Đăng nhập',
  create: 'Tạo mới',
  update: 'Cập nhật',
  delete: 'Xóa',
  force_logout: 'Đăng xuất',
  reset_password: 'Đặt lại mật khẩu',
  copy: 'Sao chép'
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-gray-100 text-gray-800 border-gray-200',
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  delete: 'bg-red-50 text-red-600 border-red-200',
  force_logout: 'bg-orange-100 text-orange-800 border-orange-200',
  reset_password: 'bg-purple-100 text-purple-800 border-purple-200',
  copy: 'bg-blue-50 text-blue-700 border-blue-200'
};

const ENTITY_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  movie: 'Phim',
  booking: 'Đặt vé',
  role: 'Vai trò',
  ticket_package: 'Gói vé',
  showtimes: 'Lịch chiếu'
};

// Fields to ignore for each module (auto-generated or system fields)
const IGNORED_FIELDS: Record<string, string[]> = {
  staff: ['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by_staff_id'],
  movie: ['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by_staff_id'],
  booking: ['id', 'created_at', 'updated_at'],
  role: ['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by_staff_id'],
  ticket_package: ['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by_staff_id'],
  branch: ['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by_staff_id'],
  site_media: ['id', 'created_at', 'updated_at', 'deleted_at'],
  post: ['id', 'created_at', 'updated_at', 'deleted_at'],
  toy: ['id', 'created_at', 'updated_at', 'deleted_at'],
  users: ['id', 'created_at', 'updated_at']
};

export default function AuditLogsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [activeTab, setActiveTab] = useState('audit-logs');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  const handleSearchAudit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearch(localSearch);
    setPage(1);
  };
  const [filterStaff, setFilterStaff] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch audit logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: [
      'audit-logs',
      page,
      pageSize,
      search,
      filterStaff,
      filterAction,
      filterEntityType,
      filterFromDate,
      filterToDate
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      if (search) params.append('search', search);
      if (filterStaff && filterStaff !== 'all') params.append('staffId', filterStaff);
      if (filterAction && filterAction !== 'all') params.append('action', filterAction);
      if (filterEntityType && filterEntityType !== 'all') params.append('module', filterEntityType);
      if (filterFromDate) params.append('from', filterFromDate);
      if (filterToDate) params.append('to', filterToDate);
      return request(`/api/admin/audit-logs?${params}`);
    }
  });

  // Fetch staff list for filter
  const { data: staffData } = useQuery({
    queryKey: ['staff-filter'],
    queryFn: async () => {
      return request('/api/admin/staff?pageSize=100');
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatEntityLabel = (entityType: string, entityId: string) => {
    const entityLabel = ENTITY_LABELS[entityType] || entityType;
    return `${entityLabel} #${entityId}`;
  };

  const getStaffInfo = (staffId: number) => {
    return staffList.find((s: Staff) => s.id === staffId);
  };

  const openDetailDialog = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStaff('');
    setFilterAction('');
    setFilterEntityType('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const renderJsonDiff = (oldValues: any, newValues: any) => {
    const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
    const keys = Array.from(allKeys);

    return (
      <div className="space-y-2">
        {keys.map((key) => {
          const oldValue = oldValues?.[key];
          const newValue = newValues?.[key];
          const isChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);

          return (
            <div key={key} className="flex">
              <div className="w-1/3 p-2 font-medium text-sm">{key}</div>
              <div className={`w-1/3 p-2 text-sm ${isChanged ? 'bg-red-50' : ''}`}>
                {oldValue !== undefined ? (
                  typeof oldValue === 'object' ? (
                    JSON.stringify(oldValue, null, 2)
                  ) : (
                    String(oldValue)
                  )
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className={`w-1/3 p-2 text-sm ${isChanged ? 'bg-green-50' : ''}`}>
                {newValue !== undefined ? (
                  typeof newValue === 'object' ? (
                    JSON.stringify(newValue, null, 2)
                  ) : (
                    String(newValue)
                  )
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const parseAuditJson = (value?: string) => {
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };

  const getDiffEntries = (log: AuditLog) => {
    const oldData = parseAuditJson(log.oldValues);
    const newData = parseAuditJson(log.newValues);
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const ignored = new Set(IGNORED_FIELDS[log.entityType] || ['id', 'created_at', 'updated_at']);

    const normalize = (val: unknown) => (val === null ? undefined : val);

    return Array.from(allKeys)
      .filter((key) => {
        if (ignored.has(key)) return false;
        return JSON.stringify(normalize(oldData[key])) !== JSON.stringify(normalize(newData[key]));
      })
      .map((key) => ({ key, oldValue: oldData[key], newValue: newData[key] }));
  };

  const logs = (logsData as any)?.items || [];
  const total = (logsData as any)?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const staffList = (staffData as any)?.items || [];

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  if (logsLoading) {
    return (
      <AdminLayout
        active={activeTab as any}
        setActive={setActiveTab as any}
        adminEmailState={staff?.email || 'admin@email.com'}
        handleLogout={handleLogout}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Nhật ký hoạt động</h1>
              <p className="text-sm text-slate-400 mt-0.5">Đang tải...</p>
            </div>
          </div>
          <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <div className="space-y-6">
        {/* PAGE HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Nhật ký hoạt động</h1>
            <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {total} bản ghi</p>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <form onSubmit={handleSearchAudit} className="flex flex-1 w-full gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên staff hoặc action..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl text-sm"
              />
            </div>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" /> Tìm kiếm
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setLocalSearch('');
                setSearch('');
                setPage(1);
                queryClient.invalidateQueries(['audit-logs'] as any);
              }}
              className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <Select value={filterStaff} onValueChange={setFilterStaff}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Nhân viên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhân viên</SelectItem>
                {staffList.map((staff: Staff) => (
                  <SelectItem key={staff.id} value={String(staff.id)}>
                    {staff.fullname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Hành động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(ACTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntityType} onValueChange={setFilterEntityType}>
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Đối tượng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-[140px] h-10 bg-slate-50 border-slate-200 rounded-xl text-sm"
              placeholder="Từ ngày"
            />
            <Input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-[140px] h-10 bg-slate-50 border-slate-200 rounded-xl text-sm"
              placeholder="Đến ngày"
            />
            <Button variant="outline" onClick={clearFilters} className="h-10">
              <FilterX className="w-4 h-4 mr-2" /> Xóa filter
            </Button>
          </div>
        </div>

        {/* TABLE */}
        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Thời gian</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Nhân viên</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Hành động</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Đối tượng</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">IP Address</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                    Thao tác
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: AuditLog) => (
                  <TableRow
                    key={log.id}
                    className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                  >
                    <TableCell className="text-sm text-slate-600">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {log.staffFullname || `Staff #${log.staffId}`}
                        </span>
                        <span className="text-xs text-slate-500">{log.staffEmail || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatEntityLabel(log.entityType, log.entityId)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-mono">{log.ipAddress || '-'}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg hover:bg-blue-50 text-blue-600"
                        onClick={() => openDetailDialog(log)}
                        title="Xem chi tiết"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FOOTER / PAGINATION */}
        <div className="bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {total} bản ghi trong hệ thống
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.max(1, page - 1));
                  }}
                  aria-disabled={page === 1}
                  className={
                    page === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="flex items-center px-3 text-sm text-slate-600">
                  Trang {page} / {totalPages || 1}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.min(totalPages, page + 1));
                  }}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chi tiết hoạt động</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Thời gian</Label>
                    <div className="text-sm">{formatDate(selectedLog.createdAt)}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">IP Address</Label>
                    <div className="text-sm">{selectedLog.ipAddress || '-'}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Nhân viên</Label>
                    <div className="text-sm">
                      {selectedLog.staffFullname || `Staff #${selectedLog.staffId}`} ({selectedLog.staffEmail || '-'})
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Hành động</Label>
                    <div className="text-sm">{ACTION_LABELS[selectedLog.action] || selectedLog.action}</div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Đối tượng</Label>
                    <div className="text-sm">{formatEntityLabel(selectedLog.entityType, selectedLog.entityId)}</div>
                  </div>
                </div>

                {/* Diff View */}
                {(selectedLog.oldValues || selectedLog.newValues) && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left p-3 border-b w-1/3">Field</th>
                          {selectedLog.oldValues && <th className="text-left p-3 border-b w-1/3">Trước</th>}
                          {selectedLog.newValues && <th className="text-left p-3 border-b w-1/3">Sau</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const diffEntries = getDiffEntries(selectedLog);

                          if (diffEntries.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="p-3 text-center text-gray-500">
                                  Không có thay đổi
                                </td>
                              </tr>
                            );
                          }

                          return diffEntries.map(({ key, oldValue, newValue }) => (
                            <tr key={key} className="border-b">
                              <td className="p-3 font-medium text-sm">{key}</td>
                              {selectedLog.oldValues && (
                                <td className="p-3 text-sm bg-red-50">
                                  {oldValue !== undefined ? (
                                    typeof oldValue === 'object' ? (
                                      JSON.stringify(oldValue, null, 2)
                                    ) : (
                                      String(oldValue)
                                    )
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                              {selectedLog.newValues && (
                                <td className="p-3 text-sm bg-green-50">
                                  {newValue !== undefined ? (
                                    typeof newValue === 'object' ? (
                                      JSON.stringify(newValue, null, 2)
                                    ) : (
                                      String(newValue)
                                    )
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
