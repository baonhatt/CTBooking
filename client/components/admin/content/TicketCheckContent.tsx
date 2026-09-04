import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { confirmBookingApi, getBookingByCodeApi, useTicketApi } from '@/lib/api';
import { getAdminBranchOptions } from '@/lib/api/branches';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Phone,
  User,
  Film,
  Search,
  CheckCircle2,
  Mail,
  Ticket,
  Info,
  Loader2,
  Clock,
  RefreshCw,
  Gamepad2,
  Tag,
  Percent,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';

interface VRItem {
  id?: number;
  booking_id?: number;
  ticket_package_id?: number;
  package_name?: string;
  quantity?: number;
  unit_price?: number | string;
  line_total?: number | string;
  voucher_id?: number | null;
  discounted_unit_price?: number | string;
  ticket_package?: any;
  [k: string]: any;
}

interface TicketInfo {
  id: number;
  booking_code: string;
  payment_status: string;
  user_id: number;
  branch_id?: number | null;
  branch_name?: string | null;
  name: string;
  phone: string;
  email: string;
  ticket_count: number;
  total_price: number | string;
  original_total_price?: number | string | null;
  voucher_discount_amount?: number | string | null;
  voucher_code_snapshot?: string | null;
  created_at: string;
  paid_at: string | null;
  expiry_date: string | null;
  checked_in_at: string | null;
  payment_method: string | null;
  userName: string;
  is_used: boolean;
  valid: boolean;
  can_use: boolean;
  pay_txt_code?: string;
  validity_days: number | null;
  expired: boolean;
  movie_title?: string;
  movie_duration?: string;
  ticket_package_name?: string;
  booking_type?: 'movie' | 'vr' | string | null;
  vr_items?: VRItem[];
}

const formatMoney = (n: number | string | null | undefined) => {
  if (n === null || n === undefined || n === '') return '0₫';
  const num = Number(n);
  if (isNaN(num)) return '0₫';
  return num.toLocaleString('vi-VN') + '₫';
};

