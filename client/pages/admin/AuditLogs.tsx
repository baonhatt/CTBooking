import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

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
  reset_password: 'Đặt lại mật khẩu'
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-gray-100 text-gray-800',
  create: 'bg-green-100 text-green-800',
  update: 'bg-yellow-100 text-yellow-800',
  delete: 'bg-red-100 text-red-800',
  force_logout: 'bg-orange-100 text-orange-800',
  reset_password: 'bg-purple-100 text-purple-800'
};

const ENTITY_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  movie: 'Phim',
  booking: 'Đặt vé',
  role: 'Vai trò',
  ticket_package: 'Gói vé'
};

// Fields to ignore for each module (auto-generated or system fields)
const IGNORED_FIELDS: Record<string, string[]> = {
  staff: ['id', 'created_at', 'updated_at'],
  movie: ['id', 'created_at', 'updated_at'],
  booking: ['id', 'created_at', 'updated_at'],
  role: ['id', 'created_at', 'updated_at'],
  ticket_package: ['id', 'created_at', 'updated_at']
};

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
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

  const renderJsonValues = (values: any) => {
    if (!values) return null;
    const keys = Object.keys(values);

    return (
      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key} className="flex">
            <div className="w-1/3 p-2 font-medium text-sm">{key}</div>
            <div className="w-2/3 p-2 text-sm">
              {typeof values[key] === 'object' ? JSON.stringify(values[key], null, 2) : String(values[key])}
            </div>
          </div>
        ))}
      </div>
    );
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
        active={'audit-logs' as any}
        setActive={() => {}}
        adminEmailState={staff?.email || 'admin@email.com'}
        handleLogout={handleLogout}
      >
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Nhật ký hoạt động</CardTitle>
            </CardHeader>
            <CardContent>
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
      active={'audit-logs' as any}
      setActive={() => {}}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Nhật ký hoạt động</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <Input
                placeholder="Tìm kiếm theo tên staff hoặc action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Lọc theo nhân viên" />
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
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Loại action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả action</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Loại đối tượng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả đối tượng</SelectItem>
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
                className="w-[150px]"
              />
              <Input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-[150px]"
              />
              <Button variant="outline" onClick={clearFilters}>
                Xóa filter
              </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3">Thời gian</th>
                    <th className="text-left p-3">Nhân viên</th>
                    <th className="text-left p-3">Hành động</th>
                    <th className="text-left p-3">Đối tượng</th>
                    <th className="text-left p-3">IP Address</th>
                    <th className="text-left p-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: AuditLog) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{formatDate(log.createdAt)}</td>
                      <td className="p-3">
                        <div>{log.staffFullname || `Staff #${log.staffId}`}</div>
                        <div className="text-xs text-gray-500">{log.staffEmail || '-'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="p-3">{formatEntityLabel(log.entityType, log.entityId)}</td>
                      <td className="p-3">{log.ipAddress || '-'}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => openDetailDialog(log)}>
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-600">Tổng {total} bản ghi</span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Trước
                </Button>
                <span className="flex items-center px-3">
                  Trang {page} / {totalPages || 1}
                </span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Sau
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
                          let oldData: any = {};
                          let newData: any = {};
                          try {
                            oldData = selectedLog.oldValues ? JSON.parse(selectedLog.oldValues) : {};
                          } catch {}
                          try {
                            newData = selectedLog.newValues ? JSON.parse(selectedLog.newValues) : {};
                          } catch {}
                          const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
                          const keys = Array.from(allKeys);

                          // Get ignored fields for this entity type
                          const ignoredFields = IGNORED_FIELDS[selectedLog.entityType] || [
                            'id',
                            'created_at',
                            'updated_at'
                          ];

                          // Filter only changed fields (excluding ignored fields)
                          const changedKeys = keys.filter((key) => {
                            if (ignoredFields.includes(key)) return false;
                            const oldValue = oldData?.[key];
                            const newValue = newData?.[key];
                            // Treat null and undefined as the same
                            const normalizedOld = oldValue === null ? undefined : oldValue;
                            const normalizedNew = newValue === null ? undefined : newValue;
                            return JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew);
                          });

                          if (changedKeys.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="p-3 text-center text-gray-500">
                                  Không có thay đổi
                                </td>
                              </tr>
                            );
                          }

                          return changedKeys.map((key) => {
                            const oldValue = oldData?.[key];
                            const newValue = newData?.[key];

                            return (
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
                            );
                          });
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
