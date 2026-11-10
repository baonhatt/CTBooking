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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getUserById } from '@/lib/api';
import { Search, RefreshCw, Eye, TrendingUp, User, X, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatVnDateTime, formatVnDate, activeStatusLabel, paymentMethodLabel } from '@/lib/format';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';

interface Props {
  data: any[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  userQuery: string;
  setUserQuery: (q: string) => void;
  statusFilter?: string;
  setStatusFilter?: (value: string) => void;
  onEdit: (type: 'user', data: any) => void;
  usersLength: number;
  onRefresh: () => void;
  isLoading?: boolean;
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
  onEdit,
  usersLength,
  onRefresh,
  isLoading = false
}: Props) {
  const hasPermission = useHasStaffPermission();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

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

  const formatDateTime = (value: Date | string) => formatVnDateTime(value);

  // Booking payment status, as the owner reads it (anything unknown is shown as it is stored)
  const PAYMENT_STATUS_STYLES: Record<string, { label: string; className: string }> = {
    paid: { label: 'ĐÃ THANH TOÁN', className: 'bg-green-100 text-green-700' },
    pending: { label: 'CHỜ THANH TOÁN', className: 'bg-yellow-100 text-yellow-700' },
    failed: { label: 'THẤT BẠI', className: 'bg-red-100 text-red-700' },
    expired: { label: 'HẾT HẠN', className: 'bg-slate-200 text-slate-600' },
    cancelled: { label: 'ĐÃ HỦY', className: 'bg-slate-200 text-slate-600' },
    refunded: { label: 'ĐÃ HOÀN TIỀN', className: 'bg-blue-100 text-blue-700' }
  };

  const getPaymentStatusStyle = (status?: string) =>
    PAYMENT_STATUS_STYLES[status || ''] || {
      label: (status || 'KHÔNG RÕ').toUpperCase(),
      className: 'bg-slate-200 text-slate-600'
    };

  const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

  const getLoginTypeLabel = (loginType?: string) => (loginType || 'email').toUpperCase();

  const copyText = async (text: string, what: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${what}`);
    } catch {
      toast.error('Không sao chép được, hãy bôi đen và sao chép thủ công');
    }
  };

  const handleViewDetails = (userId: number) => {
    if (!hasPermission('users', 'view_detail')) return;
    setSelectedUserId(userId);
    setIsDetailsOpen(true);
  };
  const [localUserQuery, setLocalUserQuery] = useState(userQuery);

  useEffect(() => {
    setLocalUserQuery(userQuery);
  }, [userQuery]);

  const handleSearchUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUserQuery(localUserQuery);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý người dùng</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {usersLength} người dùng trong hệ thống</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        {/* L E F T - G R O U P */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearchUser} className="flex gap-2">
            <div className="relative w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-4 h-10 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm"
                value={localUserQuery}
                onChange={(e) => setLocalUserQuery(e.target.value)}
                placeholder="Tìm theo tên, email hoặc SĐT..."
              />
            </div>
            <Button
              type="submit"
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" /> Tìm kiếm
            </Button>
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter?.(e.target.value)}
            aria-label="Lọc theo trạng thái tài khoản"
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </div>

        {/* R I G H T - G R O U P */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto font-sans justify-start xl:justify-end">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setLocalUserQuery('');
              setUserQuery('');
              onRefresh();
            }}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 ml-2"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Người dùng</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Email & SĐT</TableHead>
                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">
                  Trạng thái
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Đăng nhập</TableHead>
                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Lượt đặt</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Đặt gần nhất</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Ngày tạo</TableHead>
                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.map((u) => (
                    <TableRow
                      key={u.id}
                      className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                            {u.fullname?.charAt(0).toUpperCase() || <User size={14} />}
                          </div>
                          <span className="font-bold text-slate-900">{u.fullname}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-slate-700">{u.email}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{u.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={u.is_active ? 'default' : 'secondary'}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            u.is_active
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {activeStatusLabel(u.is_active)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600 font-medium">{getLoginTypeLabel(u.login_type)}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold text-slate-700">
                        {u.total_bookings ?? 0}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600 font-medium">
                          {u.last_booking_at ? formatDateTime(u.last_booking_at) : 'Chưa đặt'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600 font-medium">{formatDateTime(u.created_at)}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          {hasPermission('users', 'view_detail') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg hover:bg-blue-50 text-blue-600"
                              onClick={() => handleViewDetails(Number(u.id))}
                              title="Xem chi tiết"
                              aria-label={`Xem chi tiết người dùng ${u.fullname}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.max(1, currentPage - 1));
              }}
              aria-disabled={currentPage === 1}
              className={
                currentPage === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'
              }
            />
          </PaginationItem>
          <PaginationItem>
            <span className="flex items-center px-3 text-sm text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPage(Math.min(totalPages, currentPage + 1));
              }}
              aria-disabled={currentPage === totalPages}
              className={
                currentPage === totalPages
                  ? 'pointer-events-none opacity-30'
                  : 'cursor-pointer rounded-lg border shadow-sm'
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-[700px] rounded-xl p-0 overflow-hidden border border-gray-200 shadow-xl bg-white font-sans [&>button]:hidden">
          <DialogTitle className="sr-only">Chi tiết người dùng</DialogTitle>
          <div className="bg-white px-6 py-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-4">
              {userDetails?.avatar ? (
                <img
                  src={userDetails.avatar}
                  alt={`Ảnh đại diện của ${userDetails.fullname || 'người dùng'}`}
                  className="w-12 h-12 rounded-full object-cover border border-blue-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xl border border-blue-100">
                  {userDetails?.fullname?.charAt(0).toUpperCase() || <User size={24} />}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-gray-900 tracking-tight leading-none">
                    {userDetails?.fullname || 'Người dùng'}
                  </h2>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDetailsOpen(false)}
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors mr-2"
              title="Đóng"
              aria-label="Đóng"
            >
              <X size={20} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[70vh]">
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : detailsError ? (
              <div className="text-center py-20 text-red-600 bg-red-50 rounded-xl border border-red-100 mx-4">
                <p className="font-bold">{detailsError}</p>
              </div>
            ) : userDetails ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                      <User size={14} className="text-blue-500" /> Thông tin cơ bản
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-slate-500 font-medium">Trạng thái</p>
                        <Badge
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            userDetails.is_active
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {activeStatusLabel(userDetails.is_active)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Họ tên</p>
                        <p className="text-sm font-bold text-slate-900">{userDetails.fullname}</p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Số điện thoại</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-slate-900 font-mono">{userDetails.phone || 'Chưa cập nhật'}</p>
                          {userDetails.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-slate-700"
                              onClick={() => copyText(userDetails.phone, 'số điện thoại')}
                              title="Sao chép số điện thoại"
                              aria-label="Sao chép số điện thoại"
                            >
                              <Copy size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Giới tính</p>
                        <p className="text-sm text-slate-900">
                          {userDetails.gender
                            ? GENDER_LABELS[String(userDetails.gender).toLowerCase()] || userDetails.gender
                            : 'Chưa cập nhật'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Ngày sinh</p>
                        <p className="text-sm text-slate-900">
                          {userDetails.dob ? formatVnDate(userDetails.dob) : 'Chưa cập nhật'}
                        </p>
                      </div>
                      <div className="flex flex-col border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium mb-1">Email</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-bold text-blue-600 break-all">{userDetails.email}</p>
                          {userDetails.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
                              onClick={() => copyText(userDetails.email, 'email')}
                              title="Sao chép email"
                              aria-label="Sao chép email"
                            >
                              <Copy size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                      <RefreshCw size={14} className="text-blue-500" /> Tài khoản
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-slate-500 font-medium">Loại đăng nhập</p>
                        <Badge
                          variant="outline"
                          className="text-xs font-medium border-gray-300 text-gray-600 uppercase px-3 py-1"
                        >
                          {getLoginTypeLabel(userDetails.login_type)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Ngày tạo tài khoản</p>
                        <p className="text-[11px] font-mono text-slate-700">
                          {userDetails.account_created_at ? formatDateTime(userDetails.account_created_at) : ''}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Ngày tạo hồ sơ</p>
                        <p className="text-[11px] font-mono text-slate-700">
                          {formatDateTime(userDetails.user_created_at)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Cập nhật lần cuối</p>
                        <p className="text-[11px] font-mono text-slate-700">
                          {formatDateTime(userDetails.user_updated_at)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Tạo bởi</p>
                        <p className="text-[11px] font-mono text-slate-700">
                          {userDetails.created_by_staff_name || '-'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Cập nhật bởi</p>
                        <p className="text-[11px] font-mono text-slate-700">
                          {userDetails.updated_by_staff_name || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking Stats */}
                <div className="bg-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                        <TrendingUp size={14} className="text-green-500" /> Thống kê đặt vé
                      </h3>
                      <p className="text-sm opacity-60">Tổng số đơn đã tạo (cả chưa thanh toán và đã hủy)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black">{userDetails.total_bookings}</p>
                      <p className="text-xs font-medium tracking-tight opacity-70 mt-1">
                        Đã thanh toán: {userDetails.paid_bookings ?? 0}
                      </p>
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-10 w-24 h-24 rotate-12">
                    <TrendingUp size={96} />
                  </div>
                </div>

                {userDetails.recent_bookings && userDetails.recent_bookings.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                      <Eye size={14} className="text-blue-500" /> Đơn đặt vé gần đây (tối đa 10 đơn, gồm cả chưa thanh toán và đã hủy)
                    </h3>
                    <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {userDetails.recent_bookings.map((booking: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 leading-tight">
                                {booking.movie_title || booking.ticket_package_name || 'Không xác định'}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase">
                                <span>{booking.ticket_count} vé</span>
                                <span>•</span>
                                <span>{paymentMethodLabel(booking.payment_method)}</span>
                              </div>
                            </div>
                            <Badge
                              className={`text-xs font-medium px-2 py-0.5 rounded shadow-none border-none ${
                                getPaymentStatusStyle(booking.payment_status).className
                              }`}
                            >
                              {getPaymentStatusStyle(booking.payment_status).label}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDateTime(booking.created_at)}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {booking.total_price?.toLocaleString('vi-VN') || '0'} đ
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400">Không tìm thấy thông tin chi tiết</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
