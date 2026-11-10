import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { getTransactionById, getTransactions, exportTransactions } from '@/lib/api';
import { EMPTY_VALUE, formatVnd, formatVnDateTime, paymentMethodLabel } from '@/lib/format';
import { exportTransactionsData } from '@/lib/exportUtils';
import {
  CheckCircle2,
  CheckCheck,
  CheckIcon,
  Clock,
  Copy,
  TicketIcon,
  Timer,
  UserIcon,
  X,
  XCircle,
  Search,
  Loader2,
  RefreshCw,
  SortAsc,
  SortDesc,
  FilterX,
  Gamepad2,
  Film,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
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

// Page numbers to show: first, last, and two either side of the current page, with 'gap' for skipped runs
const getPageWindow = (currentPage: number, totalPages: number): Array<number | 'gap'> => {
  const pageNumbers: Array<number | 'gap'> = [];
  let previousShown = 0;
  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
    const isEdge = pageNo === 1 || pageNo === totalPages;
    const isNearCurrent = Math.abs(pageNo - currentPage) <= 2;
    if (!isEdge && !isNearCurrent) continue;
    if (pageNo - previousShown > 1) pageNumbers.push('gap');
    pageNumbers.push(pageNo);
    previousShown = pageNo;
  }
  return pageNumbers;
};

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

  const TicketStatusBadge = ({ paymentStatus, isUsed }) => {
    if (paymentStatus === 'pending') {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 py-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse" /> CHỜ THANH TOÁN
        </Badge>
      );
    }
    if (isUsed) {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-1 font-bold">ĐÃ SỬ DỤNG</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 border-green-200 py-1 font-bold">SẴN SÀNG SỬ DỤNG</Badge>;
  };

  // One date format for the whole screen, always in Vietnam time
  const formatDate = (date) => formatVnDateTime(date);
  const CopyableText = ({ text, label }: { text: string; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(`Đã sao chép ${label || ''}`);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // The clipboard can be blocked (no permission, not https), so say so instead of claiming success
        toast.error('Không sao chép được, hãy chọn và sao chép thủ công');
      }
    };

    return (
      <div
        onClick={handleCopy}
        className="group flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all"
      >
        <span className="font-mono">{text}</span>
        {copied ? (
          <CheckCheck size={14} className="text-emerald-500" />
        ) : (
          <Copy size={14} className="text-slate-400 group-hover:text-blue-500" />
        )}
      </div>
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
      toast.info('Đang chuẩn bị dữ liệu xuất...');
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
        toast.error('Không tìm thấy giao dịch nào phù hợp với bộ lọc');
        return;
      }
      exportTransactionsData(items, branches, 'danh_sach_giao_dich_tat_ca');
      if (res?.truncated) {
        toast.warning('Chỉ xuất ' + items.length + ' trong ' + res.total + ' dòng', {
          description: 'Hãy thu hẹp bộ lọc (khoảng ngày, chi nhánh) rồi xuất lại phần còn lại.'
        });
      } else {
        toast.success(`Đã xuất thành công ${items.length} giao dịch ra file Excel/CSV!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xuất dữ liệu');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCurrentPage = () => {
    if (!data || data.length === 0) {
      toast.error('Không có dữ liệu trên trang hiện tại để xuất');
      return;
    }
    exportTransactionsData(data, branches, `danh_sach_giao_dich_trang_${currentPage}`);
    toast.success(`Đã xuất ${data.length} giao dịch trang ${currentPage} ra file Excel/CSV!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Lịch sử giao dịch
              <Badge
                variant="secondary"
                className="rounded-full bg-slate-100 text-slate-600 px-2 py-0 h-5 text-[11px] font-bold"
              >
                {transactionsLength}
              </Badge>
            </h1>
            <p className="text-xs text-slate-500">Quản lý, đối soát và xuất file thống kê doanh thu hệ thống.</p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isExporting}
                    className="h-10 px-4 rounded-xl border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-xs flex items-center gap-2 text-xs transition-all"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>Xuất Excel / CSV</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl w-60 p-1.5 shadow-lg border-slate-200">
                  <DropdownMenuItem
                    onClick={handleExportAll}
                    className="cursor-pointer gap-2.5 py-2.5 px-3 text-xs font-medium rounded-lg hover:bg-emerald-50 hover:text-emerald-900"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Xuất toàn bộ theo bộ lọc</span>
                      <span className="text-[11px] text-slate-400">({transactionsLength} giao dịch)</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportCurrentPage}
                    className="cursor-pointer gap-2.5 py-2.5 px-3 text-xs font-medium rounded-lg hover:bg-blue-50 hover:text-blue-900 border-t border-slate-100"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="font-semibold">Xuất trang hiện tại</span>
                      <span className="text-[11px] text-slate-400">({data.length} giao dịch)</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="h-px bg-slate-100 my-2" />

        {/* ROW 1: Primary — tìm kiếm + phân loại + trạng thái */}
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTxQuery(localTxQuery);
              setPage(1);
            }}
            className="flex flex-1 min-w-[260px] max-w-md gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                aria-label="Tìm email, số điện thoại hoặc mã đặt chỗ"
                placeholder="Tìm email, SĐT hoặc mã đặt chỗ..."
                value={localTxQuery}
                onChange={(e) => setLocalTxQuery(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
              />
            </div>
            <Button
              type="submit"
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" /> Tìm
            </Button>
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
              className="h-10 px-3 bg-white border rounded-xl text-xs w-44 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="created_at">Thời gian tạo</option>
              <option value="paid_at">Thời gian thanh toán</option>
            </select>

            {/* Phương thức thanh toán */}
            <select
              value={paymentMethod}
              aria-label="Phương thức thanh toán"
              onChange={(e) => setPaymentMethod?.(e.target.value)}
              className="h-10 px-3 bg-white border rounded-xl text-xs w-40 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="h-10 px-3 bg-white border rounded-xl text-xs w-40 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
              className="rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm w-10 h-10 shrink-0"
              title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
            >
              {sortDir === 'desc' ? <SortDesc className="w-4 h-4 text-slate-600" /> : <SortAsc className="w-4 h-4 text-slate-600" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 w-10 h-10 rounded-xl transition-all shadow-sm shrink-0"
              title="Xóa bộ lọc"
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
                toast.info('Đã đặt lại bộ lọc');
              }}
            >
              <FilterX size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu đã tối ưu cột */}
      <Card className="border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <Table className="w-full">
            <TableHeader className="bg-gray-50 border-b">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[110px] px-2 text-center text-xs">Mã đặt chỗ</TableHead>
                <TableHead className="w-[110px] px-2.5 text-xs">Chi nhánh</TableHead>
                <TableHead className="w-[175px] px-2.5 text-xs">Người dùng</TableHead>
                <TableHead className="text-center w-[72px] px-1.5 text-xs">Loại</TableHead>
                <TableHead className="w-[162px] px-2.5 text-xs">Sản phẩm</TableHead>
                <TableHead className="text-center w-[58px] px-1 text-xs whitespace-nowrap">SL</TableHead>
                <TableHead className="w-[95px] px-2 text-xs">Doanh thu</TableHead>
                <TableHead className="w-[130px] px-2 text-xs">Thời gian</TableHead>
                <TableHead className="text-center w-[76px] px-1 text-xs whitespace-nowrap">Phương thức</TableHead>
                <TableHead className="text-right w-[115px] pr-3 pl-1 text-xs">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell colSpan={10} className="px-3">
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.map((t) => {
                    // 1. Tối ưu logic xác định trạng thái hiển thị
                    const getStatusConfig = () => {
                      // Trường hợp 1: Thanh toán quá hạn (expired - chưa thanh toán)
                      if (t.paymentStatus === 'expired') {
                        return {
                          text: 'Đã hết hạn',
                          style: 'border-slate-200 bg-slate-100 text-slate-500 font-medium',
                          icon: <Clock size={10} className="mr-1 mt-[1px] text-slate-400" />,
                          modalIcon: <Clock size={14} className="text-slate-400" />,
                          ticketText: 'Đã hết hạn',
                          ticketStyle: 'bg-slate-100 text-slate-500 border-slate-200'
                        };
                      }

                      // Trường hợp 2: Thanh toán thất bại hoặc Đã Hủy
                      if (t.paymentStatus === 'failed' || t.paymentStatus === 'cancelled') {
                        return {
                          text: 'Đã hủy',
                          style: 'border-red-200 bg-red-50 text-red-700',
                          icon: <XCircle size={10} className="mr-1 mt-[1px]" />,
                          modalIcon: <XCircle size={14} />,
                          ticketText: 'Đã hủy',
                          ticketStyle: 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                        };
                      }

                      // Trường hợp 3: Chờ thanh toán
                      if (t.paymentStatus === 'pending') {
                        return {
                          text: 'Chờ thanh toán',
                          style: 'border-yellow-200 bg-yellow-50 text-yellow-700',
                          icon: <Timer size={10} className="mr-1 mt-[1px]" />,
                          modalIcon: <Timer size={14} />,
                          ticketText: 'Chờ thanh toán',
                          ticketStyle: 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        };
                      }

                      // Trường hợp 4: Đã thanh toán (Cần check thêm expired và is_used)
                      if (t.paymentStatus === 'paid') {
                        // Ưu tiên check Đã sử dụng
                        if (t.is_used) {
                          return {
                            text: 'Đã sử dụng',
                            style: 'border-blue-200 bg-blue-50 text-blue-700',
                            icon: <CheckCircle2 size={10} className="mr-1 mt-[1px]" />,
                            modalIcon: <CheckCircle2 size={14} />,
                            ticketText: 'Đã sử dụng',
                            ticketStyle: 'bg-blue-100 text-blue-700 border-blue-200'
                          };
                        }

                        // Check Hết hạn (Đã thanh toán nhưng quá hạn sử dụng vé)
                        if (t.expired) {
                          return {
                            text: 'Đã quá hạn',
                            style: 'border-amber-300 bg-amber-50 text-amber-800 font-bold',
                            icon: <Clock size={10} className="mr-1 mt-[1px] text-amber-600" />,
                            modalIcon: <Clock size={14} className="text-amber-600" />,
                            ticketText: 'Đã quá hạn',
                            ticketStyle: 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                          };
                        }

                        // Còn lại là Đang đợi dùng
                        return {
                          text: 'Đang đợi dùng',
                          style: 'border-green-200 bg-green-50 text-green-700',
                          icon: <Timer size={10} className="mr-1 mt-[1px] animate-pulse" />,
                          modalIcon: <Timer size={14} />,
                          ticketText: 'Đang đợi dùng',
                          ticketStyle: 'bg-green-100 text-green-700 border-green-200 font-bold'
                        };
                      }

                      return {
                        text: 'Không rõ',
                        style: 'bg-gray-100 text-gray-400',
                        icon: null,
                        modalIcon: null,
                        ticketText: 'Không rõ',
                        ticketStyle: 'bg-gray-100 text-gray-400'
                      };
                    };

                    const config = getStatusConfig();

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
                                  🏷️ {t.voucher_code}
                                </span>
                                {t.sale_name && (
                                  <span className="text-[11px] text-blue-600 font-semibold truncate max-w-[55px]" title={t.sale_name}>
                                    👤 {t.sale_name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-1.5">
                          {t.booking_type === 'combo_vr' ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 py-0.5 px-1.5 font-bold flex items-center justify-center gap-1 mx-auto w-fit text-nowrap text-[11px]">
                              <Film size={9} /> Phim, VR
                            </Badge>
                          ) : t.booking_type === 'vr' ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 py-0.5 px-1.5 font-bold flex items-center justify-center gap-1 mx-auto w-fit text-[11px]">
                              <Gamepad2 size={9} /> VR
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-0.5 px-1.5 font-bold flex items-center justify-center gap-1 mx-auto w-fit text-[11px]">
                              <Film size={9} /> Phim
                            </Badge>
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
                            const config = getStatusConfig();
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
                                <Badge
                                  variant="outline"
                                  className={`${config.style} px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap w-fit uppercase flex items-center`}
                                >
                                  {config.icon}
                                  {config.text}
                                </Badge>
                              </div>
                            );
                          })()}
                        </TableCell>

                        <TableCell className="text-center px-1">
                          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 leading-tight block">{paymentMethodLabel(t.paymentMethod)}</span>
                        </TableCell>

                        <TableCell className="text-right pr-3 pl-1">
                          <div className="flex justify-end items-center gap-1.5">
                            {(t.paymentStatus === 'paid' || t.paymentStatus === 'pending') && !t.is_used && !t.expired && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/ticket-check?code=' + t.booking_code);
                                }}
                                className="h-7 w-7 p-0 text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0"
                                title="Soát vé nhanh"
                              >
                                <TicketIcon size={13} />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(t)}
                              className="h-7 px-2.5 hover:bg-blue-600 hover:text-white transition-all shadow-sm text-xs font-medium whitespace-nowrap"
                            >
                              Xem chi tiết
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground italic">Hiển thị {data.length} giao dịch trên trang này.</p>
        <Pagination>
          <PaginationContent className="flex-wrap">

            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage(Math.max(1, currentPage - 1));
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {getPageWindow(currentPage, totalPages).map((pageItem, index) =>
              pageItem === 'gap' ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={pageItem}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === pageItem}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(pageItem);
                    }}
                  >
                    {pageItem}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage(Math.min(totalPages, currentPage + 1));
                }}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* --- MODAL CHI TIẾT GIAO DỊCH (TỐI ƯU TOÀN DIỆN) --- */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {/* ✅ THAY ĐỔI: max-w-6xl -> max-w-4xl để layout gọn hơn */}
        <DialogContent className="max-w-4xl p-0 border border-gray-200 shadow-xl rounded-xl overflow-hidden bg-white flex flex-col max-h-[95vh] [&>button]:hidden">
          {/* HEADER CỐ ĐỊNH */}
          <div className="bg-white p-6 border-b shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">Chi tiết giao dịch</DialogTitle>
                <div className="flex items-center gap-4 text-gray-600 text-[13px] mt-1.5">
                  <span className="flex items-center gap-2">
                    Mã đặt chỗ:
                    <span className="font-bold text-gray-900">
                      <CopyableText text={headerBookingCode} label="mã đặt chỗ" />
                    </span>
                  </span>
                  <span>
                    Tổng tiền: <span className="font-bold text-emerald-700">{formatVnd(headerTotalPrice)}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {(() => {
                  const paymentStatus = txDetails?.payment_info?.payment_status;
                  const isUsed = txDetails?.booking_details?.is_used;
                  const isExpired = txDetails?.payment_info?.expired;

                  if (paymentStatus === 'paid') {
                    if (isUsed) {
                      return (
                        <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-blue-600" />
                          <span className="text-[11px] font-medium tracking-tight">Đã sử dụng</span>
                        </div>
                      );
                    }
                    if (isExpired) {
                      return (
                        <div className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-300 flex items-center gap-2 font-bold shadow-xs">
                          <Clock size={14} className="text-amber-600" />
                          <span className="text-[11px] tracking-tight">Đã quá hạn</span>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-green-50 text-green-600 px-3 py-1.5 rounded-full border border-green-100 flex items-center gap-2">
                        <Timer size={14} className="text-green-600 animate-pulse" />
                        <span className="text-[11px] font-medium tracking-tight">Đang đợi dùng</span>
                      </div>
                    );
                  }

                  if (paymentStatus === 'pending') {
                    return (
                      <div className="flex items-center gap-2">
                        {txDetails?.payment_expires_at && (
                          <CountdownTimer targetDate={txDetails.payment_expires_at} />
                        )}
                        <div className="bg-yellow-50 text-yellow-600 px-3 py-1.5 rounded-full border border-yellow-100 flex items-center gap-2">
                          <Timer size={14} className="text-yellow-600 animate-pulse" />
                          <span className="text-[11px] font-medium tracking-tight">Chờ thanh toán</span>
                        </div>
                      </div>
                    );
                  }

                  if (paymentStatus === 'expired') {
                    return (
                      <div className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-2 font-medium">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-[11px] tracking-tight">Đã hết hạn</span>
                      </div>
                    );
                  }

                  if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
                    return (
                      <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-100 flex items-center gap-2">
                        <XCircle size={14} className="text-red-600" />
                        <span className="text-[11px] font-medium tracking-tight">Đã hủy</span>
                      </div>
                    );
                  }

                  return null;
                })()}


                <button
                  onClick={() => setIsDetailsOpen(false)}
                  aria-label="Đóng"
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* NỘI DUNG CUỘN */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            {isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-500 text-sm italic">Đang tải dữ liệu...</span>
              </div>
            ) : detailsError ? (
              <div className="text-center py-12 bg-red-50/50 rounded-lg border border-red-100 m-4">
                <p className="text-red-600 italic text-sm">{detailsError}</p>
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
                        <Badge
                          variant={txDetails.user?.is_active ? 'default' : 'destructive'}
                          className="text-[11px] h-5"
                        >
                          {txDetails.user?.is_active ? 'Hoạt động' : 'Vô hiệu'}
                        </Badge>
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
                        {/* LOGIC MỚI: Tương tự như badge ở list và header detail */}
                        {(() => {
                          const paymentStatus = txDetails.payment_info?.payment_status;
                          const isUsed = txDetails.booking_details?.is_used;
                          const isExpired = txDetails.payment_info?.expired;

                          if (paymentStatus === 'paid') {
                            if (isUsed) {
                              return (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-1.5 font-bold flex items-center gap-1.5 text-xs">
                                  <CheckCircle2 size={14} />
                                  ĐÃ SỬ DỤNG
                                </Badge>
                              );
                            }
                            if (isExpired) {
                              return (
                                <Badge className="bg-slate-600 text-white border-slate-700 py-1.5 font-bold uppercase text-[11px] flex items-center gap-1.5">
                                  <Clock size={14} />
                                  ĐÃ QUÁ HẠN
                                </Badge>
                              );
                            }
                            return (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 py-1.5 font-bold flex items-center gap-1.5 text-xs">
                                <Timer size={14} className="animate-pulse" />
                                ĐANG ĐỢI DÙNG
                              </Badge>
                            );
                          }

                          if (paymentStatus === 'pending') {
                            return (
                              <Badge className="bg-orange-100 text-orange-700 border-orange-200 py-1.5 flex items-center gap-1.5 text-xs">
                                <Timer size={14} className="animate-pulse" />
                                CHỜ THANH TOÁN
                              </Badge>
                            );
                          }

                          if (paymentStatus === 'failed') {
                            return (
                              <Badge className="bg-red-100 text-red-700 border-red-200 py-1.5 font-bold flex items-center gap-1.5 text-xs">
                                <XCircle size={14} />
                                ĐÃ HỦY
                              </Badge>
                            );
                          }

                          return (
                            <Badge
                              variant="secondary"
                              className="bg-slate-100 text-slate-500 border-slate-200 py-1.5 text-xs"
                            >
                              KHÔNG KHẢ DỤNG
                            </Badge>
                          );
                        })()}
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

          {/* FOOTER CỐ ĐỊNH */}
          <div className="p-5 bg-slate-50 border-t flex justify-end shrink-0 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
              className="h-11 px-12 border-slate-300 hover:bg-white font-bold text-sm uppercase"
            >
              Đóng cửa sổ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
