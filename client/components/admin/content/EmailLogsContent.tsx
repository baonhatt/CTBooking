import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { getEmailLogsApi, resendBookingEmailApi } from '@/lib/api';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';
import { formatVnDateTime } from '@/lib/format';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
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
import {
  Search,
  RefreshCw,
  Mail,
  Key,
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Copy,
  Send,
  User as UserIcon
} from 'lucide-react';

// Every email_type the server writes to email_logs (server/lib/mail-queue.ts), with its label
const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: 'Chào mừng',
  reset_password: 'Quên mật khẩu',
  booking_confirmation: 'Xác nhận đặt vé',
  otp: 'Mã OTP khách hàng',
  staff_otp: 'Mã OTP nhân viên'
};

const email_type_label = (emailType: string) => EMAIL_TYPE_LABELS[emailType] || emailType;

const recipient_type_label = (recipientType?: string | null) =>
  recipientType === 'staff' ? 'Nhân viên' : 'Khách hàng';

// Email status as a standard badge: sent / failed / anything else is still waiting in the queue
const email_status_key = (emailStatus: string) => (emailStatus === 'sent' || emailStatus === 'failed' ? emailStatus : 'queued');

// The clipboard can be blocked (no permission, not https), so a failure is reported instead of ignored
const copy_text = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.copied(what);
  } catch {
    notify.error('Không sao chép được, hãy chọn và sao chép thủ công');
  }
};

const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'welcome':
      return <UserIcon size={14} className="text-blue-500" />;
    case 'reset_password':
    case 'otp':
    case 'staff_otp':
      return <Key size={14} className="text-amber-500" />;
    case 'booking_confirmation':
      return <Ticket size={14} className="text-emerald-500" />;
    default:
      return <Mail size={14} className="text-slate-500" />;
  }
};

