import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getUserById, setUserActive } from '@/lib/api';
import type { AdminUserDetail } from '@/lib/api/users';
import { Search, RefreshCw, User, Copy, Lock, LockOpen } from 'lucide-react';
import { formatVnDateTime, formatVnDate, formatVnd, paymentMethodLabel } from '@/lib/format';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton, InlineLoading } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_PRIMARY, ADMIN_BTN_OUTLINE, ADMIN_CARD, ADMIN_TABLE_HEAD, ADMIN_TH, ADMIN_TEXT } from '@/components/admin/common/adminTokens';

interface Props {
  data: any[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  userQuery: string;
  setUserQuery: (q: string) => void;
  statusFilter?: string;
  setStatusFilter?: (value: string) => void;
  usersLength: number;
  onRefresh: () => void;
  isLoading?: boolean;
}

// The customer a lock / unlock confirmation is about
interface LockTarget {
  id: number;
  fullname: string;
  // true = the account is locked now, so the confirmation unlocks it
  is_locked: boolean;
}

const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

const LOCK_REASON_MAX_LENGTH = 500;

const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

const LOCK_BUTTON_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-all hover:bg-red-50';

const UNLOCK_BUTTON_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-600 transition-all hover:bg-emerald-50';

const getLoginTypeLabel = (loginType?: string) => (loginType || 'email').toUpperCase();

// One "label ... value" line of the info panels
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="shrink-0 text-xs font-medium text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-slate-900">{children}</span>
    </div>
  );
}

