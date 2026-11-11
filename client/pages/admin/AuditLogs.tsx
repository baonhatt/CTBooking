import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { request } from '@/lib/api/http';
import { formatVnDateTime } from '@/lib/format';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, FilterX, History } from 'lucide-react';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge, type StatusTone } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';

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
  userAgent?: string | null;
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
  check_in: 'Cho vào cổng',
  force_checkin: 'Duyệt vé quá hạn',
  reset_password: 'Đặt lại mật khẩu',
  copy: 'Sao chép',
  lock: 'Khóa tài khoản',
  unlock: 'Mở khóa tài khoản'
};

// Badge colour of each action (same five tones as every other status in the admin)
const ACTION_TONES: Record<string, StatusTone> = {
  login: 'neutral',
  create: 'success',
  update: 'info',
  delete: 'danger',
  force_logout: 'warning',
  check_in: 'success',
  force_checkin: 'warning',
  reset_password: 'warning',
  copy: 'info',
  lock: 'danger',
  unlock: 'success'
};

const ENTITY_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  movie: 'Phim',
  booking: 'Đặt vé',
  role: 'Vai trò',
  ticket_package: 'Gói vé',
  showtimes: 'Lịch chiếu',
  user: 'Khách hàng'
};

const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

const DATE_INPUT_CLASS =
  'h-10 w-[140px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

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
  user: ['id', 'created_at', 'updated_at']
};

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [activeTab, setActiveTab] = useState('audit-logs');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  const handleSearchAudit = (e?: FormEvent) => {
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
  const {
    data: logsData,
    isFetching: logsLoading,
    isError: logsFailed,
    refetch: refetchLogs
  } = useQuery({
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

  // Vietnam time, same format as the other admin screens
  const formatDate = (dateString: string) => formatVnDateTime(dateString);

  // A value of the before/after table. Objects keep their indentation, so they go in a <pre>.
  const renderValue = (value: unknown) => {
    if (value === undefined) return <span className="text-gray-400">-</span>;
    if (value !== null && typeof value === 'object') {
      return <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
    }
    return String(value);
  };

  // The most readable name of the record (booking code, name, title ...) taken from the saved values
  const getEntityName = (log: AuditLog): string => {
    for (const rawValues of [log.newValues, log.oldValues]) {
      if (!rawValues) continue;
      try {
        const values = JSON.parse(rawValues);
        const name = values.booking_code || values.code || values.name || values.fullname || values.title || values.email;
        if (name) return String(name);
      } catch {
        // values that are not JSON have no name to show
      }
    }
    return '';
  };

  const formatEntityLabel = (log: AuditLog) => {
    const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
    const entityName = getEntityName(log);
    // The internal id is never shown: without a name the label alone is shown
    return entityName ? `${entityLabel}: ${entityName}` : entityLabel;
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



  const hasFilter = Boolean(filterStaff || filterAction || filterEntityType || filterFromDate || filterToDate);

  const renderActionBadge = (action: string) => (
    <StatusBadge tone={ACTION_TONES[action] || 'neutral'}>{ACTION_LABELS[action] || action}</StatusBadge>
  );

  // TOOLBAR
  const renderToolbar = () => (
    <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
      <form onSubmit={handleSearchAudit} className="flex w-full gap-2 xl:w-auto">
        <div className="relative w-[320px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Tìm theo tên nhân viên hoặc hành động"
            placeholder="Tìm theo tên nhân viên hoặc hành động..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
        <button type="submit" className={`${ADMIN_BTN_PRIMARY} inline-flex shrink-0 items-center gap-2`}>
          <Search className="h-4 w-4" />
          {ADMIN_TEXT.search}
        </button>
      </form>

      <div className="flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:justify-end">
        <select
          value={filterStaff}
          aria-label="Lọc theo nhân viên"
          onChange={(e) => setFilterStaff(e.target.value)}
          className={`${FILTER_SELECT_CLASS} min-w-[140px]`}
        >
          <option value="">Tất cả nhân viên</option>
          {staffList.map((staffItem: Staff) => (
            <option key={staffItem.id} value={String(staffItem.id)}>
              {staffItem.fullname}
            </option>
          ))}
        </select>

        <select
          value={filterAction}
          aria-label="Lọc theo hành động"
          onChange={(e) => setFilterAction(e.target.value)}
          className={`${FILTER_SELECT_CLASS} min-w-[140px]`}
        >
          <option value="">Tất cả hành động</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterEntityType}
          aria-label="Lọc theo đối tượng"
          onChange={(e) => setFilterEntityType(e.target.value)}
          className={`${FILTER_SELECT_CLASS} min-w-[140px]`}
        >
          <option value="">Tất cả đối tượng</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
          className={DATE_INPUT_CLASS}
          title="Từ ngày"
          aria-label="Từ ngày"
        />

        <input
          type="date"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
          className={DATE_INPUT_CLASS}
          title="Đến ngày"
          aria-label="Đến ngày"
        />

        {hasFilter && (
          <button type="button" onClick={clearFilters} className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}>
            <FilterX className="h-4 w-4" /> Bỏ lọc
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setLocalSearch('');
            setSearch('');
            setPage(1);
            clearFilters();
            refetchLogs();
          }}
          className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}
        >
          <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
          {ADMIN_TEXT.refresh}
        </button>
      </div>
    </div>
  );

  // TABLE
  const renderLogRow = (log: AuditLog) => (
    <TableRow key={log.id} className="h-[52px] border-b border-slate-200 transition-colors hover:bg-slate-50">
      <TableCell className="text-sm text-slate-600">{formatDate(log.createdAt)}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-slate-900">{log.staffFullname || 'Nhân viên'}</span>
          <span className="text-xs text-slate-500">{log.staffEmail || '-'}</span>
        </div>
      </TableCell>
      <TableCell>{renderActionBadge(log.action)}</TableCell>
      <TableCell className="text-sm text-slate-600">{formatEntityLabel(log)}</TableCell>
      <TableCell className="font-mono text-sm text-slate-600">{log.ipAddress || '-'}</TableCell>
      <TableCell className="pr-4 text-right">
        <RowActions>
          <RowActionButton action="view" onClick={() => openDetailDialog(log)} />
        </RowActions>
      </TableCell>
    </TableRow>
  );

  const renderTable = () => {
    if (logsLoading) return <TableSkeleton rows={6} />;
    if (logs.length === 0) {
      const isFiltered = hasFilter || Boolean(search);
      return <EmptyState title={isFiltered ? 'Không tìm thấy bản ghi nào' : 'Chưa có bản ghi nào'} />;
    }
    return (
      <Table>
        <TableHeader className={ADMIN_TABLE_HEAD}>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className={`${ADMIN_TH} py-3`}>Thời gian</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Nhân viên</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Hành động</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Đối tượng</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Địa chỉ IP</TableHead>
            <TableHead className={`${ADMIN_TH} py-3 pr-4 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{logs.map(renderLogRow)}</TableBody>
      </Table>
    );
  };

  // PAGINATION
  const renderPaginationLabel = () => (
    <span className="flex items-center gap-3">
      <span>{total} bản ghi</span>
      <select
        value={pageSize}
        aria-label="Số bản ghi mỗi trang"
        onChange={(e) => {
          setPageSize(Number(e.target.value));
          setPage(1);
        }}
        className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
      >
        {[20, 50, 100].map((size) => (
          <option key={size} value={size}>
            {size} / trang
          </option>
        ))}
      </select>
    </span>
  );

  // DETAIL MODAL
  const renderInfoItem = (label: string, value: ReactNode, wide = false) => (
    <div className={wide ? 'col-span-2' : undefined}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 break-all text-sm text-slate-900">{value}</div>
    </div>
  );

  const renderDiffTable = (log: AuditLog) => {
    const diffEntries = getDiffEntries(log);
    return (
      <div className={`${ADMIN_CARD} overflow-hidden`}>
        <table className="w-full">
          <thead className={ADMIN_TABLE_HEAD}>
            <tr>
              <th className={`${ADMIN_TH} w-1/3 p-3 text-left`}>Trường</th>
              {log.oldValues && <th className={`${ADMIN_TH} w-1/3 p-3 text-left`}>Trước</th>}
              {log.newValues && <th className={`${ADMIN_TH} w-1/3 p-3 text-left`}>Sau</th>}
            </tr>
          </thead>
          <tbody>
            {diffEntries.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-center text-sm text-slate-500">
                  Không có thay đổi
                </td>
              </tr>
            ) : (
              diffEntries.map(({ key, oldValue, newValue }) => (
                <tr key={key} className="border-b border-slate-100 last:border-b-0">
                  <td className="p-3 text-sm font-medium">{key}</td>
                  {log.oldValues && <td className="bg-red-50 p-3 text-sm">{renderValue(oldValue)}</td>}
                  {log.newValues && <td className="bg-emerald-50 p-3 text-sm">{renderValue(newValue)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDetailBody = () => {
    if (!selectedLog) return null;
    return (
      <div className="space-y-4">
        <div className={`${ADMIN_CARD} grid grid-cols-2 gap-4 p-5`}>
          {renderInfoItem('Thời gian', formatDate(selectedLog.createdAt))}
          {renderInfoItem('Địa chỉ IP', selectedLog.ipAddress || '-')}
          {renderInfoItem('Trình duyệt / thiết bị', selectedLog.userAgent || '-', true)}
          {renderInfoItem('Nhân viên', `${selectedLog.staffFullname || 'Nhân viên'} (${selectedLog.staffEmail || '-'})`)}
          {renderInfoItem('Hành động', ACTION_LABELS[selectedLog.action] || selectedLog.action)}
          {renderInfoItem('Đối tượng', formatEntityLabel(selectedLog))}
        </div>
        {(selectedLog.oldValues || selectedLog.newValues) && renderDiffTable(selectedLog)}
      </div>
    );
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <div className="space-y-4">
        <PageHeader title="Nhật ký hoạt động" description={`Tổng cộng ${total} bản ghi`} />

        {renderToolbar()}

        {logsFailed && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>Không tải được nhật ký hoạt động. Dữ liệu bên dưới có thể đã cũ hoặc trống.</span>
            <button onClick={() => refetchLogs()} className="font-semibold underline">
              Tải lại
            </button>
          </div>
        )}

        <div className={`${ADMIN_CARD} overflow-hidden`}>{renderTable()}</div>

        <AdminPagination page={page} totalPages={totalPages || 1} onPageChange={setPage} totalLabel={renderPaginationLabel()} />

        <AdminDialog
          open={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          mode="view"
          size="lg"
          icon={<History className="h-5 w-5" />}
          title="Chi tiết hoạt động"
          titleExtra={selectedLog ? renderActionBadge(selectedLog.action) : undefined}
          footer={<AdminDialogFooter onCancel={() => setIsDetailDialogOpen(false)} cancelText={ADMIN_TEXT.close} />}
        >
          {renderDetailBody()}
        </AdminDialog>
      </div>
    </AdminLayout>
  );
}
