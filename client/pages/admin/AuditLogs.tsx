import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { request } from '@/lib/api/http';
import { getAuditLogDetailApi } from '@/lib/api/admin-ops';
import { formatVnDateTime } from '@/lib/format';
import { getAdminBranchOptions } from '@/lib/api/branches';
import {
  auditChanges,
  auditNote,
  describeListChange,
  formatAuditValue,
  isAuditRecord,
  readableAuditJson,
  EMPTY_AUDIT_VALUE
} from '@/lib/audit-diff';
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

/** One line of the list. The saved values and the browser are loaded when the detail opens (AuditLogDetail). */
interface AuditLog {
  id: number;
  staffId: number;
  staffEmail: string;
  staffFullname: string;
  action: string;
  entityType: string;
  /** Readable name of the record (booking code, name ...), worked out by the server; empty when there is none */
  entity_name: string;
  ipAddress?: string;
  createdAt: string;
}

interface AuditLogDetail {
  oldValues?: string | null;
  newValues?: string | null;
  userAgent?: string | null;
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
  unlock: 'Mở khóa tài khoản',
  restore: 'Khôi phục',
  archive: 'Lưu trữ',
  change_password: 'Đổi mật khẩu',
  force_change_password: 'Đổi mật khẩu lần đầu',
  confirm_payment: 'Xác nhận thanh toán',
  cancel_payment: 'Hủy thanh toán',
  resend_booking_email: 'Gửi lại email vé',
  free_order_paid: 'Đơn 0đ được xác nhận',
  sepay_duplicate: 'Chuyển trùng',
  sepay_insufficient: 'Chuyển thiếu tiền',
  sepay_late_payment: 'Tiền về sau hạn',
  unmatched_transfer_matched: 'Gán chuyển khoản',
  unmatched_transfer_ignored: 'Bỏ qua chuyển khoản',
  action_item_resolved: 'Đã xử lý'
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
  unlock: 'success',
  restore: 'success',
  archive: 'warning',
  change_password: 'info',
  force_change_password: 'info',
  confirm_payment: 'success',
  cancel_payment: 'danger',
  resend_booking_email: 'info',
  free_order_paid: 'success',
  sepay_duplicate: 'info',
  sepay_insufficient: 'warning',
  sepay_late_payment: 'warning',
  unmatched_transfer_matched: 'success',
  unmatched_transfer_ignored: 'neutral',
  action_item_resolved: 'success'
};

const ENTITY_LABELS: Record<string, string> = {
  staff: 'Nhân viên',
  movie: 'Phim',
  booking: 'Đặt vé',
  role: 'Vai trò',
  ticket_package: 'Gói vé',
  showtimes: 'Lịch chiếu',
  user: 'Khách hàng',
  branch: 'Chi nhánh',
  voucher: 'Mã giảm giá',
  post: 'Bài viết',
  site_media: 'Media trang chủ',
  settings: 'Cài đặt',
  toy: 'Đồ chơi',
  unmatched_transfer: 'Chuyển khoản chưa khớp',
  audit_log: 'Đơn cần xử lý',
  email_log: 'Email gửi lỗi'
};

const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