// A boxed number of the booking statistics
function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={`${ADMIN_CARD} p-4`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function UsersContent({
  data,
  totalPages,
  currentPage,
  setPage,
  userQuery,
  setUserQuery,
  statusFilter = 'all',
  setStatusFilter,
  usersLength,
  onRefresh,
  isLoading = false
}: Props) {
  const hasPermission = useHasStaffPermission();
  const canLock = hasPermission('users', 'lock');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetails, setUserDetails] = useState<AdminUserDetail | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<LockTarget | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [isLockBusy, setIsLockBusy] = useState(false);
  const [localUserQuery, setLocalUserQuery] = useState(userQuery);

  useEffect(() => {
    if (isDetailsOpen && selectedUserId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          const details = await getUserById(selectedUserId);
          setUserDetails(details);
        } catch (err) {
          setDetailsError('Không thể tải thông tin người dùng');
          console.error('Lỗi load user details:', err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedUserId]);

  useEffect(() => {
    setLocalUserQuery(userQuery);
  }, [userQuery]);

  const copyText = async (text: string, what: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.copied(what);
    } catch {
      notify.error('Không sao chép được, hãy bôi đen và sao chép thủ công');
    }
  };

  const handleViewDetails = (userId: number) => {
    if (!hasPermission('users', 'view_detail')) return;
    setUserDetails(null);
    setSelectedUserId(userId);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setUserDetails(null);
    setSelectedUserId(null);
  };

  const handleSearchUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUserQuery(localUserQuery);
    setPage(1);
  };

  const openLockConfirm = (target: LockTarget) => {
    setLockReason('');
    setLockTarget(target);
  };

  const handleConfirmLock = async () => {
    if (!lockTarget) return;
    const willBeActive = lockTarget.is_locked;
    setIsLockBusy(true);
    try {
      await setUserActive(lockTarget.id, willBeActive, willBeActive ? '' : lockReason.trim());
      notify.success(willBeActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
      // Keep the open detail modal in step with the list
      setUserDetails((current) => (current && current.id === lockTarget.id ? { ...current, is_active: willBeActive } : current));
      setLockTarget(null);
      onRefresh();
    } catch (err) {
      notify.error(err);
    } finally {
      setIsLockBusy(false);
    }
  };

  const hasFilter = Boolean(userQuery) || statusFilter !== 'all';

  // TOOLBAR
  const renderToolbar = () => (
    <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
      <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
        <form onSubmit={handleSearchUser} className="flex gap-2">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              value={localUserQuery}
              onChange={(e) => setLocalUserQuery(e.target.value)}
              placeholder="Tìm theo tên, email hoặc SĐT..."
              aria-label="Tìm người dùng"
            />
          </div>
          <button type="submit" className={`${ADMIN_BTN_PRIMARY} inline-flex shrink-0 items-center gap-2`}>
            <Search className="h-4 w-4" />
            {ADMIN_TEXT.search}
          </button>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter?.(e.target.value)}
          aria-label="Lọc theo trạng thái tài khoản"
          className={FILTER_SELECT_CLASS}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">{ADMIN_TEXT.active}</option>
          <option value="inactive">Đã khóa</option>
        </select>
      </div>

      <div className="flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:justify-end">
        <button
          type="button"
          onClick={() => {
            setLocalUserQuery('');
            setUserQuery('');
            onRefresh();
          }}
          className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {ADMIN_TEXT.refresh}
        </button>
      </div>
    </div>
  );

  // TABLE
  const renderRowActions = (u: any) => (
    <RowActions>
      {hasPermission('users', 'view_detail') && (
        <RowActionButton action="view" label={`Xem chi tiết ${u.fullname}`} onClick={() => handleViewDetails(Number(u.id))} />
      )}
      {canLock &&
        (u.is_active ? (
          <RowActionButton
            action="lock"
            onClick={() => openLockConfirm({ id: Number(u.id), fullname: u.fullname, is_locked: false })}
          />
        ) : (
          <RowActionButton
            action="unlock"
            onClick={() => openLockConfirm({ id: Number(u.id), fullname: u.fullname, is_locked: true })}
          />
        ))}
    </RowActions>
  );

  const renderUserRow = (u: any) => (
    <TableRow key={u.id} className="h-[52px] border-b border-slate-200 transition-colors hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
            {u.fullname?.charAt(0).toUpperCase() || <User size={14} />}
          </div>
          <span className="font-semibold text-slate-900">{u.fullname}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-700">{u.email}</span>
          <span className="font-mono text-[11px] text-slate-500">{u.phone}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <StatusBadge status={u.is_active ? 'active' : 'locked'} />
      </TableCell>
      <TableCell>
        <span className="text-xs font-medium text-slate-600">{getLoginTypeLabel(u.login_type)}</span>
      </TableCell>
      <TableCell className="text-center text-sm font-semibold text-slate-700">{u.total_bookings ?? 0}</TableCell>
      <TableCell>
        <span className="text-xs font-medium text-slate-600">
          {u.last_booking_at ? formatVnDateTime(u.last_booking_at) : 'Chưa đặt'}
        </span>
      </TableCell>
      <TableCell className="hidden 2xl:table-cell">
        <span className="text-xs font-medium text-slate-600">{formatVnDateTime(u.created_at)}</span>
      </TableCell>
      <TableCell className="pr-4 text-right">{renderRowActions(u)}</TableCell>
    </TableRow>
  );

  const renderTable = () => {
    if (isLoading) return <TableSkeleton rows={6} />;
    if (data.length === 0) {
      return (
        <EmptyState
          title={hasFilter ? 'Không tìm thấy người dùng' : 'Chưa có người dùng'}
          description={hasFilter ? 'Thử đổi từ khóa hoặc bỏ bộ lọc trạng thái.' : undefined}
        />
      );
    }
    return (
      <Table>
        <TableHeader className={ADMIN_TABLE_HEAD}>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className={`${ADMIN_TH} py-3`}>Người dùng</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Email &amp; SĐT</TableHead>
            <TableHead className={`${ADMIN_TH} py-3 text-center`}>Trạng thái</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Đăng nhập</TableHead>
            <TableHead className={`${ADMIN_TH} py-3 text-center`}>Lượt đặt</TableHead>
            <TableHead className={`${ADMIN_TH} py-3`}>Đặt gần nhất</TableHead>
            <TableHead className={`hidden 2xl:table-cell ${ADMIN_TH} py-3`}>Ngày tạo</TableHead>
            <TableHead className={`${ADMIN_TH} py-3 pr-4 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{data.map(renderUserRow)}</TableBody>
      </Table>
    );
  };

  // DETAIL MODAL
  const renderCopyButton = (text: string, what: string) => (
    <button
      type="button"
      onClick={() => copyText(text, what)}
      title={`Sao chép ${what}`}
      aria-label={`Sao chép ${what}`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      <Copy size={12} />
    </button>
  );

  const renderAccountInfo = () => (
    <div className={`${ADMIN_CARD} p-5`}>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Thông tin tài khoản</h3>
      <InfoRow label="Trạng thái">
        <StatusBadge status={userDetails.is_active ? 'active' : 'locked'} />
      </InfoRow>
      <InfoRow label="Họ tên">
        <span className="font-semibold">{userDetails.fullname}</span>
      </InfoRow>
      <InfoRow label="Email">
        <span className="inline-flex items-center gap-1">
          <span className="break-all">{userDetails.email || 'Chưa cập nhật'}</span>
          {userDetails.email && renderCopyButton(userDetails.email, 'email')}
        </span>
      </InfoRow>
      <InfoRow label="Số điện thoại">
        <span className="inline-flex items-center gap-1">
          <span className="font-mono">{userDetails.phone || 'Chưa cập nhật'}</span>
          {userDetails.phone && renderCopyButton(userDetails.phone, 'số điện thoại')}
        </span>
      </InfoRow>
      <InfoRow label="Giới tính">
        {userDetails.gender
          ? GENDER_LABELS[String(userDetails.gender).toLowerCase()] || userDetails.gender
          : 'Chưa cập nhật'}
      </InfoRow>
      <InfoRow label="Ngày sinh">{userDetails.dob ? formatVnDate(userDetails.dob) : 'Chưa cập nhật'}</InfoRow>
      <InfoRow label="Loại đăng nhập">{getLoginTypeLabel(userDetails.login_type)}</InfoRow>
      <InfoRow label="Ngày tạo tài khoản">
        {userDetails.account_created_at ? formatVnDateTime(userDetails.account_created_at) : '-'}
      </InfoRow>
      <InfoRow label="Cập nhật lần cuối">{formatVnDateTime(userDetails.user_updated_at)}</InfoRow>
    </div>
  );

  const renderBookingStats = () => (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">Thống kê đặt vé</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Tổng số đơn" value={userDetails.total_bookings ?? 0} />
        <StatTile label="Đơn đã thanh toán" value={userDetails.paid_bookings ?? 0} />
        <StatTile label="Tổng chi tiêu" value={formatVnd(userDetails.total_spent ?? 0)} />
        <StatTile
          label="Đặt gần nhất"
          value={<span className="text-sm">{userDetails.last_booking_at ? formatVnDateTime(userDetails.last_booking_at) : 'Chưa đặt'}</span>}
        />
      </div>
      <p className="text-xs text-slate-500">Tổng số đơn gồm cả đơn chưa thanh toán và đã hủy. Tổng chi tiêu chỉ tính đơn đã thanh toán.</p>
    </div>
  );

  const renderRecentBookings = () => {
    const bookings: any[] = userDetails.recent_bookings || [];
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Đơn đặt vé gần đây</h3>
        <div className={`${ADMIN_CARD} overflow-hidden`}>
          {bookings.length === 0 ? (
            <EmptyState title="Chưa có đơn đặt vé" />
          ) : (
            <Table>
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className={`${ADMIN_TH} py-2`}>Mã đơn</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2`}>Phim / gói vé</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2 text-center`}>Số vé</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2`}>Thanh toán</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2 text-center`}>Trạng thái</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2 text-right`}>Thành tiền</TableHead>
                  <TableHead className={`${ADMIN_TH} py-2`}>Ngày đặt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking: any, row_no: number) => (
                  <TableRow key={booking.booking_code || row_no} className="border-b border-slate-100">
                    <TableCell className="font-mono text-xs text-slate-700">{booking.booking_code || '-'}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-900">
                      {booking.movie_title || booking.ticket_package_name || 'Không xác định'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-700">{booking.ticket_count}</TableCell>
                    <TableCell className="text-sm text-slate-600">{paymentMethodLabel(booking.payment_method)}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={booking.payment_status || 'unknown'} />
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-900">{formatVnd(booking.total_price ?? 0)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{formatVnDateTime(booking.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-xs text-slate-500">Hiển thị tối đa 10 đơn mới nhất, gồm cả đơn chưa thanh toán và đã hủy.</p>
      </div>
    );
  };

  const renderDetailBody = () => {
    if (isLoadingDetails) return <InlineLoading />;
    if (detailsError) {
      return (
        <div className="rounded-xl border border-red-100 bg-red-50 py-12 text-center text-sm font-semibold text-red-600">{detailsError}</div>
      );
    }
    if (!userDetails) return <EmptyState title="Không tìm thấy thông tin chi tiết" />;
    return (
      <div className="space-y-6">
        {renderAccountInfo()}
        {renderBookingStats()}
        {renderRecentBookings()}
      </div>
    );
  };

  const renderDetailLockButton = () => {
    if (!canLock || !userDetails) return undefined;
    const target = { id: Number(userDetails.id), fullname: userDetails.fullname, is_locked: !userDetails.is_active };
    return userDetails.is_active ? (
      <button type="button" className={LOCK_BUTTON_CLASS} onClick={() => openLockConfirm(target)}>
        <Lock className="h-4 w-4" />
        Khóa tài khoản
      </button>
    ) : (
      <button type="button" className={UNLOCK_BUTTON_CLASS} onClick={() => openLockConfirm(target)}>
        <LockOpen className="h-4 w-4" />
        Mở khóa tài khoản
      </button>
    );
  };

  // LOCK / UNLOCK CONFIRMATION
  const renderLockConfirm = () => {
    const isUnlock = Boolean(lockTarget?.is_locked);
    return (
      <ConfirmDialog
        open={Boolean(lockTarget)}
        onOpenChange={(open) => {
          if (!open && !isLockBusy) setLockTarget(null);
        }}
        variant={isUnlock ? 'restore' : 'warning'}
        title={isUnlock ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        confirmText={isUnlock ? 'Mở khóa' : 'Khóa tài khoản'}
        busy={isLockBusy}
        onConfirm={handleConfirmLock}
        description={
          isUnlock ? (
            <span>
              Mở khóa tài khoản của <strong>{lockTarget?.fullname}</strong>? Khách hàng sẽ đăng nhập và đặt vé được trở lại.
            </span>
          ) : (
            <span className="block space-y-3">
              <span className="block">
                Khóa tài khoản của <strong>{lockTarget?.fullname}</strong>? Khách hàng sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng
                nhập cho đến khi được mở khóa.
              </span>
              <span className="block">
                <label htmlFor="fmi_lock_reason" className="mb-1 block text-xs font-medium text-slate-700">
                  Lý do khóa (không bắt buộc)
                </label>
                <Textarea
                  id="fmi_lock_reason"
                  value={lockReason}
                  maxLength={LOCK_REASON_MAX_LENGTH}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Ví dụ: Nghi ngờ gian lận thanh toán"
                  rows={3}
                  className="rounded-xl border-slate-300 text-sm"
                />
              </span>
            </span>
          )
        }
      />
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Quản lý người dùng" description={`Tổng cộng ${usersLength} người dùng trong hệ thống`} />

      {renderToolbar()}

      <div className={`${ADMIN_CARD} overflow-hidden`}>{renderTable()}</div>

      <AdminPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} totalLabel={`${usersLength} người dùng`} />

      <AdminDialog
        open={isDetailsOpen}
        onClose={handleCloseDetails}
        mode="view"
        size="lg"
        icon={<User className="h-5 w-5" />}
        title={userDetails?.fullname || 'Chi tiết người dùng'}
        subtitle="Thông tin tài khoản khách hàng"
        titleExtra={userDetails ? <StatusBadge status={userDetails.is_active ? 'active' : 'locked'} /> : undefined}
        footer={<AdminDialogFooter onCancel={handleCloseDetails} cancelText={ADMIN_TEXT.close} leading={renderDetailLockButton()} />}
      >
        {renderDetailBody()}
      </AdminDialog>

      {renderLockConfirm()}
    </div>
  );
}
