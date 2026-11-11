import React, { useState, useEffect } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { getTransactionById, exportTransactions } from '@/lib/api';
import { EMPTY_VALUE, formatVnd, formatVnDateTime, paymentMethodLabel } from '@/lib/format';
import { exportTransactionsData } from '@/lib/exportUtils';
import {
  CheckCheck,
  CheckIcon,
  Clock,
  Copy,
  TicketIcon,
  UserIcon,
  Search,
  Loader2,
  RefreshCw,
  SortAsc,
  SortDesc,
  FilterX,
  Gamepad2,
  Film,
  Download,
  FileSpreadsheet,
  Tag
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge, type StatusTone } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton, InlineLoading } from '@/components/admin/common/EmptyState';
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
  parseApplicableIds,
  isLineDiscounted,
  vrPackageId,
  voucherScopeLabel
} from '@shared/booking-invoice';

interface Tx {
  id: string;
  booking_code?: string;
  userId?: number | null;
  transactionId: string;
  email: string;
  phone?: string;
  userName: string;
  ticket_package_name: string;
  vr_items?: Array<{ package_name: string; quantity: number }>;
  ticketCount: number;
  totalPrice: number;
  originalTotalPrice?: number;
  paymentMethod: string;
  paymentStatus: string;
  is_used: boolean;
  createdAt: Date;
  paidAt?: Date | null;
  updatedAt?: Date | null;
  expired: boolean;
  branch_id?: number | null;
  created_by_staff_name?: string;
  updated_by_staff_name?: string;
  booking_type?: 'movie' | 'vr' | string;
  voucher_id?: number | null;
  voucher_code?: string | null;
  voucher_discount_amount?: number;
  sale_staff_id?: number | null;
  sale_name?: string | null;
  sale_email?: string | null;
  payment_expires_at?: string | null;
}

// Helper Countdown Component cho Transaction Modal
const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0 });
      } else {
        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ minutes, seconds });
      }
    };

    updateTimer();
    const t = setInterval(updateTimer, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (!timeLeft) return null;
  const isDanger = timeLeft.minutes === 0 && timeLeft.seconds < 30;

  return (
    <div
      className={`font-mono font-black text-[11px] px-2 py-0.5 rounded-full border -mb-[1px] tracking-tight ${
        isDanger ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-200'
      }`}
    >
      {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
    </div>
  );
};

const parsePackageName = (name: string, t?: Tx) => {
  const typeBadgeStr = t?.booking_type === 'vr' ? 'Trải nghiệm VR' : t?.booking_type === 'combo_vr' ? 'Combo phim + VR' : 'Gói vé phim';
  
  let vrItemsList: React.ReactNode = null;
  if (t?.booking_type === 'combo_vr' || t?.booking_type === 'vr') {
    if (t.vr_items && t.vr_items.length > 0) {
      vrItemsList = t.vr_items.map((it, idx) => (
        <span key={`vr-${idx}`} className="truncate text-slate-500 mt-0.5 text-[11px] block max-w-[160px]" title={`${it.package_name} (x${it.quantity})`}>
          • {it.package_name} (x{it.quantity})
        </span>
      ));
    }
    if (!vrItemsList && t?.booking_type === 'combo_vr') {
      vrItemsList = (
        <span className="truncate text-slate-500 mt-0.5 text-[11px] block max-w-[160px]">
          • Kèm tùy chọn VR (x{Math.max((t?.ticketCount || 1) - 1, 1)})
        </span>
      );
    }
  }

  let movieItemsList: React.ReactNode = null;
  if (t?.booking_type !== 'vr') {
    try {
      const trimmed = (name || '').trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          movieItemsList = parsed.map((item, idx) => (
            <span key={idx} className="truncate text-slate-500 mt-0.5 text-[11px] block max-w-[160px]" title={`${item.name || 'Gói vé'} (x${item.quantity || 1})`}>
              • {item.name || 'Gói vé'} (x{item.quantity || 1})
            </span>
          ));
        }
      }
    } catch (e) {}
    
    if (!movieItemsList) {
      movieItemsList = (
        <span className="truncate text-slate-500 mt-0.5 text-[11px] block max-w-[160px]" title={name || '---'}>
          • {name || '---'}
        </span>
      );
    }
  }
  
  return (
    <div className="flex flex-col gap-0.5 max-w-[160px]">
      <span className="font-bold text-slate-800 text-[11px] uppercase truncate" title={typeBadgeStr}>
        {typeBadgeStr}
      </span>
      {movieItemsList}
      {vrItemsList}
    </div>
  );
};

// Status shown in the list: payment status first, then the ticket use state of a paid order
const getTxListStatus = (tx: Tx): { text: string; tone: StatusTone } => {
  if (tx.paymentStatus === 'expired') return { text: 'Đã hết hạn', tone: 'neutral' };
  if (tx.paymentStatus === 'failed' || tx.paymentStatus === 'cancelled') return { text: 'Đã hủy', tone: 'danger' };
  if (tx.paymentStatus === 'pending') return { text: 'Chờ thanh toán', tone: 'warning' };
  if (tx.paymentStatus === 'paid') {
    if (tx.is_used) return { text: 'Đã sử dụng', tone: 'info' };
    if (tx.expired) return { text: 'Đã quá hạn', tone: 'warning' };
    return { text: 'Đang đợi dùng', tone: 'success' };
  }
  return { text: 'Không rõ', tone: 'neutral' };
};

const FILTER_SELECT_CLASS =
  'h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-600/20';

const ICON_BUTTON_CLASS =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95';

