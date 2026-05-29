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
import { getEmailLogsApi } from '@/lib/api';
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
        User as UserIcon
} from 'lucide-react';

export default function EmailLogsContent() {
        const [data, setData] = useState<any[]>([]);
        const [total, setTotal] = useState(0);
        const [page, setPage] = useState(1);
        const [limit] = useState(20);
        const [totalPages, setTotalPages] = useState(0);
        const [status, setStatus] = useState('all');
        const [emailType, setEmailType] = useState('all');
        const [search, setSearch] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [isDetailsOpen, setIsDetailsOpen] = useState(false);
        const [selectedLog, setSelectedLog] = useState<any>(null);

        const fetchData = async () => {
                try {
                        setIsLoading(true);
                        const res = await getEmailLogsApi({
                                page,
                                limit,
                                status,
                                email_type: emailType,
                                search
                        });
                        setData(res.data);
                        setTotal(res.pagination.total);
                        setTotalPages(res.pagination.totalPages);
                } catch (err) {
                        console.error('Failed to fetch email logs:', err);
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchData();
        }, [page, status, emailType]);

        const handleSearch = (e: React.FormEvent) => {
                e.preventDefault();
                setPage(1);
                fetchData();
        };

        const formatDateTime = (d: string | null) => {
                if (!d) return '-';
                return new Date(d).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                });
        };

        const getStatusBadge = (s: string) => {
                switch (s) {
                        case 'sent':
                                return (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[10px]">
                                                <CheckCircle2 size={12} /> ĐÃ GỬI
                                        </Badge>
                                );
                        case 'failed':
                                return (
                                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[10px]">
                                                <XCircle size={12} /> THẤT BẠI
                                        </Badge>
                                );
                        default:
                                return (
                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit font-bold text-[10px]">
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
                                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Lịch sử Email</h3>
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
                                                <option value="welcome">CHÀO MỪNG (WELCOME)</option>
                                                <option value="reset_password">QUÊN MẬT KHẨU</option>
                                                <option value="booking_confirmation">XÁC NHẬN ĐẶT VÉ</option>
                                        </select>
                                </div>
                        </div>

                        {/* Table */}
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
                                <CardContent className="p-0">
                                        <Table>
                                                <TableHeader className="bg-slate-50/80">
                                                        <TableRow className="hover:bg-transparent border-none">
                                                                <TableHead className="w-16 text-center text-[10px] uppercase font-bold text-slate-400">ID</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Người nhận & Tiêu đề</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Loại email</TableHead>
                                                                <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">Trạng thái</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Thời gian</TableHead>
                                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">
                                                                        Thao tác
                                                                </TableHead>
                                                        </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                        {isLoading && data.length === 0 ? (
                                                                Array.from({ length: 5 }).map((_, idx) => (
                                                                        <TableRow key={`sk-${idx}`}>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-10 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <div className="space-y-2">
                                                                                                <Skeleton className="h-4 w-40" />
                                                                                                <Skeleton className="h-3 w-60" />
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-5 w-32" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-6 w-24 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-32" />
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        <Skeleton className="h-8 w-8 ml-auto rounded-full" />
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                        ) : data.length === 0 ? (
                                                                <TableRow>
                                                                        <TableCell colSpan={6} className="h-40 text-center">
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
                                                                                <TableCell className="text-center font-mono text-[11px] text-slate-400">{log.id}</TableCell>
                                                                                <TableCell>
                                                                                        <div className="flex flex-col gap-1">
                                                                                                <span className="font-black text-slate-900 text-sm">{log.recipient}</span>
                                                                                                <span className="text-[11px] text-slate-500 line-clamp-1 italic">{log.subject}</span>
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <div className="flex items-center gap-2">
                                                                                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                                                                                                        {getTypeIcon(log.email_type)}
                                                                                                </div>
                                                                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                                                                                                        {log.email_type === 'welcome'
                                                                                                                ? 'Chào mừng'
                                                                                                                : log.email_type === 'reset_password'
                                                                                                                        ? 'Quên mật khẩu'
                                                                                                                        : log.email_type === 'booking_confirmation'
                                                                                                                                ? 'Xác nhận đặt vé'
                                                                                                                                : log.email_type}
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
                                                                                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
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
                                                                                        >
                                                                                                <Eye size={18} />
                                                                                        </Button>
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                        )}
                                                </TableBody>
                                        </Table>
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
                                <DialogContent className="max-w-2xl p-0 border-none shadow-2xl rounded-3xl flex flex-col overflow-hidden">
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
                                                                <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">Chi tiết Email Log</DialogTitle>
                                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                                        ID: #{selectedLog?.id}
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
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Người nhận</span>
                                                                                <span className="font-bold text-slate-900 break-all">{selectedLog.recipient}</span>
                                                                        </div>
                                                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại email</span>
                                                                                <span className="font-bold text-slate-900 uppercase tracking-tighter">
                                                                                        {selectedLog.email_type}
                                                                                </span>
                                                                        </div>
                                                                </div>

                                                                {/* Connection & IDs */}
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-1">
                                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Provider</span>
                                                                                <span className="font-bold text-blue-400 uppercase tracking-tight">
                                                                                        {selectedLog.provider || 'System'}
                                                                                </span>
                                                                        </div>
                                                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User ID</span>
                                                                                <span className="font-bold text-slate-900">
                                                                                        {selectedLog.user_id ? (
                                                                                                `#${selectedLog.user_id}`
                                                                                        ) : (
                                                                                                <span className="text-slate-400 italic font-medium">Khách vãng lai</span>
                                                                                        )}
                                                                                </span>
                                                                        </div>
                                                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking ID</span>
                                                                                <span className="font-bold text-slate-900">
                                                                                        {selectedLog.booking_id ? `#${selectedLog.booking_id}` : '-'}
                                                                                </span>
                                                                        </div>
                                                                </div>

                                                                {/* Subject */}
                                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề</span>
                                                                        <span className="font-bold text-slate-900 leading-relaxed italic">"{selectedLog.subject}"</span>
                                                                </div>

                                                                {/* Error Message if exists (regardless of status, though usually failed/pending) */}
                                                                {selectedLog.error_message && (
                                                                        <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 flex flex-col gap-3 shadow-sm">
                                                                                <div className="flex items-center gap-2 text-rose-600">
                                                                                        <AlertCircle size={18} />
                                                                                        <span className="text-xs font-black uppercase tracking-widest">Thông báo lỗi chi tiết</span>
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
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                                                                Dữ liệu đi kèm (Metadata)
                                                                                        </span>
                                                                                </div>
                                                                                <div className="p-5 bg-gray-50 rounded-xl text-blue-600 text-xs font-mono overflow-hidden shadow-inner">
                                                                                        <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 custom-scrollbar">
                                                                                                {JSON.stringify(
                                                                                                        typeof selectedLog.metadata === 'string'
                                                                                                                ? JSON.parse(selectedLog.metadata)
                                                                                                                : selectedLog.metadata,
                                                                                                        null,
                                                                                                        2
                                                                                                )}
                                                                                        </pre>
                                                                                </div>
                                                                        </div>
                                                                )}

                                                                {/* Timestamps */}
                                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                                                        <div className="flex flex-col gap-1">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Khởi tạo lúc</span>
                                                                                <span className="text-xs font-bold text-slate-600">{formatDateTime(selectedLog.created_at)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
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
                                </DialogContent>
                        </Dialog>
                </div>
        );
}