const DATE_INPUT_CLASS =
  'h-10 w-[140px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

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

  // The saved values of the open line: the list does not carry them
  const {
    data: selectedDetail,
    isFetching: detailLoading,
    isError: detailFailed
  } = useQuery({
    queryKey: ['audit-log-detail', selectedLog?.id],
    queryFn: async () => (await getAuditLogDetailApi(selectedLog!.id)).log as AuditLogDetail,
    enabled: isDetailDialogOpen && !!selectedLog
  });

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

  // Branch names, so branch ids in a change read as names (inactive branches included: old logs name them too)
  const { data: branchOptions } = useQuery({
    queryKey: ['audit-branch-names'],
    queryFn: () => getAdminBranchOptions({ includeInactive: true }),
    staleTime: 5 * 60 * 1000
  });
  const branchNames: Record<number, string> = Object.fromEntries(
    (branchOptions?.items || []).map((branch) => [branch.id, branch.name])
  );
  const [showRawValues, setShowRawValues] = useState(false);

  // Fetch staff list for filter
  const { data: staffData } = useQuery({
    queryKey: ['staff-filter'],
    queryFn: async () => {
      return request('/api/admin/staff?pageSize=100');
    }
  });

  // Vietnam time, same format as the other admin screens
  const formatDate = (dateString: string) => formatVnDateTime(dateString);

  const formatEntityLabel = (log: AuditLog) => {
    const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
    const entityName = log.entity_name;
    // The internal id is never shown: without a name the label alone is shown
    return entityName ? `${entityLabel}: ${entityName}` : entityLabel;
  };

  const openDetailDialog = (log: AuditLog) => {
    setShowRawValues(false);
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

  const logs = (logsData as any)?.items || [];
  const total = (logsData as any)?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const staffList = (staffData as any)?.items || [];

  const handleLogout = () => {
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

  // CHANGE TABLE: one row per changed field, nested JSON opened up and labelled (lib/audit-diff.ts)
  const renderAuditValue = (field: string, value: unknown) => {
    const text = formatAuditValue(field, value, branchNames);
    return text === EMPTY_AUDIT_VALUE ? <span className="italic text-slate-400">{text}</span> : text;
  };

  const renderDiffTable = (detail: AuditLogDetail) => {
    const changes = auditChanges(detail.oldValues, detail.newValues);
    // A side that holds a sentence instead of a record (a new record has no "before") gets no column
    const hasBefore = isAuditRecord(detail.oldValues);
    const hasAfter = isAuditRecord(detail.newValues);
    return (
      <div className={`${ADMIN_CARD} overflow-hidden`}>
        <table className="w-full table-fixed">
          <thead className={ADMIN_TABLE_HEAD}>
            <tr>
              <th className={`${ADMIN_TH} w-[34%] p-3 text-left`}>Trường</th>
              {hasBefore && <th className={`${ADMIN_TH} p-3 text-left`}>Trước</th>}
              {hasAfter && <th className={`${ADMIN_TH} p-3 text-left`}>Sau</th>}
            </tr>
          </thead>
          <tbody>
            {changes.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-center text-sm text-slate-500">
                  Không có thay đổi
                </td>
              </tr>
            ) : (
              changes.map((change) => (
                <tr key={change.path} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="p-3 text-sm font-medium text-slate-700">{change.label}</td>
                  {hasBefore && (
                    <td className="whitespace-pre-wrap break-words bg-red-50 p-3 text-sm text-slate-800">
                      {renderAuditValue(change.field, change.oldValue)}
                    </td>
                  )}
                  {hasAfter && (
                    <td className="whitespace-pre-wrap break-words bg-emerald-50 p-3 text-sm text-slate-900">
                      {renderAuditValue(change.field, change.newValue)}
                      {/* A list that changed also says what was added and removed */}
                      {describeListChange(change.field, change.oldValue, change.newValue, branchNames) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {describeListChange(change.field, change.oldValue, change.newValue, branchNames)}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // NOTES: the sentence some logs keep instead of a record ("Tạo phim: Núi tuyết", "Xóa phim")
  const renderNotes = (detail: AuditLogDetail) => {
    const notes = [auditNote(detail.oldValues, branchNames), auditNote(detail.newValues, branchNames)].filter(Boolean);
    if (notes.length === 0) return null;
    return (
      <div className={`${ADMIN_CARD} space-y-1 p-4`}>
        <div className="text-xs font-medium text-slate-500">Ghi chú</div>
        {notes.map((note) => (
          <p key={note} className="text-sm text-slate-800">
            {note}
          </p>
        ))}
      </div>
    );
  };

  // RAW VIEW: the saved before/after as formatted JSON, for a technical check
  const renderRawValues = (detail: AuditLogDetail) => (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowRawValues((shown) => !shown)}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        {showRawValues ? 'Ẩn dữ liệu gốc' : 'Xem dữ liệu gốc'}
      </button>
      {showRawValues && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { title: 'Trước', text: detail.oldValues },
            { title: 'Sau', text: detail.newValues }
          ]
            .filter((side) => side.text)
            .map((side) => (
              <div key={side.title} className={`${ADMIN_CARD} overflow-hidden`}>
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase text-slate-500">{side.title}</div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-slate-700">
                  {readableAuditJson(side.text)}
                </pre>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderDetailBody = () => {
    if (!selectedLog) return null;
    return (
      <div className="space-y-4">
        <div className={`${ADMIN_CARD} grid grid-cols-2 gap-4 p-5`}>
          {renderInfoItem('Thời gian', formatDate(selectedLog.createdAt))}
          {renderInfoItem('Địa chỉ IP', selectedLog.ipAddress || '-')}
          {renderInfoItem('Trình duyệt / thiết bị', detailLoading ? '...' : selectedDetail?.userAgent || '-', true)}
          {renderInfoItem('Nhân viên', `${selectedLog.staffFullname || 'Nhân viên'} (${selectedLog.staffEmail || '-'})`)}
          {renderInfoItem('Hành động', ACTION_LABELS[selectedLog.action] || selectedLog.action)}
          {renderInfoItem('Đối tượng', formatEntityLabel(selectedLog))}
        </div>
        {detailLoading && <TableSkeleton rows={3} />}
        {detailFailed && <p className="text-sm text-red-600">Không tải được chi tiết thay đổi.</p>}
        {!detailLoading && selectedDetail && renderNotes(selectedDetail)}
        {!detailLoading &&
          selectedDetail &&
          (isAuditRecord(selectedDetail.oldValues) || isAuditRecord(selectedDetail.newValues)) && (
            <>
              {renderDiffTable(selectedDetail)}
              {renderRawValues(selectedDetail)}
            </>
          )}
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