interface Props {
  data: Tx[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  txQuery: string;
  setTxQuery: (q: string) => void;
  transactionsLength: number;
  onRefresh: () => void;
  txStatus?: 'paid' | 'all';
  setTxStatus?: (status: 'paid' | 'all') => void;
  sortKey?: 'created_at' | 'paid_at';
  sortDir?: 'asc' | 'desc';
  setSortKey?: (k: 'created_at' | 'paid_at') => void;
  setSortDir?: (d: 'asc' | 'desc') => void;
  paymentMethod?: string;
  setPaymentMethod?: (m: string) => void;
  fromDate?: string;
  toDate?: string;
  setFromDate?: (v: string) => void;
  setToDate?: (v: string) => void;
  bookingTypeFilter?: 'all' | 'movie' | 'vr';
  setBookingTypeFilter?: (v: 'all' | 'movie' | 'vr') => void;
  isLoading?: boolean;
  branches?: any[];
  selectedBranchId?: number | 'all' | null;
  setSelectedBranchId?: (id: number | 'all' | null) => void;
}

export default function TransactionsContent({
  data,
  totalPages,
  currentPage,
  setPage,
  txQuery,
  setTxQuery,
  transactionsLength,
  onRefresh,
  txStatus = 'paid',
  setTxStatus,
  sortKey = 'created_at',
  sortDir = 'desc',
  setSortKey = () => {},
  setSortDir = () => {},
  paymentMethod = '',
  setPaymentMethod = () => {},
  fromDate = '',
  toDate = '',
  setFromDate = () => {},
  setToDate = () => {},
  bookingTypeFilter = 'all',
  setBookingTypeFilter = () => {},
  isLoading = false,
  branches = [],
  selectedBranchId = null,
  setSelectedBranchId = () => {}
}: Props) {
  const navigate = useNavigate();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [selectedTxSummary, setSelectedTxSummary] = useState<Tx | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  useEffect(() => {
    if (isDetailsOpen && selectedTxId) {
      (async () => {
        try {
          setIsLoadingDetails(true);
          setDetailsError(null);
          setTxDetails(null);
          const details = await getTransactionById(selectedTxId);
          setTxDetails(details);
        } catch (err) {
          setDetailsError('Không thể tải thông tin giao dịch');
          console.error('Lỗi load transaction details:', err);
        } finally {
          setIsLoadingDetails(false);
        }
      })();
    }
  }, [isDetailsOpen, selectedTxId]);

  // Header values come from the list row until the detail has loaded
  const headerBookingCode = txDetails?.booking_details?.booking_code || selectedTxSummary?.booking_code || '';
  const headerTotalPrice = txDetails?.booking_details?.total_price ?? selectedTxSummary?.totalPrice;

  // Voucher and sale attribution, shown inside the price section so the discount reads next to the amounts
  const renderVoucherSummary = () => {
    const voucher = txDetails?.voucher_info;
    if (!voucher?.voucher_code && !voucher?.sale_name) return null;
    const discountAmount = Number(voucher.voucher_discount_amount || 0);
    const saleLabel = voucher.sale_name
      ? `${voucher.sale_name}${voucher.sale_email ? ` (${voucher.sale_email})` : ''}`
      : 'Voucher chung';
    return (
      <div className="grid grid-cols-3 gap-3 border-t border-purple-200/40 pt-3">
        <InfoRow label="Mã voucher" value={voucher.voucher_code || EMPTY_VALUE} bold color="text-purple-700" />
        <InfoRow
          label={voucher.scope ? voucherScopeLabel(voucher.scope) : 'Giảm giá'}
          value={discountAmount > 0 ? `-${formatVnd(discountAmount)}` : formatVnd(0)}
          bold
          color="text-emerald-700"
        />
        <InfoRow label="Sale phụ trách" value={saleLabel} bold color="text-blue-700" />
      </div>
    );
  };

  const handleViewDetails = (tx: Tx) => {
    setSelectedTxId(Number(tx.id));
    setSelectedTxSummary(tx);
    setIsDetailsOpen(true);
  };
  const SectionHeader = ({ color, title, icon }) => (
    <div className={`flex items-center gap-2 ${color} mb-2`}>
      {icon}
      <h3 className="font-semibold text-xs text-gray-500">{title}</h3>
    </div>
  );

  // Thêm dấu "?" sau tên các thuộc tính để TypeScript hiểu chúng không bắt buộc
  const InfoRow = ({
    label,
    value,
    color = 'text-gray-800',
    bold,
    large,
    tooltip
  }: {
    label: string;
    value: any;
    color?: string;
    bold?: boolean;
    large?: boolean;
    tooltip?: string;
  }) => (
    <div>
      <p className="text-xs text-gray-400 font-medium leading-tight">{label}</p>
      <p
        className={`
      ${large ? 'text-2xl font-black' : 'text-sm'} 
      ${bold ? 'font-bold' : 'font-medium'} 
      ${color} mt-0.5 ${tooltip ? 'cursor-help' : ''}
    `}
        title={tooltip || ''}
      >
        {value || '---'}
      </p>
    </div>
  );

  // One date format for the whole screen, always in Vietnam time
  const formatDate = (date) => formatVnDateTime(date);
  const CopyableText = ({ text, label }: { text: string; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        notify.copied(label || '');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // The clipboard can be blocked (no permission, not https), so say so instead of claiming success
        notify.error('Không sao chép được, hãy chọn và sao chép thủ công');
      }
    };

    return (
      <span
        onClick={handleCopy}
        className="group inline-flex cursor-pointer items-center gap-2 transition-all hover:opacity-80"
      >
        <span className="font-mono">{text}</span>
        {copied ? (
          <CheckCheck size={14} className="text-emerald-500" />
        ) : (
          <Copy size={14} className="text-slate-400 group-hover:text-blue-500" />
        )}
      </span>
    );
  };
  const isSuperAdmin = useIsSuperAdmin();
  const permissions = useStaffPermissions();
  const canExport =
    isSuperAdmin ||
    permissions.some(
      (p) => (p.module === 'transactions' || p.module === '*') && (p.action === 'export' || p.action === '*')
    );
  const [localTxQuery, setLocalTxQuery] = useState(txQuery);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setLocalTxQuery(txQuery);
  }, [txQuery]);

  const handleSearchTx = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTxQuery(localTxQuery);
    setPage(1);
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      notify.info('Đang chuẩn bị dữ liệu xuất...');
      const res = await exportTransactions({
        searchText: txQuery,
        status: txStatus,
        sort: sortKey,
        dir: sortDir,
        payment_method: paymentMethod || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        branch_id: selectedBranchId,
        booking_type: bookingTypeFilter
      });
      const items = res?.items || [];
      if (items.length === 0) {
        notify.error('Không tìm thấy giao dịch nào phù hợp với bộ lọc');
        return;
      }
      exportTransactionsData(items, branches, 'danh_sach_giao_dich_tat_ca');
      if (res?.truncated) {
        notify.warning(
          `Chỉ xuất ${items.length} trong ${res.total} dòng`,
          'Hãy thu hẹp bộ lọc (khoảng ngày, chi nhánh) rồi xuất lại phần còn lại.'
        );
      } else {
        notify.success(`Đã xuất thành công ${items.length} giao dịch ra file Excel/CSV`);
      }
    } catch (err: any) {
      notify.error(err, 'Lỗi xuất dữ liệu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCurrentPage = () => {
    if (!data || data.length === 0) {
      notify.error('Không có dữ liệu trên trang hiện tại để xuất');
      return;
    }
    exportTransactionsData(data, branches, `danh_sach_giao_dich_trang_${currentPage}`);
    notify.success(`Đã xuất ${data.length} giao dịch trang ${currentPage} ra file Excel/CSV`);
  };

  // One badge for the state of the open transaction, used in the modal title and in its payment section
  const renderTxStatusBadge = (showCountdown: boolean) => {
    const paymentStatus = txDetails?.payment_info?.payment_status;
    const isUsed = txDetails?.booking_details?.is_used;
    const isExpired = txDetails?.payment_info?.expired;
    if (paymentStatus === 'paid') {
      if (isUsed) return <StatusBadge tone="info">Đã sử dụng</StatusBadge>;
      if (isExpired) return <StatusBadge tone="warning">Đã quá hạn</StatusBadge>;
      return <StatusBadge tone="success">Đang đợi dùng</StatusBadge>;
    }
    if (paymentStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-2">
          {showCountdown && txDetails?.payment_expires_at && <CountdownTimer targetDate={txDetails.payment_expires_at} />}
          <StatusBadge status="pending" />
        </span>
      );
    }
    if (paymentStatus === 'expired') return <StatusBadge status="expired" />;
    if (paymentStatus === 'failed' || paymentStatus === 'cancelled') return <StatusBadge tone="danger">Đã hủy</StatusBadge>;
    return null;
  };

  const hasListFilter = Boolean(txQuery || fromDate || toDate || paymentMethod || bookingTypeFilter !== 'all');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lịch sử giao dịch"
        description={`${transactionsLength} giao dịch. Quản lý, đối soát và xuất file thống kê doanh thu hệ thống.`}
        actions={
          <>
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isExporting}
                    className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2 disabled:opacity-50`}
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span>Xuất Excel / CSV</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl border-slate-200 p-1.5 shadow-lg">
                  <DropdownMenuItem
                    onClick={handleExportAll}
                    className="cursor-pointer gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4 text-slate-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Xuất toàn bộ theo bộ lọc</span>
                      <span className="text-[11px] text-slate-400">({transactionsLength} giao dịch)</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportCurrentPage}
                    className="cursor-pointer gap-2.5 rounded-lg border-t border-slate-100 px-3 py-2.5 text-xs font-medium hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-slate-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Xuất trang hiện tại</span>
                      <span className="text-[11px] text-slate-400">({data.length} giao dịch)</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <button type="button" onClick={onRefresh} className={`${ADMIN_BTN_OUTLINE} inline-flex items-center gap-2`}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {ADMIN_TEXT.refresh}
            </button>
          </>
        }
      />

      <div className={`${ADMIN_CARD} flex flex-col gap-4 p-4`}>
        {/* ROW 1: Primary — tìm kiếm + phân loại + trạng thái */}
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={handleSearchTx}
            className="flex flex-1 min-w-[260px] max-w-md gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                aria-label="Tìm email, số điện thoại hoặc mã đặt chỗ"
                placeholder="Tìm email, SĐT hoặc mã đặt chỗ..."
                value={localTxQuery}
                onChange={(e) => setLocalTxQuery(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 transition-all focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <button type="submit" className={`${ADMIN_BTN_PRIMARY} inline-flex shrink-0 items-center gap-2`}>
              <Search className="h-4 w-4" />
              {ADMIN_TEXT.search}
            </button>
          </form>

          {/* Pills loại booking */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 h-10">
            <button
              onClick={() => { setBookingTypeFilter?.('all'); setPage(1); }}
              className={`px-3 h-7 rounded-lg text-xs font-bold transition-all ${bookingTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >Tất cả</button>
            <button
              onClick={() => { setBookingTypeFilter?.('movie'); setPage(1); }}
              className={`px-3 h-7 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${bookingTypeFilter === 'movie' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
            ><Film size={11} /> Vé Phim</button>
            <button
              onClick={() => { setBookingTypeFilter?.('vr'); setPage(1); }}
              className={`px-3 h-7 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${bookingTypeFilter === 'vr' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-purple-600'}`}
            ><Gamepad2 size={11} /> Trải nghiệm VR</button>
          </div>

          {/* Toggle đã thanh toán */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 h-10">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Đã thanh toán</span>
            <Switch
              checked={txStatus === 'paid'}
              onCheckedChange={(val) => setTxStatus?.(val ? 'paid' : 'all')}
              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
            />
          </div>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-slate-100" />

        {/* ROW 2: Secondary — lọc theo điều kiện */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 h-10">
              <span className="text-[11px] font-medium text-slate-400">Từ</span>
              <Input
                type="date"
                value={fromDate}
                aria-label="Từ ngày"
                onChange={(e) => setFromDate?.(e.target.value)}
                className="w-36 h-7 bg-white border-0 shadow-sm text-xs rounded-lg px-2"
              />
              <span className="text-slate-300">—</span>
              <span className="text-[11px] font-medium text-slate-400">Đến</span>
              <Input
                type="date"
                value={toDate}
                aria-label="Đến ngày"
                onChange={(e) => setToDate?.(e.target.value)}
                className="w-36 h-7 bg-white border-0 shadow-sm text-xs rounded-lg px-2"
              />
            </div>

            {/* Sắp xếp theo */}
            <select
              value={sortKey}
              aria-label="Sắp xếp theo"
              onChange={(e) => setSortKey(e.target.value as any)}
              className={`${FILTER_SELECT_CLASS} w-44`}
            >
              <option value="created_at">Thời gian tạo</option>
              <option value="paid_at">Thời gian thanh toán</option>
            </select>

            {/* Phương thức thanh toán */}
            <select
              value={paymentMethod}
              aria-label="Phương thức thanh toán"
              onChange={(e) => setPaymentMethod?.(e.target.value)}
              className={`${FILTER_SELECT_CLASS} w-40`}
            >
              <option value="">Tất cả phương thức</option>
              <option value="cash">Tiền mặt</option>
              <option value="vietqr">VietQR</option>
            </select>

            {/* Chi nhánh */}
            {branches.length > 0 ? (
              <select
                value={selectedBranchId || 'all'}
                aria-label="Chi nhánh"
                onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className={`${FILTER_SELECT_CLASS} w-40`}
              >
                {isSuperAdmin && <option value="all">Tất cả chi nhánh</option>}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Đang tải chi nhánh...</span>
              </div>
            )}
          </div>

          {/* Sort dir + Clear */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
              className={ICON_BUTTON_CLASS}
              title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              aria-label={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
            >
              {sortDir === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className={ICON_BUTTON_CLASS}
              title="Xóa bộ lọc"
              aria-label="Xóa bộ lọc"
              onClick={() => {
                setTxQuery('');
                setTxStatus?.('paid');
                setSortKey?.('created_at');
                setSortDir?.('desc');
                setPaymentMethod?.('');
                setFromDate?.('');
                setToDate?.('');
                setBookingTypeFilter?.('all');
                setPage(1);
                notify.info('Đã đặt lại bộ lọc');
              }}
            >
              <FilterX className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu đã tối ưu cột */}
      <div className={`${ADMIN_CARD} overflow-hidden`}>
        <div>
          <Table className="w-full">
            <TableHeader className={ADMIN_TABLE_HEAD}>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className={`w-[110px] px-2 text-center ${ADMIN_TH}`}>Mã đặt chỗ</TableHead>
                <TableHead className={`w-[110px] px-2.5 ${ADMIN_TH}`}>Chi nhánh</TableHead>
                <TableHead className={`w-[175px] px-2.5 ${ADMIN_TH}`}>Người dùng</TableHead>
                <TableHead className={`w-[72px] px-1.5 text-center ${ADMIN_TH}`}>Loại</TableHead>
                <TableHead className={`w-[162px] px-2.5 ${ADMIN_TH}`}>Sản phẩm</TableHead>
                <TableHead className={`w-[58px] whitespace-nowrap px-1 text-center ${ADMIN_TH}`}>SL</TableHead>
                <TableHead className={`w-[95px] px-2 ${ADMIN_TH}`}>Doanh thu</TableHead>
                <TableHead className={`w-[130px] px-2 ${ADMIN_TH}`}>Thời gian</TableHead>
                <TableHead className={`w-[76px] whitespace-nowrap px-1 text-center ${ADMIN_TH}`}>Phương thức</TableHead>
                <TableHead className={`w-[90px] pl-1 pr-3 text-right ${ADMIN_TH}`}>{ADMIN_TEXT.actionColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <TableSkeleton rows={5} />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyState
                      title={hasListFilter ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch'}
                      description={hasListFilter ? 'Thử đổi từ khóa hoặc khoảng thời gian.' : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((t) => {
                    const config = getTxListStatus(t);
                    return (
                      <TableRow
                        key={t.id}
                        className="hover:bg-gray-50 transition-colors border-b border-gray-200 min-h-[52px]"
                      >
                        <TableCell className="font-mono text-xs text-gray-600 text-center px-2" title={`Mã đặt chỗ: ${t.booking_code || t.id}`}>
                          {t.booking_code || `#${t.id}`}
                        </TableCell>
                        <TableCell className="px-2.5">
                          <div
                            className="text-[12px] font-medium text-slate-600 truncate max-w-[105px]"
                            title={branches.find((b) => b.id === t.branch_id)?.name || 'Tất cả chi nhánh'}
                          >
                            {branches.find((b) => b.id === t.branch_id)?.name || (
                              <span className="italic text-slate-400">Tất cả chi nhánh</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2.5">
                          <div className="flex flex-col max-w-[170px]">
                            <span className="font-semibold text-xs text-gray-900 truncate" title={t.userName || 'Khách vãng lai'}>
                              {t.userName || 'Khách vãng lai'}
                            </span>
                            <span className="text-[11px] text-gray-500 truncate" title={t.email}>{t.email}</span>
                            {t.phone && (
                              <span className="text-[11px] text-gray-500 truncate" title={t.phone}>{t.phone}</span>
                            )}
                            {t.voucher_code && (
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono text-[11px] font-bold truncate max-w-[110px]" title={t.voucher_code}>
                                  <Tag size={10} className="mr-1 shrink-0" />
                                  {t.voucher_code}
                                </span>
                                {t.sale_name && (
                                  <span className="text-[11px] text-blue-600 font-semibold truncate max-w-[55px]" title={t.sale_name}>
                                    {t.sale_name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-1.5">
                          {t.booking_type === 'combo_vr' ? (
                            <StatusBadge tone="warning" className="gap-1 px-1.5 text-[11px]">
                              <Film size={9} /> Phim, VR
                            </StatusBadge>
                          ) : t.booking_type === 'vr' ? (
                            <StatusBadge tone="neutral" className="gap-1 px-1.5 text-[11px]">
                              <Gamepad2 size={9} /> VR
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="info" className="gap-1 px-1.5 text-[11px]">
                              <Film size={9} /> Phim
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="px-2.5 font-medium text-[11px] text-slate-700 leading-tight">
                          {parsePackageName(t.ticket_package_name, t)}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-slate-800 text-xs px-1">
                          {t.ticketCount}
                        </TableCell>
                        <TableCell className="font-bold text-blue-700 text-xs px-2 whitespace-nowrap">
                          <div>{formatVnd(t.totalPrice)}</div>
                          {t.voucher_discount_amount && t.voucher_discount_amount > 0 ? (
                            <div className="text-[11px] text-emerald-600 font-medium">
                              -{formatVnd(t.voucher_discount_amount)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500 font-medium px-2">
                          {(() => {
                            // Cancelled, failed and expired orders show when they stopped, paid orders when they were paid
                            const isStopped = ['failed', 'cancelled', 'expired'].includes(t.paymentStatus);
                            const dateToUse =
                              t.paymentStatus === 'paid' && t.paidAt ? t.paidAt : isStopped ? t.updatedAt : t.createdAt;
                            const titleLabel =
                              t.paymentStatus === 'paid' && t.paidAt ? 'Thanh toán' : isStopped ? 'Dừng' : 'Tạo';

                            return (
                              <div
                                className="flex flex-col gap-0.5 cursor-help"
                                title={`Thời gian ${titleLabel}: ${formatVnDateTime(dateToUse)}`}
                              >
                                <span className="text-slate-700 font-bold text-[11px]">
                                  {dateToUse
                                    ? formatDistanceToNow(new Date(dateToUse), { addSuffix: true, locale: vi })
                                    : '---'}
                                </span>
                                {/* Exact times, because staff reconcile against the bank statement */}
                                <span className="text-[11px] font-normal text-slate-500 whitespace-nowrap">
                                  Tạo: {formatVnDateTime(t.createdAt)}
                                </span>
                                {t.paidAt && (
                                  <span className="text-[11px] font-normal text-slate-500 whitespace-nowrap">
                                    TT: {formatVnDateTime(t.paidAt)}
                                  </span>
                                )}
                                <StatusBadge tone={config.tone} className="w-fit">
                                  {config.text}
                                </StatusBadge>
                              </div>
                            );
                          })()}
                        </TableCell>

                        <TableCell className="text-center px-1">
                          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 leading-tight block">{paymentMethodLabel(t.paymentMethod)}</span>
                        </TableCell>

                        <TableCell className="pl-1 pr-3 text-right">
                          <RowActions>
                            {(t.paymentStatus === 'paid' || t.paymentStatus === 'pending') && !t.is_used && !t.expired && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/ticket-check?code=' + t.booking_code);
                                }}
                                title="Soát vé nhanh"
                                aria-label="Soát vé nhanh"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-teal-600 transition-colors hover:border-teal-200 hover:bg-teal-50"
                              >
                                <TicketIcon className="h-4 w-4" />
                              </button>
                            )}
                            <RowActionButton action="view" onClick={() => handleViewDetails(t)} />
                          </RowActions>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalLabel={`${transactionsLength} giao dịch`}
      />

      {/* --- MODAL CHI TIẾT GIAO DỊCH --- */}
      <AdminDialog
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        mode="view"
        size="lg"
        title="Chi tiết giao dịch"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              Mã đặt chỗ:
              <span className="font-bold text-slate-900">
                <CopyableText text={headerBookingCode} label="mã đặt chỗ" />
              </span>
            </span>
            <span>
              Tổng tiền: <span className="font-bold text-emerald-700">{formatVnd(headerTotalPrice)}</span>
            </span>
          </span>
        }
        titleExtra={renderTxStatusBadge(true)}
        footer={<AdminDialogFooter onCancel={() => setIsDetailsOpen(false)} cancelText={ADMIN_TEXT.close} />}
      >
        <div>
            {isLoadingDetails ? (
              <InlineLoading />
            ) : detailsError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 py-12 text-center text-sm font-semibold text-red-600">
                {detailsError}
              </div>
            ) : txDetails ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Cột 1: Khách Hàng */}
                  <div className="space-y-4">
                    <SectionHeader color="text-blue-600" title="Khách hàng" icon={<UserIcon size={16} />} />
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4 shadow-sm">
                      <InfoRow label="Họ và Tên" value={txDetails.user?.fullname} bold />
                      <InfoRow label="Email" value={txDetails.user?.email} color="text-blue-600" />
                      <InfoRow
                        label="Email tài khoản"
                        value={txDetails.user?.email_auth ? txDetails.user?.email_auth : 'VÃNG LAI'}
                        color="text-red-600"
                      />
                      <div className="flex justify-between items-end border-t border-slate-200/60 pt-3 gap-2">
                        <InfoRow label="Số điện thoại" value={txDetails.user?.phone} />
                        <InfoRow
                          label="Chi Nhánh"
                          value={txDetails.branch?.name || 'Vãng lai'}
                          bold
                          color="text-slate-900"
                        />
                        <StatusBadge status={txDetails.user?.is_active ? 'active' : 'locked'} />
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Gói & Phim HOẶC Gói VR */}
                  <div className="space-y-4">
                    {txDetails.booking_type === 'vr' ? (
                      <>
                        <SectionHeader color="text-purple-600" title="Trải nghiệm VR" icon={<Gamepad2 size={16} />} />
                        <div className="bg-purple-50/40 rounded-xl p-5 border border-purple-100 space-y-4 shadow-sm">
                          <div className="flex justify-between items-center">
                            <InfoRow label="Tổng gói VR" value={`${txDetails.vr_items?.length || 0} loại`} bold />
                            <span className="text-[14px] font-bold text-slate-600">
                              Tổng lượt chơi:{' '}
                              {Array.isArray(txDetails.vr_items)
                                ? txDetails.vr_items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)
                                : txDetails.booking_details?.ticket_count || 0}
                            </span>
                          </div>
                          {/* Bảng chi tiết vr_items */}
                          {txDetails.vr_items && txDetails.vr_items.length > 0 ? (
                            <div className="border border-purple-100 rounded-lg overflow-hidden bg-white">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-purple-50/60 text-purple-700">
                                  <tr className="border-none">
                                    <th className="py-2 px-2.5 font-bold uppercase text-[11px]">Tên gói VR</th>
                                    <th className="py-2 px-1 font-bold uppercase text-[11px] text-center w-8">SL</th>
                                    <th className="py-2 px-1.5 font-bold uppercase text-[11px] text-right">Đơn giá</th>
                                    <th className="py-2 px-2.5 font-bold uppercase text-[11px] text-right">Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {txDetails.vr_items.map((it: any, idx: number) => {
                                    const qty = Number(it.quantity || 1);
                                    const unit = Number(it.discounted_unit_price ?? it.unit_price ?? 0);
                                    const line = Number(it.line_total ?? unit * qty);
                                    const discounted = isLineDiscounted({
                                      discountAmount: Number(txDetails.voucher_info?.voucher_discount_amount || 0),
                                      scope: txDetails.voucher_info?.scope,
                                      applicableIds: parseApplicableIds(txDetails.voucher_info?.applicable_ids),
                                      kind: 'vr',
                                      packageId: vrPackageId(it)
                                    });
                                    return (
                                      <tr
                                        key={it.id || `vr-${idx}`}
                                        className="border-t border-purple-50 hover:bg-transparent"
                                      >
                                        <td className="py-2 px-2.5">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                                              <Gamepad2 className="w-3 h-3 text-purple-600" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-800 leading-tight">
                                              {it.package_name ||
                                                it.ticket_package?.name ||
                                                `Gói VR #${it.ticket_package_id || idx + 1}`}
                                              {discounted ? (
                                                <span className="inline-block ml-1.5 px-1 py-[1px] align-middle text-[11px] font-black text-rose-600 bg-rose-50 border border-rose-200 rounded">
                                                  ĐƯỢC GIẢM
                                                </span>
                                              ) : null}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-1 text-center font-bold text-slate-700 text-xs">
                                          ×{qty}
                                        </td>
                                        <td className="py-2 px-1.5 text-right text-[11px] text-slate-600">
                                          {formatVnd(unit)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-bold text-purple-700 text-xs">
                                          {formatVnd(line)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-sm bg-purple-50/20 rounded-lg border border-purple-100 border-dashed">
                              (Không có chi tiết gói VR)
                            </div>
                          )}
                          {renderVoucherSummary()}
                          <div className="flex justify-between items-end border-t border-purple-200/30 pt-3">
                            <InfoRow
                              label="Tổng lượt chơi"
                              value={
                                Array.isArray(txDetails.vr_items) && txDetails.vr_items.length > 0
                                  ? txDetails.vr_items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)
                                  : txDetails.booking_details?.ticket_count || 0
                              }
                              large
                              color="text-purple-700"
                            />
                            <div className="text-right">
                              <p className="text-[11px] text-purple-600 uppercase font-bold">Tổng tiền</p>
                              <p className="text-3xl font-black text-emerald-700">
                                {formatVnd(txDetails.booking_details?.total_price)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <SectionHeader
                          color="text-amber-600"
                          title={txDetails.booking_type === 'combo_vr' ? 'Gói vé & VR combo' : 'Gói & phim'}
                          icon={<TicketIcon size={16} />}
                        />
                        <div className="bg-blue-50/40 rounded-xl p-5 border border-blue-100 space-y-4 shadow-sm">
                          {txDetails.movie_title && <InfoRow label="Phim" value={txDetails.movie_title} bold />}
                          {(() => {
                            const discountAmount = Number(txDetails.voucher_info?.voucher_discount_amount || 0);
                            const voucherScope = txDetails.voucher_info?.scope || 'all';
                            const applicableIds = parseApplicableIds(txDetails.voucher_info?.applicable_ids);
                            let isJsonArray = false;
                            let parsedMovieItems: any[] = [];
                            
                            if (txDetails.ticket_package_name || txDetails.ticket_package?.name) {
                              try {
                                const rawString = (txDetails.ticket_package_name || txDetails.ticket_package?.name).trim();
                                if (rawString.startsWith('[') && rawString.endsWith(']')) {
                                  parsedMovieItems = JSON.parse(rawString);
                                  if (Array.isArray(parsedMovieItems)) {
                                    isJsonArray = true;
                                  }
                                }
                              } catch (e) {}
                            }

                            if (isJsonArray && parsedMovieItems.length > 0) {
                              return (
                                <div className="border border-blue-200/60 rounded-lg overflow-hidden bg-white">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-blue-50/70 text-blue-800">
                                      <tr className="border-none">
                                        <th className="py-2 px-2.5 font-bold uppercase text-[11px]">Tên gói / Vé</th>
                                        <th className="py-2 px-1 font-bold uppercase text-[11px] text-center w-8">SL</th>
                                        <th className="py-2 px-1.5 font-bold uppercase text-[11px] text-right">Đơn giá</th>
                                        <th className="py-2 px-2.5 font-bold uppercase text-[11px] text-right">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {parsedMovieItems.map((it: any, idx: number) => {
                                        const qty = Number(it.quantity || 1);
                                        const unit = Number(it.price || it.originalPrice || 0);
                                        const line = unit * qty;
                                        const discounted = isLineDiscounted({
                                          discountAmount,
                                          scope: voucherScope,
                                          applicableIds,
                                          kind: 'movie',
                                          packageId: it.package_id
                                        });
                                        return (
                                          <tr
                                            key={`movie-item-${idx}`}
                                            className="border-t border-blue-100/60 hover:bg-transparent"
                                          >
                                            <td className="py-2 px-2.5">
                                              <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                                                  <TicketIcon className="w-3 h-3 text-blue-700" />
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                                                  {it.name || `Gói vé #${idx + 1}`}
                                                  {discounted ? (
                                                    <span className="inline-block ml-1.5 px-1 py-[1px] align-middle text-[11px] font-black text-rose-600 bg-rose-50 border border-rose-200 rounded">
                                                      ĐƯỢC GIẢM
                                                    </span>
                                                  ) : null}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="py-2 px-1 text-center font-bold text-slate-700 text-xs text-nowrap">
                                              ×{qty}
                                            </td>
                                            <td className="py-2 px-1.5 text-right text-[11px] text-slate-600 text-nowrap">
                                              {formatVnd(unit)}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-bold text-blue-900 text-xs text-nowrap">
                                              {formatVnd(line)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            }

                            return (
                              <div className="flex justify-between items-center bg-white border border-blue-100 rounded-lg p-3">
                                <InfoRow
                                  label="Loại Vé"
                                  value={txDetails.ticket_package?.name || txDetails.ticket_package_name}
                                  bold
                                />
                                <span className="text-[14px] font-bold text-blue-600">
                                  {formatVnd(txDetails.ticket_package?.ticket_unit_price)}
                                </span>
                              </div>
                            );
                          })()}


                          {/* Danh sách VR đi kèm nếu có (Combo VR) */}
                          {txDetails.booking_type === 'combo_vr' && txDetails.vr_items && txDetails.vr_items.length > 0 && (
                            <div className="space-y-1.5 border-t border-blue-200/30 pt-3">
                              <p className="text-[11px] text-gray-500 font-bold uppercase">Gói VR đi kèm:</p>
                              <div className="border border-purple-200/60 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead className="bg-purple-50/70 text-purple-800">
                                    <tr className="border-none">
                                      <th className="py-2 px-2.5 font-bold uppercase text-[11px]">Tên dịch vụ</th>
                                      <th className="py-2 px-1 font-bold uppercase text-[11px] text-center w-8">SL</th>
                                      <th className="py-2 px-1.5 font-bold uppercase text-[11px] text-right">Đơn giá</th>
                                      <th className="py-2 px-2.5 font-bold uppercase text-[11px] text-right">Thành tiền</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txDetails.vr_items.map((it: any, idx: number) => {
                                      const qty = Number(it.quantity || 1);
                                      const unit = Number(it.discounted_unit_price ?? it.unit_price ?? 0);
                                      const line = Number(it.line_total ?? unit * qty);
                                      const discounted = isLineDiscounted({
                                        discountAmount: Number(txDetails.voucher_info?.voucher_discount_amount || 0),
                                        scope: txDetails.voucher_info?.scope,
                                        applicableIds: parseApplicableIds(txDetails.voucher_info?.applicable_ids),
                                        kind: 'vr',
                                        packageId: vrPackageId(it)
                                      });
                                      return (
                                        <tr
                                          key={it.id || `vr-${idx}`}
                                          className="border-t border-purple-100/60 hover:bg-transparent"
                                        >
                                          <td className="py-2 px-2.5">
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                                                <Gamepad2 className="w-3 h-3 text-purple-700" />
                                              </div>
                                              <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                                                {it.package_name || `Gói VR #${idx + 1}`}
                                                {discounted ? (
                                                  <span className="inline-block ml-1.5 px-1 py-[1px] align-middle text-[11px] font-black text-rose-600 bg-rose-50 border border-rose-200 rounded">
                                                    ĐƯỢC GIẢM
                                                  </span>
                                                ) : null}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-2 px-1 text-center font-bold text-slate-700 text-xs text-nowrap">×{qty}</td>
                                          <td className="py-2 px-1.5 text-right text-[11px] text-slate-600 text-nowrap">
                                            {formatVnd(unit)}
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-bold text-purple-900 text-xs text-nowrap">
                                            {formatVnd(line)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {renderVoucherSummary()}
                          <div className="flex justify-between items-end border-t border-blue-200/30 pt-3">
                            <InfoRow
                              label="Số lượng vé"
                              value={(function() {
                                let sum = 0;
                                let isParsed = false;
                                if (txDetails.ticket_package_name || txDetails.ticket_package?.name) {
                                  try {
                                    const raw = (txDetails.ticket_package_name || txDetails.ticket_package?.name).trim();
                                    if (raw.startsWith('[') && raw.endsWith(']')) {
                                      const parsed = JSON.parse(raw);
                                      if (Array.isArray(parsed)) {
                                        sum += parsed.reduce((acc: number, it: any) => acc + Number(it.quantity || 1), 0);
                                        isParsed = true;
                                      }
                                    }
                                  } catch (e) {}
                                }
                                if (!isParsed) {
                                  sum += Number(txDetails.booking_details?.ticket_count || 1);
                                }
                                if (txDetails.booking_type === 'combo_vr' && Array.isArray(txDetails.vr_items)) {
                                  sum += txDetails.vr_items.reduce((acc: number, it: any) => acc + Number(it.quantity || 1), 0);
                                }
                                return sum > 0 ? sum : 1;
                              })()}
                              large
                              color="text-blue-700"
                            />
                            <div className="text-right flex flex-col items-end">
                              <p className="text-[11px] text-blue-600 uppercase font-bold">Tổng tiền</p>
                              {txDetails.voucher_info?.voucher_discount_amount > 0 && (
                                <p className="text-[13px] line-through text-slate-400 font-medium">
                                  {formatVnd(txDetails.booking_details?.original_total_price)}
                                </p>
                              )}
                              <p className="text-3xl font-black text-emerald-700 drop-shadow-sm">
                                {formatVnd(txDetails.booking_details?.total_price)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Phần 3: Trạng thái & Đối soát */}
                <div className="space-y-4">
                  <SectionHeader
                    color="text-emerald-600"
                    title="Đối soát & trạng thái"
                    icon={<CheckIcon size={16} />}
                  />
                  <div
                    className={`bg-white rounded-xl border shadow-sm divide-y divide-slate-100 overflow-hidden ${
                      txDetails.payment_info?.expired ? 'border-red-200' : 'border-slate-200'
                    }`}
                  >
                    {/* Hàng 1: Trạng thái và Check-in */}
                    <div
                      className={`flex justify-between p-5 items-center ${
                        txDetails.payment_info?.expired ? 'bg-red-50/30' : 'bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {renderTxStatusBadge(false) ?? <StatusBadge tone="neutral">Không khả dụng</StatusBadge>}
                      </div>
                    </div>

                    {/* Hàng 2: Mã đặt chỗ & Đối soát */}
                    <div className="grid grid-cols-1 md:grid-cols-3 p-6 gap-8">
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold mb-2">Phương thức</p>
                        <span className="text-[14px] font-bold text-slate-700">
                          {paymentMethodLabel(txDetails.payment_info?.payment_method)}
                        </span>
                      </div>

                      <div className="md:border-x md:px-8">
                        <p className="text-[11px] text-blue-500 uppercase font-bold mb-2 italic whitespace-nowrap">
                          Mã đặt chỗ
                        </p>
                        <div
                          className={`flex items-center gap-2 ${
                            txDetails.payment_info?.expired && !txDetails.booking_details?.is_used
                              ? 'opacity-40 grayscale pointer-events-none' // Làm mờ và chặn tương tác khi hết hạn
                              : ''
                          }`}
                        >
                          {txDetails.booking_details?.booking_code ? (
                            <CopyableText text={txDetails.booking_details.booking_code} label="mã đặt chỗ" />
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">Chưa phát hành</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end">
                        <p className="text-[11px] text-slate-400 uppercase font-bold mb-2">
                          Nội dung chuyển khoản (Đối soát)
                        </p>
                        <div className="bg-slate-100 text-slate-600 px-3 py-2 rounded border border-slate-200 text-[12px] font-mono">
                          <CopyableText
                            text={
                              txDetails.booking_details?.pay_txt_code || txDetails.booking_details?.transaction_id || ''
                            }
                            label="nội dung đối soát"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 3: Timeline, the same three dates for every status */}
                    {(() => {
                      const paymentStatus = txDetails.payment_info?.payment_status;
                      const isUsed = txDetails.booking_details?.is_used;
                      const updatedAt = txDetails.booking_details?.updated_at;
                      const isStopped = ['failed', 'cancelled'].includes(paymentStatus);

                      return (
                        <>
                          <div className="grid grid-cols-3 p-6 gap-3 bg-slate-50/30 text-center">
                            <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                            <InfoRow label="Thanh toán" value={formatDate(txDetails.payment_info?.paid_at)} />
                            <InfoRow
                              label={isStopped ? 'Ngày hủy' : 'Cập nhật'}
                              value={formatDate(updatedAt)}
                              color={isStopped ? 'text-red-600' : 'text-gray-800'}
                            />
                          </div>

                          {/* Used: expiry, when it was used and who confirmed it */}
                          {isUsed && (
                            <div className="grid grid-cols-3 p-6 pt-0 gap-3 bg-slate-50/30 text-center">
                              <InfoRow
                                label="Hạn dùng"
                                value={formatDate(txDetails.payment_info?.expiry_date)}
                                color="text-red-500"
                              />
                              <InfoRow
                                label="Thời điểm sử dụng"
                                value={formatDate(txDetails.booking_details?.checked_in_at)}
                                color="text-blue-600"
                                bold
                              />
                              <InfoRow
                                label="Nhân viên xác nhận"
                                value={
                                  txDetails.booking_details?.confirmed_by_staff_name ||
                                  txDetails.booking_details?.confirmed_by_staff?.fullname ||
                                  '-'
                                }
                                color="text-green-600"
                              />
                            </div>
                          )}

                          {/* Paid and not used: expiry and days left */}
                          {!isUsed && paymentStatus === 'paid' && (
                            <div className="grid grid-cols-2 p-6 pt-0 gap-3 bg-slate-50/30 text-center">
                              <InfoRow
                                label="Hạn dùng"
                                value={formatDate(txDetails.payment_info?.expiry_date)}
                                color="text-red-500"
                              />
                              <InfoRow
                                label="Còn lại"
                                value={
                                  txDetails.payment_info?.expired
                                    ? 'Đã hết hạn sử dụng'
                                    : txDetails.payment_info?.days_left === 0
                                      ? 'Hết hạn hôm nay'
                                      : txDetails.payment_info?.days_left === null
                                        ? '---'
                                        : `${txDetails.payment_info?.days_left} ngày`
                                }
                                color={
                                  txDetails.payment_info?.expired
                                    ? 'text-red-600 font-black'
                                    : (txDetails.payment_info?.days_left ?? 0) <= 2
                                      ? 'text-orange-500'
                                      : 'text-emerald-600'
                                }
                                bold
                                tooltip={
                                  txDetails.payment_info?.expiry_date && !txDetails.payment_info?.expired
                                    ? `Hết hạn: ${formatDate(txDetails.payment_info.expiry_date)}`
                                    : ''
                                }
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Tracking Information */}
            {txDetails?.tracking && (
              <div className="mt-6 p-5 bg-slate-50/30 rounded-xl border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Clock size={16} />
                  Thông tin tạo & cập nhật
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Tạo bởi" value={txDetails.tracking.created_by_staff_name || '-'} />
                  <InfoRow label="Cập nhật bởi" value={txDetails.tracking.updated_by_staff_name || '-'} />
                </div>
              </div>
            )}
        </div>
      </AdminDialog>
    </div>
  );
}