// A small boxed fact of the detail modal
function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${ADMIN_CARD} flex flex-col gap-1 p-4`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="break-words text-sm font-semibold text-slate-900">{children}</span>
    </div>
  );
}

export default function EmailLogsContent() {
  const hasPermission = useHasStaffPermission();
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState('all');
  const [emailType, setEmailType] = useState('all');
  const [search, setSearch] = useState('');
  // The search text that is actually applied (set when the form is submitted)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await getEmailLogsApi({
        page,
        limit,
        status,
        email_type: emailType,
        search: appliedSearch
      });
      setLoadError('');
      setData(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
      setLoadError('Không tải được lịch sử email. Dữ liệu bên dưới có thể đã cũ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, status, emailType, appliedSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search);
  };

  // Metadata is stored as text; a malformed value must not break the whole page
  const formatMetadata = (metadata: unknown) => {
    if (typeof metadata !== 'string') return JSON.stringify(metadata, null, 2);
    try {
      return JSON.stringify(JSON.parse(metadata), null, 2);
    } catch {
      return metadata;
    }
  };

  const formatDateTime = (value: string | null) => formatVnDateTime(value);

  // Only a failed confirmation of an order can be sent again (the server checks that the order is paid)
  // The server uses the ticket_check.validate right for this action, so the button needs it too
  const canResend = (log: any) =>
    hasPermission('ticket_check', 'validate') &&
    log?.email_type === 'booking_confirmation' &&
    log?.status === 'failed' &&
    Boolean(log?.booking_id);

  const handleResend = async () => {
    if (!selectedLog?.booking_id) return;
    try {
      setIsResending(true);
      const res = await resendBookingEmailApi(Number(selectedLog.booking_id));
      notify.success(res?.message || 'Đã đưa email xác nhận vào hàng đợi gửi.');
      setIsResendConfirmOpen(false);
      setIsDetailsOpen(false);
      fetchData();
    } catch (err: any) {
      notify.error(err, 'Không gửi lại được email');
    } finally {
      setIsResending(false);
    }
  };

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  // TOOLBAR
  const renderToolbar = () => (
    <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
      <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo email người nhận..."
              aria-label="Tìm theo email người nhận"
            />
          </div>
          <button type="submit" className={`${ADMIN_BTN_PRIMARY} inline-flex shrink-0 items-center gap-2`}>
            <Search className="h-4 w-4" />
            {ADMIN_TEXT.search}
          </button>
        </form>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái" className={FILTER_SELECT_CLASS}>
          <option value="all">Tất cả trạng thái</option>
          <option value="sent">Đã gửi thành công</option>
          <option value="failed">Gửi thất bại</option>
          <option value="pending">Đang chờ xử lý</option>
        </select>
        <select
          value={emailType}
          onChange={(e) => setEmailType(e.target.value)}
          aria-label="Lọc theo loại email"
          className={FILTER_SELECT_CLASS}
        >
          <option value="all">Tất cả loại email</option>
          <option value="welcome">Chào mừng</option>
          <option value="reset_password">Quên mật khẩu</option>
          <option value="booking_confirmation">Xác nhận đặt vé</option>
          <option value="otp">Mã OTP khách hàng</option>
          <option value="staff_otp">Mã OTP nhân viên</option>
        </select>
      </div>
      <button type="button" onClick={fetchData} className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}>
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        {ADMIN_TEXT.refresh}
      </button>
    </div>
  );

  // TABLE
  const renderLogRow = (log: any) => (
    <TableRow key={log.id} className="border-b border-slate-200 transition-colors hover:bg-slate-50">
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {log.recipient}
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                log.recipient_type === 'staff' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {recipient_type_label(log.recipient_type)}
            </span>
          </span>
          <span className="line-clamp-1 text-[11px] italic text-slate-500">{log.subject}</span>
          {log.booking_code && <span className="font-mono text-[11px] text-blue-600">Mã đặt chỗ: {log.booking_code}</span>}
          {log.status === 'failed' && log.error_message && (
            <span className="line-clamp-1 text-[11px] text-red-600" title={log.error_message}>
              Lỗi: {log.error_message}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-2">{getTypeIcon(log.email_type)}</div>
          <span className="text-xs font-semibold text-slate-700">{email_type_label(log.email_type)}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <StatusBadge status={email_status_key(log.status)} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <Clock size={10} className="text-slate-400" />
            {formatDateTime(log.created_at)}
          </div>
          {log.sent_at && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 size={10} />
              Gửi lúc: {formatDateTime(log.sent_at)}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <RowActions>
          <RowActionButton action="view" label="Xem chi tiết email" onClick={() => handleViewDetails(log)} />
        </RowActions>
      </TableCell>
    </TableRow>
  );

  const renderTable = () => {
    if (isLoading) return <TableSkeleton rows={6} />;
    if (data.length === 0) {
      const isFiltered = status !== 'all' || emailType !== 'all' || Boolean(appliedSearch);
      return <EmptyState title={isFiltered ? 'Không tìm thấy email nào' : 'Chưa có email nào'} />;
    }
    return (
      <Table>
        <TableHeader className={ADMIN_TABLE_HEAD}>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className={ADMIN_TH}>Người nhận &amp; tiêu đề</TableHead>
            <TableHead className={ADMIN_TH}>Loại email</TableHead>
            <TableHead className={`${ADMIN_TH} text-center`}>Trạng thái</TableHead>
            <TableHead className={ADMIN_TH}>Thời gian</TableHead>
            <TableHead className={`${ADMIN_TH} pr-4 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{data.map(renderLogRow)}</TableBody>
      </Table>
    );
  };

  // DETAIL MODAL
  const renderDetailBody = () => {
    if (!selectedLog) return null;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoBox label="Người nhận">
            <span className="flex items-start gap-2 break-all">
              {selectedLog.recipient}
              <button
                type="button"
                onClick={() => copy_text(selectedLog.recipient, 'email người nhận')}
                className="shrink-0 text-slate-400 hover:text-blue-600"
                aria-label="Sao chép email người nhận"
                title="Sao chép email người nhận"
              >
                <Copy size={14} />
              </button>
            </span>
          </InfoBox>
          <InfoBox label="Loại email">{email_type_label(selectedLog.email_type)}</InfoBox>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoBox label="Nhà cung cấp">{selectedLog.provider || 'Hệ thống'}</InfoBox>
          <InfoBox label="Tài khoản">
            {selectedLog.recipient_type === 'staff' ? (
              'Nhân viên'
            ) : selectedLog.user_id ? (
              'Khách có tài khoản'
            ) : (
              <span className="font-medium italic text-slate-400">Khách vãng lai</span>
            )}
          </InfoBox>
          <InfoBox label="Mã đặt chỗ">{selectedLog.booking_code || '-'}</InfoBox>
        </div>

        <InfoBox label="Tiêu đề">{selectedLog.subject}</InfoBox>

        {selectedLog.error_message && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={18} />
              <span className="text-sm font-semibold">Thông báo lỗi chi tiết</span>
              <button
                type="button"
                onClick={() => copy_text(selectedLog.error_message, 'thông báo lỗi')}
                className="ml-auto text-red-400 hover:text-red-700"
                aria-label="Sao chép thông báo lỗi"
                title="Sao chép thông báo lỗi"
              >
                <Copy size={14} />
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-red-200 bg-white p-3 text-sm font-medium text-red-900">
              <code className="whitespace-pre-wrap">{selectedLog.error_message}</code>
            </div>
          </div>
        )}

        {selectedLog.metadata && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-500">
              <FileJson size={16} />
              <span className="text-sm font-semibold">Dữ liệu đi kèm (Metadata)</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs text-blue-600">
              <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap leading-relaxed">{formatMetadata(selectedLog.metadata)}</pre>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Khởi tạo lúc</span>
            <span className="text-sm font-semibold text-slate-700">{formatDateTime(selectedLog.created_at)}</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs font-medium text-slate-500">Gửi thành công lúc</span>
            <span className="text-sm font-semibold text-slate-700">{formatDateTime(selectedLog.sent_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderResendButton = () =>
    canResend(selectedLog) ? (
      <button
        type="button"
        onClick={() => setIsResendConfirmOpen(true)}
        className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}
      >
        <Send size={14} /> Gửi lại
      </button>
    ) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Lịch sử email" description="Ghi lại tất cả thông báo gửi tới khách hàng" />

      {renderToolbar()}

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button onClick={fetchData} className="font-semibold underline">
            Tải lại
          </button>
        </div>
      )}

      <div className={`${ADMIN_CARD} overflow-hidden`}>{renderTable()}</div>

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} totalLabel={`${total} email`} />

      <AdminDialog
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        mode="view"
        size="md"
        icon={selectedLog ? getTypeIcon(selectedLog.email_type) : <Mail className="h-5 w-5" />}
        title="Chi tiết nhật ký email"
        subtitle={selectedLog?.recipient}
        titleExtra={selectedLog ? <StatusBadge status={email_status_key(selectedLog.status)} /> : undefined}
        footer={<AdminDialogFooter onCancel={() => setIsDetailsOpen(false)} cancelText={ADMIN_TEXT.close} leading={renderResendButton()} />}
      >
        {renderDetailBody()}
      </AdminDialog>

      <ConfirmDialog
        open={isResendConfirmOpen}
        onOpenChange={setIsResendConfirmOpen}
        variant="info"
        title="Gửi lại email xác nhận?"
        confirmText="Gửi lại"
        busy={isResending}
        onConfirm={handleResend}
        description={`Email xác nhận đặt vé${selectedLog?.booking_code ? ` (mã đặt chỗ ${selectedLog.booking_code})` : ''} sẽ được gửi lại tới địa chỉ email ghi trên đơn.`}
      />
    </div>
  );
}
