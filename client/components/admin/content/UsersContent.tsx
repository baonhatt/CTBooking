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
import { Search, RefreshCw, Eye, TrendingUp, User } from 'lucide-react';

interface Props {
  data: any[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  userQuery: string;
  setUserQuery: (q: string) => void;
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
  onEdit,
  usersLength,
  onRefresh,
  isLoading = false
}: Props) {
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

  const formatDateTime = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleViewDetails = (userId: number) => {
    setSelectedUserId(userId);
    setIsDetailsOpen(true);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900">Quản lý người dùng</h3>
          <p className="text-xs text-slate-500">Tổng cộng {usersLength} người dùng trong hệ thống</p>
        </div>
        <div className="flex flex-1 w-full md:max-w-md gap-2 ml-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Tìm theo tên, email hoặc SĐT..."
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 flex items-center justify-center bg-white border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-16 text-center text-[10px] uppercase font-bold text-slate-400">ID</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Người dùng</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Email & SĐT</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">Trạng Thái</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Ngày Tạo</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">
                  Thao tác
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
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
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.map((u) => (
                    <TableRow
                      key={u.id}
                      className="group hover:bg-slate-50/80 transition-colors border-b last:border-0"
                    >
                      <TableCell className="text-center font-mono text-[11px] text-slate-400">{u.id}</TableCell>
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
                          className={`text-[10px] px-2 py-0.5 rounded-lg border-none shadow-sm font-bold ${
                            u.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {u.is_active ? 'HOẠT ĐỘNG' : 'TẠM KHÓA'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-600 font-medium">{formatDateTime(u.created_at)}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
                          onClick={() => handleViewDetails(Number(u.id))}
                          title="Xem chi tiết"
                        >
                          <Eye size={16} />
                        </Button>
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
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={currentPage === i + 1}
                onClick={(e) => {
                  e.preventDefault();
                  setPage(i + 1);
                }}
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
                setPage(Math.min(totalPages, currentPage + 1));
              }}
              aria-disabled={currentPage === totalPages}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl rounded-2xl flex flex-col font-sans overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xl border border-blue-500/30">
                {userDetails?.fullname?.charAt(0).toUpperCase() || <User size={24} />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">Chi tiết người dùng</DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">ID: {selectedUserId}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50 max-h-[70vh]">
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
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                      <User size={14} className="text-blue-500" /> Thông tin cơ bản
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] text-slate-500 font-medium">Trạng thái</p>
                        <Badge
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border-none shadow-sm ${
                            userDetails.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {userDetails.is_active ? 'HOẠT ĐỘNG' : 'TẠM KHÓA'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Họ tên</p>
                        <p className="text-sm font-bold text-slate-900">{userDetails.fullname}</p>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium">Số điện thoại</p>
                        <p className="text-sm font-bold text-slate-900 font-mono">{userDetails.phone}</p>
                      </div>
                      <div className="flex flex-col border-t pt-2 border-slate-50">
                        <p className="text-[11px] text-slate-500 font-medium mb-1">Email</p>
                        <p className="text-sm font-bold text-blue-600 break-all">{userDetails.email}</p>
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
                          className="text-[9px] font-bold border-blue-200 text-blue-600 uppercase"
                        >
                          {userDetails.login_type}
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
                    </div>
                  </div>
                </div>

                {/* Booking Stats */}
                <div className="bg-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Thống kê đặt vé</h3>
                      <p className="text-sm opacity-60">Tổng số đơn đã thực hiện</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black">{userDetails.total_bookings}</p>
                      <p className="text-[10px] uppercase font-bold tracking-tighter opacity-70 mt-1">
                        Giao dịch hoàn tất
                      </p>
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-10 w-24 h-24 rotate-12">
                    <TrendingUp size={96} />
                  </div>
                </div>

                {userDetails.recent_bookings && userDetails.recent_bookings.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Eye size={14} className="text-blue-500" /> Đơn đặt vé gần đây (Tối đa 10 đơn)
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
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                <span>{booking.ticket_count} vé</span>
                                <span>•</span>
                                <span>{booking.payment_method || 'N/A'}</span>
                              </div>
                            </div>
                            <Badge
                              className={`text-[9px] font-bold px-2 py-0.5 rounded shadow-none border-none ${
                                ['paid'].includes(booking.payment_status)
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {['paid'].includes(booking.payment_status) ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                            <span className="text-[10px] text-slate-400 font-mono">
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
