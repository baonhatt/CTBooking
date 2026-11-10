import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getEmailLogsApi, resendBookingEmailApi } from '@/lib/api';
import { formatVnDateTime } from '@/lib/format';
import { toast } from 'sonner';
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
import {
  Search,
  RefreshCw,
  Eye,
  Mail,
  Key,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
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

// The clipboard can be blocked (no permission, not https), so a failure is reported instead of ignored
const copy_text = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${what}`);
  } catch {
    toast.error('Không sao chép được, hãy chọn và sao chép thủ công');
  }
};

export default function EmailLogsContent() {
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
  const canResend = (log: any) =>
    log?.email_type === 'booking_confirmation' && log?.status === 'failed' && Boolean(log?.booking_id);

  const handleResend = async () => {
    if (!selectedLog?.booking_id) return;
    try {
      setIsResending(true);
      const res = await resendBookingEmailApi(Number(selectedLog.booking_id));
      toast.success(res?.message || 'Đã đưa email xác nhận vào hàng đợi gửi.');
      setIsResendConfirmOpen(false);
      setIsDetailsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Không gửi lại được email');
    } finally {
      setIsResending(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'sent':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[11px]">
            <CheckCircle2 size={12} /> ĐÃ GỬI
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[11px]">
            <XCircle size={12} /> THẤT BẠI
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[11px]">
            <Clock size={12} /> ĐANG CHỜ
          </Badge>
        );
    }
  };

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

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-6 bg-white p-6 rounded-3xl border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Mail size={24} />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Lịch sử email</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Ghi lại tất cả thông báo gửi tới khách hàng
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              className="rounded-xl hover:rotate-180 transition-all duration-500 h-10 w-10 border-slate-200"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="md:col-span-2">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border font-medium h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo email người nhận..."
              />
            </form>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 bg-slate-50 border-transparent focus:ring-2 focus:ring-blue-500 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none border"
          >
            <option value="all">TẤT CẢ TRẠNG THÁI</option>
            <option value="sent">ĐÃ GỬI THÀNH CÔNG</option>
            <option value="failed">GỬI THẤT BẠI</option>
            <option value="pending">ĐANG CHỜ XỬ LÝ</option>
          </select>
          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value)}
            className="h-10 bg-slate-50 border-transparent focus:ring-2 focus:ring-blue-500 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none border"
          >
            <option value="all">TẤT CẢ LOẠI EMAIL</option>
            <option value="welcome">Chào mừng</option>
            <option value="reset_password">QUÊN MẬT KHẨU</option>
            <option value="booking_confirmation">XÁC NHẬN ĐẶT VÉ</option>
            <option value="otp">MÃ OTP KHÁCH HÀNG</option>
            <option value="staff_otp">MÃ OTP NHÂN VIÊN</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={fetchData} className="font-semibold underline">
            Tải lại
          </button>
        </div>
      )}

      {/* Table */}
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 py-4 px-6">
              <div className="flex items-center justify-center gap-3 py-4 text-slate-600 font-medium">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải nhật ký email...</span>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg bg-slate-100" />
                <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
              </div>
            </div>
          ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[11px] uppercase font-bold text-slate-500">Người nhận & tiêu đề</TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500">Loại email</TableHead>
                <TableHead className="text-center text-[11px] uppercase font-bold text-slate-500">Trạng thái</TableHead>
                <TableHead className="text-[11px] uppercase font-bold text-slate-500">Thời gian</TableHead>
                <TableHead className="text-right text-[11px] uppercase font-bold text-slate-500 pr-6">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Mail size={40} className="opacity-20" />
                      <p className="font-bold text-sm">Không tìm thấy bản ghi email nào</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((log) => (
                  <TableRow
                    key={log.id}
                    className="group hover:bg-slate-50/80 transition-colors border-b last:border-0 h-20"
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-slate-900 text-sm flex items-center gap-2">
                          {log.recipient}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                              log.recipient_type === 'staff' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {recipient_type_label(log.recipient_type)}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 italic">{log.subject}</span>
                        {log.booking_code && (
                          <span className="text-[11px] font-mono text-blue-600">Mã đặt chỗ: {log.booking_code}</span>
                        )}
                        {log.status === 'failed' && log.error_message && (
                          <span className="text-[11px] text-rose-600 line-clamp-1" title={log.error_message}>
                            Lỗi: {log.error_message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                          {getTypeIcon(log.email_type)}
                        </div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                          {email_type_label(log.email_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">{getStatusBadge(log.status)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
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
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-blue-600 hover:text-white text-blue-600 transition-all shadow-sm hover:shadow-lg hover:shadow-blue-200"
                        onClick={() => handleViewDetails(log)}
                        aria-label="Xem chi tiết email"
                      >
                        <Eye size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
                className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={page === i + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i + 1);
                  }}
                  className="cursor-pointer"
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
                className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl rounded-2xl flex flex-col overflow-hidden bg-white [&>button]:hidden">
          <DialogHeader className="p-6 bg-white border-b border-gray-200 text-gray-900 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  {selectedLog && getTypeIcon(selectedLog.email_type)}
                </div>
                {selectedLog && getStatusBadge(selectedLog.status)}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">Chi tiết nhật ký email</DialogTitle>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 break-all">
                  {selectedLog?.recipient}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white max-h-[70vh]">
            {selectedLog && (
              <div className="space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Người nhận</span>
                    <span className="font-bold text-slate-900 break-all flex items-start gap-2">
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
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loại email</span>
                    <span className="font-bold text-slate-900 uppercase tracking-tighter">
                      {email_type_label(selectedLog.email_type)}
                    </span>
                  </div>
                </div>

                {/* Connection & IDs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Nhà cung cấp</span>
                    <span className="font-bold text-blue-400 uppercase tracking-tight">
                      {selectedLog.provider || 'Hệ thống'}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tài khoản</span>
                    <span className="font-bold text-slate-900">
                      {selectedLog.recipient_type === 'staff' ? (
                        'Nhân viên'
                      ) : selectedLog.user_id ? (
                        'Khách có tài khoản'
                      ) : (
                        <span className="text-slate-400 italic font-medium">Khách vãng lai</span>
                      )}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã đặt chỗ</span>
                    <span className="font-bold text-slate-900">
                      {selectedLog.booking_code || '-'}
                    </span>
                  </div>
                </div>

                {/* Subject */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề</span>
                  <span className="font-bold text-slate-900 leading-relaxed italic">"{selectedLog.subject}"</span>
                </div>

                {/* Error Message if exists (regardless of status, though usually failed/pending) */}
                {selectedLog.error_message && (
                  <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center gap-2 text-rose-600">
                      <AlertCircle size={18} />
                      <span className="text-xs font-black uppercase tracking-widest">Thông báo lỗi chi tiết</span>
                      <button
                        type="button"
                        onClick={() => copy_text(selectedLog.error_message, 'thông báo lỗi')}
                        className="ml-auto text-rose-400 hover:text-rose-700"
                        aria-label="Sao chép thông báo lỗi"
                        title="Sao chép thông báo lỗi"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div className="p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-rose-200 text-sm font-medium text-rose-900 overflow-x-auto">
                      <code className="whitespace-pre-wrap">{selectedLog.error_message}</code>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedLog.metadata && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-400">
                      <FileJson size={16} />
                      <span className="text-[11px] font-black uppercase tracking-widest">
                        Dữ liệu đi kèm (Metadata)
                      </span>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-xl text-blue-600 text-xs font-mono overflow-hidden shadow-inner">
                      <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 custom-scrollbar">
                        {formatMetadata(selectedLog.metadata)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Khởi tạo lúc</span>
                    <span className="text-xs font-bold text-slate-600">{formatDateTime(selectedLog.created_at)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">
                      Gửi thành công lúc
                    </span>
                    <span className="text-xs font-bold text-slate-600 text-right">
                      {formatDateTime(selectedLog.sent_at)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="bg-slate-50 border-t border-gray-200 p-4">
            {canResend(selectedLog) && (
              <Button variant="outline" onClick={() => setIsResendConfirmOpen(true)} className="gap-2">
                <Send size={14} /> Gửi lại
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm before sending the confirmation email of an order again */}
      <AlertDialog open={isResendConfirmOpen} onOpenChange={setIsResendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gửi lại email xác nhận?</AlertDialogTitle>
            <AlertDialogDescription>
              Email xác nhận đặt vé{selectedLog?.booking_code ? ` (mã đặt chỗ ${selectedLog.booking_code})` : ''} sẽ được gửi
              lại tới địa chỉ email ghi trên đơn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResending}
              onClick={(event) => {
                // Keep the dialog open until the request finishes
                event.preventDefault();
                handleResend();
              }}
            >
              {isResending ? 'Đang gửi...' : 'Gửi lại'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