export default function TicketCheckContent() {
  const [code, setCode] = useState('');
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useLoading, setUseLoading] = useState(false);

  // Branch state
  const [branches, setBranches] = useState<any[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<number | null>(null);

  // Load branch options
  useEffect(() => {
    (async () => {
      try {
        const res = await getAdminBranchOptions();
        const items = res?.items || [];
        setBranches(items);
        if (items.length > 0) {
          setCurrentBranchId(items[0].id || items[0].branch_id);
        }
      } catch (e) {
        console.error('Failed to load branch options:', e);
      }
    })();
  }, []);

  // States cho Alert Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState<'checkin' | 'payment'>('checkin');
  const [allowConfirmCancelled, setAllowConfirmCancelled] = useState(false);

  const isSuperAdmin = useIsSuperAdmin();
  const permissions = useStaffPermissions();
  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const handleSearch = async () => {
    if (!hasPermission('ticket_check', 'scan')) {
      setError('Bạn không có quyền quét/tìm vé');
      return;
    }
    let searchCode = code.trim().toUpperCase();

    if (!searchCode) {
      setError('Vui lòng nhập mã vé hoặc đơn hàng');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getBookingByCodeApi(searchCode);
      setTicketInfo(data);
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy thông tin');
      setTicketInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async () => {
    if (!ticketInfo) return;
    setUseLoading(true); // Bật hiệu ứng loading trên button

    try {
      if (confirmType === 'checkin' || (confirmType as string) === 'force_checkin') {
        // 1. Xử lý xác nhận vào cổng (hỗ trợ cả vé bình thường và vé quá hạn)
        const isForce = (confirmType as string) === 'force_checkin';
        const res = await useTicketApi(ticketInfo.booking_code, isForce);
        if (res?.status === 'success') {
          const isVR = ticketInfo.booking_type === 'vr';
          toast.success('Thành công', {
            description: isForce
              ? 'Đã duyệt du di cho vé quá hạn vào cổng thành công!'
              : isVR
                ? 'Đã xác nhận khách vào phòng VR'
                : 'Đã xác nhận cho khách vào cổng'
          });

          // Cập nhật giao diện ngay lập tức
          setTicketInfo({
            ...ticketInfo,
            is_used: true,
            can_use: false,
            valid: false,
            expired: false,
            checked_in_at: new Date().toISOString()
          });

          // CHỈ ĐÓNG MODAL KHI THÀNH CÔNG
          setConfirmOpen(false);
        }
      } else {
        // 2. Xử lý xác nhận thanh toán
        const payload = {
          user_id: ticketInfo.user_id,
          payment_id: ticketInfo.id,
          payment_status: 'paid',
          transaction_id: null,
          paid_at: new Date().toISOString()
        };
        const res = await confirmBookingApi(payload);
        toast.success('Thành công', { description: res.message });

        // Load lại dữ liệu mới nhất từ server
        await handleSearch();

        // CHỈ ĐÓNG MODAL KHI THÀNH CÔNG
        setConfirmOpen(false);
      }
    } catch (err: any) {
      toast.error('Lỗi hệ thống', {
        description: err.message || 'Không thể thực hiện thao tác'
      });
      // Không đóng modal khi lỗi để nhân viên có thể xem thông báo lỗi
    } finally {
      setUseLoading(false); // Tắt hiệu ứng loading
    }
  };

  const formatDate = (str: string | null) =>
    str
      ? new Date(str).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      : '---';

  const parseJsonData = (data: string | undefined) => {
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  };

  const selectedBranchObj = branches.find((b) => Number(b.id || b.branch_id) === Number(currentBranchId));
  const currentBranchName = selectedBranchObj?.name || 'Chi nhánh';
  const isBranchMismatch = Boolean(
    ticketInfo &&
      ticketInfo.branch_id &&
      currentBranchId &&
      Number(ticketInfo.branch_id) !== Number(currentBranchId)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Hệ thống kiểm soát
          </h1>
          <p className="text-xs text-slate-500 italic">
            * Nhập mã đơn hàng hoặc mã vé để tra cứu thông tin phim và trạng thái.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {branches.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 shrink-0">Chi nhánh hiện tại:</span>
              <select
                value={currentBranchId || ''}
                onChange={(e) => setCurrentBranchId(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
              >
                {branches.map((b) => {
                  const bId = b.id || b.branch_id;
                  return (
                    <option key={bId} value={bId}>
                      {b.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setCode('');
              setTicketInfo(null);
              setError(null);
              toast.info('Đã làm mới dữ liệu');
            }}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 flex items-center justify-center bg-white border-slate-200"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-3xl space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              className="pl-12 h-14 text-lg shadow-xl shadow-slate-100/50 border-slate-200 focus:ring-4 focus:ring-blue-100 rounded-2xl transition-all"
              placeholder="Nhập mã vé hoặc ID (VD: 1766461)..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading || !hasPermission('ticket_check', 'scan')}
            size="lg"
            className="h-10 px-8 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 rounded-lg shadow-lg border-0 font-bold text-white"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'Kiểm tra'}
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-full h-fit text-amber-600">
            <Info size={16} />
          </div>
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-medium mb-1">Hướng dẫn đối soát nhanh:</p>
            <p>
              Nếu khách thanh toán qua Ngân hàng, tìm nội dung có mã{' '}
              <span className="font-mono font-bold bg-amber-200 px-1 rounded text-orange-700">CS...</span> (ví dụ: CS172543883901) hoặc Mã vé / ID đơn hàng.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="max-w-md animate-in fade-in zoom-in duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {ticketInfo && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Cảnh báo nếu vé khác Chi Nhánh */}
          {isBranchMismatch && (
            <Alert className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 rounded-2xl p-5 shadow-md flex items-start gap-4">
              <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-amber-900 flex items-center gap-2">
                  ⚠️ Cảnh báo: Vé mua khác chi nhánh!
                </h4>
                <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                  Vé này thuộc <span className="font-black underline bg-amber-200/70 px-1 rounded">{ticketInfo.branch_name || `Chi nhánh #${ticketInfo.branch_id}`}</span>, nhưng bạn đang tra cứu tại <span className="font-black underline bg-amber-200/70 px-1 rounded">{currentBranchName}</span>. Bạn vẫn có thể thực hiện xác nhận vé nếu đồng ý.
                </p>
              </div>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <Card
                className={`overflow-hidden border-none shadow-2xl shadow-slate-200/50 rounded-2xl transition-all ${ticketInfo.is_used ? 'opacity-60 grayscale-[0.5]' : ''}`}
              >
                <CardContent className="p-0">
                  <div
                    className={`p-6 border-b flex justify-between items-center ${
                      ticketInfo.booking_type === 'vr' ? 'bg-purple-50/60 border-purple-100' : 'bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div
                        className={`font-bold flex items-center gap-2 ${
                          ticketInfo.booking_type === 'vr' ? 'text-purple-700' : 'text-blue-600'
                        }`}
                      >
                        {ticketInfo.booking_type === 'vr' ? (
                          <Gamepad2 className="w-5 h-5" />
                        ) : (
                          <Ticket className="w-5 h-5" />
                        )}
                        <span className="text-lg">
                          {ticketInfo.booking_type === 'vr' ? 'TRẢI NGHIỆM VR' : 'Gói vé'}:{' '}
                          {ticketInfo.ticket_package_name || (ticketInfo.booking_type === 'vr' ? 'Combo gói VR' : '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 ml-7 flex-wrap">
                        {ticketInfo.branch_name && (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                            <MapPin className="w-3 h-3" />
                            {ticketInfo.branch_name}
                          </span>
                        )}
                        {ticketInfo.booking_type !== 'vr' ? (
                          <>
                            <span className="text-[11px] font-bold text-blue-500">
                              GIÁ 1 VÉ:{' '}
                              {Number(Number(ticketInfo.total_price) / ticketInfo.ticket_count).toLocaleString('vi-VN')} đ
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                              {ticketInfo.vr_items?.length || 0} loại gói
                            </span>
                            <span className="text-[11px] font-bold text-purple-500">
                              Tổng lượt chơi:{' '}
                              {(ticketInfo.vr_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)}
                            </span>
                          </>
                        )}
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200/50 px-2 rounded">
                        ID: #{ticketInfo.id}
                      </span>
                      {ticketInfo.voucher_code_snapshot ? (
                        <Badge className="bg-orange-500/10 text-orange-700 border border-orange-200 text-[10px] font-bold gap-1 px-2 py-0.5">
                          <Tag className="w-3 h-3" />
                          Mã {ticketInfo.voucher_code_snapshot}
                          {Number(ticketInfo.voucher_discount_amount || 0) > 0 ? (
                            <span className="ml-0.5 text-orange-800">
                              (-{formatMoney(ticketInfo.voucher_discount_amount)})
                            </span>
                          ) : null}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    className={`px-4 py-1.5 flex gap-2 items-center border-none font-black text-sm shadow-sm text-white ${
                      ticketInfo.booking_type === 'vr' ? 'bg-purple-600' : 'bg-red-500'
                    }`}
                  >
                    {ticketInfo.booking_type === 'vr' ? <Gamepad2 size={16} /> : <User size={16} />}
                    {ticketInfo.booking_type === 'vr'
                      ? `${(ticketInfo.vr_items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)} LƯỢT CHƠI`
                      : `${ticketInfo.ticket_count} VÉ`}
                  </Badge>
                </div>

                <div className="p-6 space-y-6">
                  {/* Section: Movies / VR Items List */}
                  {ticketInfo.booking_type === 'vr' ? (
                    <div>
                      <h3 className="text-xs font-semibold text-purple-600 mb-4 flex items-center gap-2">
                        <Gamepad2 size={14} /> Danh sách gói trải nghiệm VR:
                      </h3>
                      {ticketInfo.vr_items && ticketInfo.vr_items.length > 0 ? (
                        <div className="border border-purple-100 rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader className="bg-purple-50/60">
                              <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-[10px] font-bold uppercase text-purple-700 py-3">
                                  Tên gói VR
                                </TableHead>
                                <TableHead className="text-center text-[10px] font-bold uppercase text-purple-700 py-3">
                                  SL
                                </TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase text-purple-700 py-3">
                                  Đơn giá
                                </TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase text-purple-700 py-3">
                                  Thành tiền
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ticketInfo.vr_items.map((it, idx) => {
                                const qty = Number(it.quantity || 1);
                                const unit = Number(it.discounted_unit_price ?? it.unit_price ?? 0);
                                const line = Number(it.line_total ?? unit * qty);
                                return (
                                  <TableRow
                                    key={it.id || `vr-${idx}`}
                                    className="border-t border-purple-50 hover:bg-purple-50/30"
                                  >
                                    <TableCell className="py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                          <Gamepad2 className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-slate-800 leading-tight">
                                            {it.package_name ||
                                              it.ticket_package?.name ||
                                              `Gói VR #${it.ticket_package_id || idx + 1}`}
                                          </p>
                                          {Number(it.voucher_id) > 0 ? (
                                            <p className="text-[10px] text-orange-600 mt-0.5 flex items-center gap-1">
                                              <Percent className="w-3 h-3" />
                                              Đã áp voucher cho gói này
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-slate-700">× {qty}</TableCell>
                                    <TableCell className="text-right text-sm text-slate-600">
                                      {formatMoney(unit)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-purple-700">
                                      {formatMoney(line)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-sm bg-purple-50/20 rounded-xl border border-purple-100 border-dashed">
                          (Không có chi tiết gói VR)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 mb-4 flex items-center gap-2">
                        <Film size={14} /> Danh sách phim & thời lượng:
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {parseJsonData(ticketInfo.movie_title).map((title: string, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30"
                          >
                            <span className="font-bold text-slate-700 text-sm">{title}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100">
                              {parseJsonData(ticketInfo.movie_duration)[i]} ph
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamps row */}
                  <div
                    className={`grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t ${
                      ticketInfo.booking_type === 'vr' ? 'border-purple-100' : 'border-slate-100'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">Ngày đặt</p>
                      <p className="text-sm font-semibold text-slate-600">{formatDate(ticketInfo.created_at)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-600">Thanh toán</p>
                      <p className="text-sm font-semibold text-green-600">{formatDate(ticketInfo.paid_at)}</p>
                    </div>
                    {ticketInfo.booking_type !== 'vr' ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-red-500">
                          Hết hạn (
                          {(() => {
                            const days = differenceInDays(new Date(ticketInfo.expiry_date as any), new Date());
                            return days < 0 ? 'Đã hết hạn' : ` ${days} ngày nữa`;
                          })()}
                          )
                        </p>
                        <p className="text-sm font-semibold text-red-500">{formatDate(ticketInfo.expiry_date)}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-purple-500">Hạn sử dụng (VR)</p>
                        <p className="text-sm font-semibold text-purple-700">
                          {ticketInfo.expiry_date ? formatDate(ticketInfo.expiry_date) : 'Vô thời hạn'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Discount breakdown row if voucher applied */}
                  {(Number(ticketInfo.original_total_price) > 0 || Number(ticketInfo.voucher_discount_amount) > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-dashed border-orange-200">
                      {Number(ticketInfo.original_total_price) > 0 && (
                        <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold uppercase text-orange-500">Tổng gốc</p>
                          <p className="text-sm font-semibold text-orange-700 line-through opacity-80">
                            {formatMoney(ticketInfo.original_total_price)}
                          </p>
                        </div>
                      )}
                      {Number(ticketInfo.voucher_discount_amount) > 0 && (
                        <div className="bg-red-50/60 border border-red-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold uppercase text-red-500 flex items-center gap-1">
                            <Percent className="w-3 h-3" /> Giảm từ voucher
                          </p>
                          <p className="text-sm font-semibold text-red-700">
                            − {formatMoney(ticketInfo.voucher_discount_amount)}
                          </p>
                        </div>
                      )}
                      <div className="bg-green-50/60 border border-green-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase text-green-600">Thành tiền</p>
                        <p className="text-sm font-black text-green-700">{formatMoney(ticketInfo.total_price)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <Card className="md:col-span-4 p-4 flex items-center gap-3 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-400 shrink-0">
                  <User size={20} />
                </div>
                <div className="w-full">
                  <p className="text-xs font-medium text-slate-500">Khách hàng</p>
                  <p className="font-bold text-slate-700 break-words leading-tight">{ticketInfo.name}</p>
                </div>
              </Card>
              <Card className="md:col-span-3 p-4 flex items-center gap-3 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-400 shrink-0">
                  <Phone size={20} />
                </div>
                <div className="w-full">
                  <p className="text-xs font-medium text-slate-500">SĐT</p>
                  <p className="font-bold text-slate-700 break-all">{ticketInfo.phone}</p>
                </div>
              </Card>
              <Card className="md:col-span-5 p-4 flex items-center gap-3 border-none bg-white shadow-xl shadow-slate-100 rounded-2xl">
                <div className="p-2 bg-violet-50 rounded-xl text-violet-400 shrink-0">
                  <Mail size={20} />
                </div>
                <div className="w-full">
                  <p className="text-xs font-medium text-slate-500">Email đối soát</p>
                  <p className="font-bold text-slate-700 break-all leading-tight">{ticketInfo.email}</p>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card
              className={`border-2 transition-all shadow-xl ${
                ticketInfo.expired
                  ? 'border-slate-400 bg-slate-50' // Giao diện khi hết hạn
                  : ticketInfo.valid && !ticketInfo.is_used
                    ? 'border-green-500 bg-green-50/10'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <CardContent className="p-6 text-center space-y-6">
                <div className="space-y-2">
                  <h2
                    className={`text-3xl font-bold tracking-tighter ${
                      ticketInfo.expired
                        ? 'text-slate-500' // Màu chữ khi hết hạn
                        : ticketInfo.valid && !ticketInfo.is_used
                          ? 'text-green-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {/* Ưu tiên hiển thị Hết hạn lên đầu tiên */}
                    {ticketInfo.expired
                      ? 'Vé hết hạn'
                      : ticketInfo.valid && !ticketInfo.is_used
                        ? 'Vé hợp lệ'
                        : ticketInfo.is_used
                          ? 'Vé đã dùng'
                          : 'Chưa thanh toán'}
                  </h2>

                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-slate-500">Mã vé (Booking Code)</span>
                    <span
                      className={`text-5xl font-mono font-black ${
                        ticketInfo.is_used || ticketInfo.expired
                          ? 'text-slate-300 line-through decoration-slate-400/50'
                          : 'text-blue-600'
                      }`}
                    >
                      {ticketInfo.booking_code}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  {/* Trường hợp 0: Giao dịch đã hủy */}
                  {ticketInfo.payment_status === 'failed' && !allowConfirmCancelled ? (
                    <div className="py-5 px-6 rounded-2xl bg-red-50 text-red-600 font-bold border border-red-100 flex flex-col gap-2 shadow-inner">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle size={24} />
                        <span className="text-xl font-bold">Giao dịch đã hủy</span>
                      </div>
                      <p className="text-xs opacity-80">Giao dịch này đã bị hủy và không còn hiệu lực</p>
                      <div className="flex items-center gap-2 mt-2 justify-center">
                        <Checkbox
                          id="allow-cancel"
                          checked={allowConfirmCancelled}
                          onCheckedChange={(c) => setAllowConfirmCancelled(!!c)}
                          className="data-[state=checked]:bg-red-600 border-red-300"
                        />
                        <label htmlFor="allow-cancel" className="text-xs font-medium cursor-pointer select-none">
                          Cho phép xác nhận lại
                        </label>
                      </div>
                    </div>
                  ) : /* Trường hợp 1: Vé đã hết hạn (Cho phép duyệt du di nếu chưa sử dụng) */
                  ticketInfo.expired ? (
                    ticketInfo.is_used ? (
                      <div className="py-5 px-6 rounded-2xl bg-slate-200 text-slate-600 font-bold border border-slate-300 flex flex-col gap-2 shadow-inner">
                        <div className="flex items-center justify-center gap-2">
                          <AlertCircle size={24} />
                          <span className="text-xl font-bold">Không thể sử dụng</span>
                        </div>
                        <p className="text-xs opacity-80">Vé này đã quá hạn dùng và đã từng được sử dụng</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="py-4 px-5 rounded-2xl bg-amber-50 text-amber-800 font-bold border border-amber-200 flex flex-col gap-1 shadow-xs">
                          <div className="flex items-center justify-center gap-2 text-amber-700">
                            <AlertTriangle size={20} />
                            <span className="text-base font-bold">Vé đã hết hạn sử dụng</span>
                          </div>
                          <p className="text-xs text-amber-600 font-normal">Vé này đã quá hạn dùng nhưng chưa được sử dụng trước đây.</p>
                        </div>
                        <Button
                          onClick={() => {
                            setConfirmType('force_checkin' as any);
                            setConfirmOpen(true);
                          }}
                          disabled={useLoading || !hasPermission('ticket_check', 'validate')}
                          className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base shadow-lg shadow-amber-200 rounded-xl"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" /> Duyệt Vào Cổng Vé Hết Hạn
                        </Button>
                      </div>
                    )
                  ) : /* Trường hợp 2: Chưa thanh toán HOẶC Đã hủy nhưng cho phép xác nhận */
                  ticketInfo.payment_status !== 'paid' ? (
                    <Button
                      onClick={() => {
                        setConfirmType('payment');
                        setConfirmOpen(true);
                      }}
                      disabled={useLoading || !hasPermission('ticket_check', 'validate')}
                      className={`w-full h-16 text-lg font-bold shadow-lg ${
                        ticketInfo.payment_status === 'failed'
                          ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                          : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                      }`}
                    >
                      {ticketInfo.payment_status === 'failed'
                        ? 'Khôi phục & Xác nhận thanh toán'
                        : 'Xác nhận thanh toán'}
                    </Button>
                  ) : /* Trường hợp 3: Hợp lệ để vào cổng */
                  ticketInfo.can_use && !ticketInfo.is_used ? (
                    <Button
                      onClick={() => {
                        setConfirmType('checkin');
                        setConfirmOpen(true);
                      }}
                      disabled={useLoading || !hasPermission('ticket_check', 'validate')}
                      className="w-full h-16 bg-green-600 hover:bg-green-700 text-lg font-bold shadow-lg shadow-green-200"
                    >
                      Xác nhận cho vào cổng
                    </Button>
                  ) : (
                    /* Trường hợp 4: Đã sử dụng */
                    <div className="space-y-4">
                      <div className="py-5 px-6 rounded-2xl bg-slate-50 text-slate-400 font-bold border border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-2 text-red-500">
                          <AlertCircle size={24} />
                          <span className="text-xl font-bold">Đã sử dụng</span>
                        </div>
                        {ticketInfo.checked_in_at && (
                          <div className="mt-2 py-3 px-4 bg-red-50 rounded-xl border border-red-100 text-red-600">
                            <p className="text-xs tracking-wider font-medium opacity-70 flex items-center justify-center gap-1">
                              <Clock size={12} /> Thời gian vào:
                            </p>
                            <p className="text-lg font-mono font-bold tracking-tight">
                              {formatDate(ticketInfo.checked_in_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card thông tin thanh toán - Chuyển màu nếu VR hoặc hết hạn */}
            <Card
              className={`${ticketInfo.expired ? 'bg-gray-500' : ticketInfo.booking_type === 'vr' ? 'bg-purple-600' : 'bg-blue-600'} text-white overflow-hidden relative shadow-lg transition-colors`}
            >
              <CheckCircle2 className="absolute -top-4 -right-4 opacity-10 w-32 h-32" />
              <CardContent className="p-6 space-y-5 relative z-10">
                <div className="flex justify-between items-center text-xs opacity-60 font-medium tracking-widest">
                  <span>Phương thức</span>
                  <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    {ticketInfo.payment_method || 'VIETQR'}
                  </span>
                </div>
                <div className="pt-5 border-t border-slate-800 flex justify-between items-end">
                  <span className="text-xs font-medium opacity-60">Tổng thanh toán:</span>
                  <span
                    className={`text-4xl font-black leading-none tracking-tighter ${ticketInfo.expired ? 'text-slate-400' : 'text-green-400'}`}
                  >
                    {Number(ticketInfo.total_price).toLocaleString('vi-VN')}
                    <span className="text-base ml-1 font-bold">đ</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      )}

      {/* AlertDialog xác nhận hành động */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Ngăn không cho người dùng tự đóng modal bằng phím Esc hoặc click ra ngoài khi đang loading
          if (!useLoading) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-8">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-2xl font-bold text-slate-900">
              {confirmType === 'checkin'
                ? '⚠️ Xác nhận vào cổng?'
                : (confirmType as string) === 'force_checkin'
                  ? '⚠️ Duyệt du di vé quá hạn?'
                  : '💰 Xác nhận thanh toán?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base leading-relaxed space-y-3">
              <p>
                {confirmType === 'checkin'
                  ? `Bạn đang thực hiện cho ${ticketInfo?.ticket_count} khách vào cổng. Hành động này không thể hoàn tác.`
                  : (confirmType as string) === 'force_checkin'
                    ? `Vé mã ${ticketInfo?.booking_code} đã hết hạn. Bạn có chắc chắn muốn duyệt du di cho khách vào cổng không? Thao tác này sẽ được lưu lại trong nhật ký hệ thống (Audit Log).`
                    : `Bạn đã đối soát thành công số tiền ${Number(ticketInfo?.total_price).toLocaleString('vi-VN')}đ cho ID #${ticketInfo?.id}?`}
              </p>
              {isBranchMismatch && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 text-xs font-semibold flex items-start gap-2.5 text-left mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950">⚠️ Chú ý lệch chi nhánh:</span> Vé này mua tại{' '}
                    <span className="font-extrabold underline">{ticketInfo?.branch_name || `Chi nhánh #${ticketInfo?.branch_id}`}</span>, khác với chi nhánh làm việc hiện tại của bạn (<span className="font-extrabold underline">{currentBranchName}</span>).
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel disabled={useLoading} className="h-12 px-6 rounded-xl font-bold">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // e.preventDefault() để AlertDialog không tự đóng khi click
                e.preventDefault();
                executeAction();
              }}
              disabled={useLoading}
              className={`h-12 px-8 rounded-xl font-bold min-w-[160px] ${
                confirmType === 'checkin'
                  ? 'bg-green-600 hover:bg-green-700'
                  : (confirmType as string) === 'force_checkin'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {useLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận ngay'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
