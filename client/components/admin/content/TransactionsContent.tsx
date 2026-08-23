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
        PaginationItem,
        PaginationLink,
        PaginationNext,
        PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getTransactionById, getTickets } from '@/lib/api';
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
        Film
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Tx {
        id: string;
        userId?: number | null;
        transactionId: string;
        email: string;
        userName: string;
        ticket_package_name: string;
        ticketCount: number;
        totalPrice: number;
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
}
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
        setSortKey = () => { },
        setSortDir = () => { },
        paymentMethod = '',
        setPaymentMethod = () => { },
        fromDate = '',
        toDate = '',
        setFromDate = () => { },
        setToDate = () => { },
        bookingTypeFilter = 'all',
        setBookingTypeFilter = () => { },
        isLoading = false,
        branches = [],
        selectedBranchId = null,
        setSelectedBranchId = () => { }
}: Props) {
        const [isDetailsOpen, setIsDetailsOpen] = useState(false);
        const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
        const [selectedTxSummary, setSelectedTxSummary] = useState<Tx | null>(null);
        const [txDetails, setTxDetails] = useState<any>(null);
        const [isLoadingDetails, setIsLoadingDetails] = useState(false);
        const [detailsError, setDetailsError] = useState<string | null>(null);
        const [allTickets, setAllTickets] = useState<any[]>([]);
        useEffect(() => {
                if (isDetailsOpen && selectedTxId) {
                        (async () => {
                                try {
                                        setIsLoadingDetails(true);
                                        setDetailsError(null);
                                        if (!allTickets.length) {
                                                try {
                                                        const { items } = await getTickets({ page: 1, pageSize: 200 });
                                                        setAllTickets(items || []);
                                                } catch { }
                                        }
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
                return (
                        <Badge className="bg-green-100 text-green-700 border-green-200 py-1 font-bold">SẴN SÀNG SỬ DỤNG</Badge>
                );
        };

        const formatDate = (date, onlyDate = false) => {
                if (!date) return '---';
                const d = new Date(date);
                return onlyDate ? d.toLocaleDateString('vi-VN') : d.toLocaleString('vi-VN');
        };
        const CopyableText = ({ text, label }: { text: string; label?: string }) => {
                const [copied, setCopied] = useState(false);

                const handleCopy = () => {
                        if (!text) return;
                        navigator.clipboard.writeText(text);
                        setCopied(true);
                        toast.success(`Đã sao chép ${label || ''}`);
                        setTimeout(() => setCopied(false), 2000);
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
        const [localTxQuery, setLocalTxQuery] = useState(txQuery);

        useEffect(() => {
                setLocalTxQuery(txQuery);
        }, [txQuery]);

        const handleSearchTx = (e?: React.FormEvent) => {
                if (e) e.preventDefault();
                setTxQuery(localTxQuery);
                setPage(1);
        };

        return (
                <div className="space-y-6">
                        <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex flex-col gap-1">
                                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                        Lịch Sử Giao Dịch
                                                        <Badge
                                                                variant="secondary"
                                                                className="rounded-full bg-slate-100 text-slate-600 px-2 py-0 h-5 text-[10px] font-bold"
                                                        >
                                                                {transactionsLength}
                                                        </Badge>
                                                </h3>
                                                <p className="text-xs text-slate-500">Quản lý và đối soát thông tin đặt vé hệ thống.</p>
                                        </div>
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

                                <div className="h-px bg-slate-100 my-2" />

                                {/* Toolbar Grid */}
                                <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                                <form onSubmit={(e) => { e.preventDefault(); setTxQuery(localTxQuery); setPage(1); }} className="flex flex-1 min-w-[300px] max-w-lg gap-2">
                                                        <div className="relative flex-1">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                                <Input
                                                                        placeholder="Tìm email hoặc mã giao dịch..."
                                                                        value={localTxQuery}
                                                                        onChange={(e) => setLocalTxQuery(e.target.value)}
                                                                        className="pl-10 h-11 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
                                                                />
                                                        </div>
                                                        <Button
                                                                type="submit"
                                                                className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
                                                        >
                                                                <Search className="w-4 h-4" /> Tìm kiếm
                                                        </Button>
                                                </form>

                                                <div className="flex flex-wrap items-center gap-2">
                                                        {/* Pills filter loại booking */}
                                                        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                                                <button
                                                                        onClick={() => { setBookingTypeFilter?.('all'); setPage(1); }}
                                                                        className={`px-3 h-8 rounded-lg text-xs font-bold transition-all ${bookingTypeFilter === 'all'
                                                                                        ? 'bg-slate-800 text-white shadow-sm'
                                                                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                                                                                }`}
                                                                >
                                                                        Tất cả
                                                                </button>
                                                                <button
                                                                        onClick={() => { setBookingTypeFilter?.('movie'); setPage(1); }}
                                                                        className={`px-3 h-8 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${bookingTypeFilter === 'movie'
                                                                                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                                                                        : 'text-slate-500 hover:text-blue-600 hover:bg-white'
                                                                                }`}
                                                                >
                                                                        <Film size={12} /> Vé Phim
                                                                </button>
                                                                <button
                                                                        onClick={() => { setBookingTypeFilter?.('vr'); setPage(1); }}
                                                                        className={`px-3 h-8 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${bookingTypeFilter === 'vr'
                                                                                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                                                                                        : 'text-slate-500 hover:text-purple-600 hover:bg-white'
                                                                                }`}
                                                                >
                                                                        <Gamepad2 size={12} /> Trải nghiệm VR
                                                                </button>
                                                        </div>

                                                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                                                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                                                        Chỉ hiện đã thanh toán
                                                                </span>
                                                                <Switch
                                                                        checked={txStatus === 'paid'}
                                                                        onCheckedChange={(val) => setTxStatus?.(val ? 'paid' : 'all')}
                                                                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                                                                />
                                                        </div>

                                                        <select
                                                                value={paymentMethod}
                                                                onChange={(e) => setPaymentMethod?.(e.target.value)}
                                                                className="h-11 px-3 bg-white border rounded-xl text-sm w-44 cursor-pointer shadow-sm"
                                                        >
                                                                <option value="">Tất cả phương thức</option>
                                                                <option value="cash">Tiền mặt</option>
                                                                <option value="momo">MoMo</option>
                                                                <option value="vnpay">VNPay</option>
                                                                <option value="vietqr">VietQR</option>
                                                        </select>
                                                </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex flex-wrap items-center gap-3">
                                                        <div className="flex items-center gap-3 p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                                                <div className="flex items-center gap-2 px-3">
                                                                        <span className="text-xs font-medium text-slate-400">Từ</span>
                                                                        <Input
                                                                                type="date"
                                                                                value={fromDate}
                                                                                onChange={(e) => setFromDate?.(e.target.value)}
                                                                                className="w-36 h-8 bg-white border-0 shadow-sm text-xs rounded-lg"
                                                                        />
                                                                </div>
                                                                <div className="w-px h-4 bg-slate-200" />
                                                                <div className="flex items-center gap-2 px-3">
                                                                        <span className="text-xs font-medium text-slate-400">Đến</span>
                                                                        <Input
                                                                                type="date"
                                                                                value={toDate}
                                                                                onChange={(e) => setToDate?.(e.target.value)}
                                                                                className="w-36 h-8 bg-white border-0 shadow-sm text-xs rounded-lg"
                                                                        />
                                                                </div>
                                                        </div>

                                                        <select
                                                                value={sortKey}
                                                                onChange={(e) => setSortKey(e.target.value as any)}
                                                                className="h-11 px-3 bg-white border rounded-xl text-xs w-40 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        >
                                                                <option value="created_at">Thời gian tạo</option>
                                                                <option value="paid_at">Thời gian thanh toán</option>
                                                        </select>

                                                        {branches.length > 0 ? (
                                                                <select
                                                                        value={selectedBranchId || 'all'}
                                                                        onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                                                        className="h-11 px-3 bg-white border rounded-xl text-xs w-40 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                        <option value="all">Tất cả chi nhánh</option>
                                                                        {branches.map((branch) => (
                                                                                <option key={branch.id} value={branch.id}>
                                                                                        {branch.name}
                                                                                </option>
                                                                        ))}
                                                                </select>
                                                        ) : (
                                                                <div className="flex items-center gap-2 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500">
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                                                        <span>Đang tải chi nhánh...</span>
                                                                </div>
                                                        )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                        <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
                                                                className="rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm w-10 h-10 shrink-0"
                                                                title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                                                        >
                                                                {sortDir === 'desc' ? (
                                                                        <SortDesc className="w-4 h-4 text-slate-600" />
                                                                ) : (
                                                                        <SortAsc className="w-4 h-4 text-slate-600" />
                                                                )}
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
                        </div>

                        {/* Bảng dữ liệu đã tối ưu cột */}
                        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                <CardContent className="p-0">
                                        <Table>
                                                <TableHeader className="bg-gray-50">
                                                        <TableRow className="hover:bg-transparent border-none">
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 pr-0">
                                                                        ID
                                                                </TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Chi nhánh</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Người dùng</TableHead>
                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Loại</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Sản phẩm</TableHead>
                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Số lượng</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Doanh thu</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Thời gian</TableHead>
                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">
                                                                        Phương thức
                                                                </TableHead>
                                                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                                                                        Thao tác
                                                                </TableHead>
                                                        </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                        {isLoading
                                                                ? Array.from({ length: 5 }).map((_, idx) => (
                                                                        <TableRow key={`sk-${idx}`}>
                                                                                <TableCell colSpan={10}>
                                                                                        <Skeleton className="h-10 w-full" />
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                                : data.map((t) => {
                                                                        // 1. Tối ưu logic xác định trạng thái hiển thị
                                                                        const getStatusConfig = () => {
                                                                                // Trường hợp 1: Thanh toán thất bại/Đã hủy
                                                                                if (t.paymentStatus === 'failed') {
                                                                                        return {
                                                                                                text: 'Đã Hủy',
                                                                                                style: 'border-red-200 bg-red-50 text-red-700',
                                                                                                icon: <XCircle size={10} className="mr-1 mt-[1px]" />,
                                                                                                modalIcon: <XCircle size={14} />,
                                                                                                ticketText: 'Đã Hủy',
                                                                                                ticketStyle: 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                                                                                        };
                                                                                }

                                                                                // Trường hợp 2: Chờ thanh toán
                                                                                if (t.paymentStatus === 'pending') {
                                                                                        return {
                                                                                                text: 'Chờ Thanh Toán',
                                                                                                style: 'border-yellow-200 bg-yellow-50 text-yellow-700',
                                                                                                icon: <Timer size={10} className="mr-1 mt-[1px]" />,
                                                                                                modalIcon: <Timer size={14} />,
                                                                                                ticketText: 'Chờ Thanh Toán',
                                                                                                ticketStyle: 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                                                                        };
                                                                                }

                                                                                // Trường hợp 3: Đã thanh toán (Cần check thêm expired và is_used)
                                                                                if (t.paymentStatus === 'paid') {
                                                                                        // Ưu tiên check Đã sử dụng
                                                                                        if (t.is_used) {
                                                                                                return {
                                                                                                        text: 'Đã Sử Dụng',
                                                                                                        style: 'border-blue-200 bg-blue-50 text-blue-700',
                                                                                                        icon: <CheckCircle2 size={10} className="mr-1 mt-[1px]" />,
                                                                                                        modalIcon: <CheckCircle2 size={14} />,
                                                                                                        ticketText: 'Đã Sử Dụng',
                                                                                                        ticketStyle: 'bg-blue-100 text-blue-700 border-blue-200'
                                                                                                };
                                                                                        }

                                                                                        // Check Hết hạn
                                                                                        if (t.expired) {
                                                                                                return {
                                                                                                        text: 'Đã Quá Hạn',
                                                                                                        style: 'border-slate-300 bg-slate-100 text-slate-600',
                                                                                                        icon: <Clock size={10} className="mr-1 mt-[1px]" />,
                                                                                                        modalIcon: <Clock size={14} />,
                                                                                                        ticketText: 'Đã Quá Hạn',
                                                                                                        ticketStyle: 'bg-slate-600 text-white border-slate-700 font-bold'
                                                                                        };
                                                                                        }

                                                                                        // Còn lại là Đang đợi dùng
                                                                                        return {
                                                                                                text: 'Đang Đợi Dùng',
                                                                                                style: 'border-green-200 bg-green-50 text-green-700',
                                                                                                icon: <Timer size={10} className="mr-1 mt-[1px] animate-pulse" />,
                                                                                                modalIcon: <Timer size={14} />,
                                                                                                ticketText: 'Đang Đợi Dùng',
                                                                                                ticketStyle: 'bg-green-100 text-green-700 border-green-200 font-bold'
                                                                                        };
                                                                                }

                                                                                return {
                                                                                        text: 'N/A',
                                                                                        style: 'bg-gray-100 text-gray-400',
                                                                                        icon: null,
                                                                                        modalIcon: null,
                                                                                        ticketText: 'N/A',
                                                                                        ticketStyle: 'bg-gray-100 text-gray-400'
                                                                                };
                                                                        };

                                                                        const config = getStatusConfig();

                                                                        return (
                                                                                <TableRow key={t.id} className="hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]">
                                                                                        <TableCell className="font-mono text-xs text-gray-500">#{t.id}</TableCell>
                                                                                        <TableCell>
                                                                                                <div 
                                                                                                        className="text-[12px] font-medium text-slate-600 max-w-[120px] truncate" 
                                                                                                        title={branches.find((b) => b.id === t.branch_id)?.name || 'Tất cả chi nhánh'}
                                                                                                >
                                                                                                        {branches.find((b) => b.id === t.branch_id)?.name || (
                                                                                                                <span className="italic text-slate-400">Tất cả chi nhánh</span>
                                                                                                        )}
                                                                                                </div>
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                <div className="flex flex-col">
                                                                                        <span className="font-semibold text-sm text-gray-900">
                                                                                                {t.userName || 'Khách Vãng Lai'}
                                                                                        </span>
                                                                                        <span className="text-[11px] text-gray-500">{t.email}</span>
                                                                                </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                                {t.booking_type === 'vr' ? (
                                                                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 py-0.5 font-bold flex items-center gap-1 mx-auto w-fit">
                                                                                                <Gamepad2 size={10} /> VR
                                                                                        </Badge>
                                                                                ) : (
                                                                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-0.5 font-bold flex items-center gap-1 mx-auto w-fit">
                                                                                                <Film size={10} /> Phim
                                                                                        </Badge>
                                                                                )}
                                                                        </TableCell>
                                                                        <TableCell className="max-w-[150px] truncate font-medium text-sm">
                                                                                {t.ticket_package_name}
                                                                        </TableCell>
                                                                                        <TableCell className="text-center font-bold">{t.ticketCount}</TableCell>
                                                                                        <TableCell className="font-bold text-blue-700">
                                                                                                {t.totalPrice.toLocaleString('vi-VN')}đ
                                                                                        </TableCell>
                                                                                        <TableCell className="text-[11px] text-slate-500 font-medium">
                                                                                                {(() => {
                                                                                                        const config = getStatusConfig();
                                                                                                        const dateToUse =
                                                                                                                t.paymentStatus === 'paid' && t.paidAt
                                                                                                                        ? t.paidAt
                                                                                                                        : t.paymentStatus === 'failed'
                                                                                                                                ? t.updatedAt
                                                                                                                                : t.createdAt;
                                                                                                        const titleLabel =
                                                                                                                t.paymentStatus === 'paid' && t.paidAt
                                                                                                                        ? 'Thanh toán'
                                                                                                                        : t.paymentStatus === 'failed'
                                                                                                                                ? 'Hủy'
                                                                                                                                : 'Tạo';

                                                                                                        return (
                                                                                                                <div
                                                                                                                        className="flex flex-col gap-1 cursor-help"
                                                                                                                        title={`Thời gian ${titleLabel}: ${dateToUse ? new Date(dateToUse).toLocaleString('vi-VN') : '---'}`}
                                                                                                                >
                                                                                                                        <span className="text-slate-700 font-bold text-[10px]">
                                                                                                                                {dateToUse
                                                                                                                                        ? formatDistanceToNow(new Date(dateToUse), { addSuffix: true, locale: vi })
                                                                                                                                        : '---'}
                                                                                                                        </span>
                                                                                                                        <Badge
                                                                                                                                variant="outline"
                                                                                                                                className={`${config.style} px-2 py-0.5 text-[10px] font-bold whitespace-nowrap w-fit uppercase flex items-center`}
                                                                                                                        >
                                                                                                                                {config.icon}
                                                                                                                                {config.text}
                                                                                                                        </Badge>
                                                                                                                </div>
                                                                                                        );
                                                                                                })()}
                                                                                        </TableCell>

                                                                                        <TableCell className="text-center">
                                                                                                <span className="text-sm font-bold uppercase text-slate-700">{t.paymentMethod}</span>
                                                                                        </TableCell>

                                                                                        <TableCell className="text-right">
                                                                                                <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        onClick={() => handleViewDetails(t)}
                                                                                                        className="h-8 hover:bg-blue-600 hover:text-white transition-all shadow-sm text-xs"
                                                                                                >
                                                                                                        Xem chi tiết
                                                                                                </Button>
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
                                        <PaginationContent>
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
                                                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                                                        />
                                                </PaginationItem>
                                        </PaginationContent>
                                </Pagination>
                        </div>

                        {/* --- MODAL CHI TIẾT GIAO DỊCH (TỐI ƯU TOÀN DIỆN) --- */}
                        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                                {/* ✅ THAY ĐỔI: max-w-[700px] → max-w-6xl (rộng hơn) */}
                                {/* ✅ THAY ĐỔI: max-h-[92vh] → max-h-[95vh] (cao hơn) */}
                                <DialogContent className="max-w-6xl p-0 border border-gray-200 shadow-xl rounded-xl overflow-hidden bg-white flex flex-col max-h-[95vh] [&>button]:hidden">
                                        {/* HEADER CỐ ĐỊNH */}
                                        <div className="bg-white p-6 border-b shrink-0">
                                                <div className="flex justify-between items-start">
                                                        <div>
                                                                <DialogTitle className="text-xl font-bold text-gray-900">Chi tiết giao dịch</DialogTitle>
                                                                <div className="flex items-center gap-2 text-gray-500 text-[12px] mt-1.5 italic">
                                                                        ID Hệ thống:
                                                                        <CopyableText text={txDetails?.id?.toString() || ''} label="ID hệ thống" />
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
                                                                                                <div className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200 flex items-center gap-2">
                                                                                                        <Clock size={14} className="text-gray-600" />
                                                                                                        <span className="text-[11px] font-medium tracking-tight">Đã quá hạn</span>
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
                                                                                        <div className="bg-yellow-50 text-yellow-600 px-3 py-1.5 rounded-full border border-yellow-100 flex items-center gap-2">
                                                                                                <Timer size={14} className="text-yellow-600 animate-pulse" />
                                                                                                <span className="text-[11px] font-medium tracking-tight">Chờ thanh toán</span>
                                                                                        </div>
                                                                                );
                                                                        }

                                                                        if (paymentStatus === 'failed') {
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
                                                                                <SectionHeader color="text-blue-600" title="Khách Hàng" icon={<UserIcon size={16} />} />
                                                                                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4 shadow-sm">
                                                                                        <InfoRow label="Họ và Tên" value={txDetails.user?.fullname} bold />
                                                                                        <InfoRow label="Email" value={txDetails.user?.email} color="text-blue-600" />
                                                                                        <InfoRow
                                                                                                label="Email Tài Khoản"
                                                                                                value={txDetails.user?.email_auth ? txDetails.user?.email_auth : 'VÃNG LAI'}
                                                                                                color="text-red-600"
                                                                                        />
                                                                                        <div className="flex justify-between items-end border-t border-slate-200/60 pt-3 gap-2">
                                                                                                <InfoRow label="Số điện thoại" value={txDetails.user?.phone} />
                                                                                                <InfoRow label="Chi Nhánh" value={txDetails.branch?.name || 'Vãng lai'} bold color="text-slate-900" />
                                                                                                <Badge
                                                                                                        variant={txDetails.user?.is_active ? 'default' : 'destructive'}
                                                                                                        className="text-[9px] h-5"
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
                                                                                                                        Tổng lượt chơi: {Array.isArray(txDetails.vr_items)
                                                                                                                                ? txDetails.vr_items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)
                                                                                                                                : txDetails.booking_details?.ticket_count || 0}
                                                                                                                </span>
                                                                                                        </div>
                                                                                                        {/* Bảng chi tiết vr_items */}
                                                                                                        {txDetails.vr_items && txDetails.vr_items.length > 0 ? (
                                                                                                                <div className="border border-purple-100 rounded-lg overflow-hidden bg-white">
                                                                                                                        <Table className="[&_td]:py-2.5 [&_th]:py-2.5">
                                                                                                                                <TableHeader className="bg-purple-50/60">
                                                                                                                                        <TableRow className="hover:bg-transparent border-none">
                                                                                                                                                <TableHead className="text-[11px] font-bold uppercase text-purple-700">Tên gói VR</TableHead>
                                                                                                                                                <TableHead className="text-center text-[11px] font-bold uppercase text-purple-700 w-14">SL</TableHead>
                                                                                                                                                <TableHead className="text-right text-[11px] font-bold uppercase text-purple-700 w-28">Đơn giá</TableHead>
                                                                                                                                                <TableHead className="text-right text-[11px] font-bold uppercase text-purple-700 w-32">Thành tiền</TableHead>
                                                                                                                                        </TableRow>
                                                                                                                                </TableHeader>
                                                                                                                                <TableBody>
                                                                                                                                        {txDetails.vr_items.map((it: any, idx: number) => {
                                                                                                                                                const qty = Number(it.quantity || 1);
                                                                                                                                                const unit = Number(it.discounted_unit_price ?? it.unit_price ?? 0);
                                                                                                                                                const line = Number(it.line_total ?? unit * qty);
                                                                                                                                                return (
                                                                                                                                                        <TableRow key={it.id || `vr-${idx}`} className="border-t border-purple-50 hover:bg-transparent">
                                                                                                                                                                <TableCell className="py-2.5">
                                                                                                                                                                        <div className="flex items-center gap-2">
                                                                                                                                                                                <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                                                                                                                                                                                        <Gamepad2 className="w-3 h-3 text-purple-600" />
                                                                                                                                                                                </div>
                                                                                                                                                                                <span className="text-sm font-semibold text-slate-800 leading-tight">
                                                                                                                                                                                        {it.package_name || it.ticket_package?.name || `Gói VR #${it.ticket_package_id || idx + 1}`}
                                                                                                                                                                                </span>
                                                                                                                                                                        </div>
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-center font-bold text-slate-700 text-sm py-2.5">
                                                                                                                                                                        × {qty}
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-right text-[12px] text-slate-600 py-2.5">
                                                                                                                                                                        {unit.toLocaleString('vi-VN')}đ
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-right font-bold text-purple-700 text-sm py-2.5">
                                                                                                                                                                        {line.toLocaleString('vi-VN')}đ
                                                                                                                                                                </TableCell>
                                                                                                                                                        </TableRow>
                                                                                                                                                );
                                                                                                                                        })}
                                                                                                                                </TableBody>
                                                                                                                        </Table>
                                                                                                                </div>
                                                                                                        ) : (
                                                                                                                <div className="text-center py-4 text-slate-400 text-sm bg-purple-50/20 rounded-lg border border-purple-100 border-dashed">
                                                                                                                        (Không có chi tiết gói VR)
                                                                                                                </div>
                                                                                                        )}
                                                                                                        <div className="flex justify-between items-end border-t border-purple-200/30 pt-3">
                                                                                                                <InfoRow
                                                                                                                        label="Tổng lượt chơi"
                                                                                                                        value={Array.isArray(txDetails.vr_items) && txDetails.vr_items.length > 0
                                                                                                                                ? txDetails.vr_items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)
                                                                                                                                : txDetails.booking_details?.ticket_count || 0}
                                                                                                                        large
                                                                                                                        color="text-purple-700"
                                                                                                                />
                                                                                                                <div className="text-right">
                                                                                                                        <p className="text-[10px] text-purple-600 uppercase font-bold">Tổng tiền</p>
                                                                                                                        <p className="text-3xl font-black text-emerald-700">
                                                                                                                                {txDetails.booking_details?.total_price?.toLocaleString()}đ
                                                                                                                        </p>
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </>
                                                                                ) : (
                                                                                        <>
                                                                                                <SectionHeader color="text-amber-600" title={txDetails.booking_type === 'combo_vr' ? 'Gói Vé & VR Combo' : 'Gói & Phim'} icon={<TicketIcon size={16} />} />
                                                                                                <div className="bg-amber-50/40 rounded-xl p-5 border border-amber-100 space-y-4 shadow-sm">
                                                                                                        {/* Nếu có danh sách chi tiết vr_items */}
                                                                                                        {txDetails.vr_items && txDetails.vr_items.length > 0 ? (
                                                                                                                <div className="border border-amber-200/60 rounded-lg overflow-hidden bg-white">
                                                                                                                        <Table className="[&_td]:py-2.5 [&_th]:py-2.5">
                                                                                                                                <TableHeader className="bg-amber-50/70">
                                                                                                                                        <TableRow className="hover:bg-transparent border-none">
                                                                                                                                                <TableHead className="text-[11px] font-bold uppercase text-amber-800">Tên gói / Vé</TableHead>
                                                                                                                                                <TableHead className="text-center text-[11px] font-bold uppercase text-amber-800 w-14">SL</TableHead>
                                                                                                                                                <TableHead className="text-right text-[11px] font-bold uppercase text-amber-800 w-28">Đơn giá</TableHead>
                                                                                                                                                <TableHead className="text-right text-[11px] font-bold uppercase text-amber-800 w-32">Thành tiền</TableHead>
                                                                                                                                        </TableRow>
                                                                                                                                </TableHeader>
                                                                                                                                <TableBody>
                                                                                                                                        {txDetails.vr_items.map((it: any, idx: number) => {
                                                                                                                                                const qty = Number(it.quantity || 1);
                                                                                                                                                const unit = Number(it.discounted_unit_price ?? it.unit_price ?? 0);
                                                                                                                                                const line = Number(it.line_total ?? unit * qty);
                                                                                                                                                return (
                                                                                                                                                        <TableRow key={it.id || `item-${idx}`} className="border-t border-amber-100/60 hover:bg-transparent">
                                                                                                                                                                <TableCell className="py-2.5">
                                                                                                                                                                        <div className="flex items-center gap-2">
                                                                                                                                                                                <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                                                                                                                                                                                        <TicketIcon className="w-3 h-3 text-amber-700" />
                                                                                                                                                                                </div>
                                                                                                                                                                                <span className="text-sm font-semibold text-slate-800 leading-tight">
                                                                                                                                                                                        {it.package_name || txDetails.ticket_package?.name || `Gói vé #${idx + 1}`}
                                                                                                                                                                                </span>
                                                                                                                                                                        </div>
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-center font-bold text-slate-700 text-sm py-2.5">
                                                                                                                                                                        × {qty}
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-right text-[12px] text-slate-600 py-2.5">
                                                                                                                                                                        {unit.toLocaleString('vi-VN')}đ
                                                                                                                                                                </TableCell>
                                                                                                                                                                <TableCell className="text-right font-bold text-amber-900 text-sm py-2.5">
                                                                                                                                                                        {line.toLocaleString('vi-VN')}đ
                                                                                                                                                                </TableCell>
                                                                                                                                                        </TableRow>
                                                                                                                                                );
                                                                                                                                        })}
                                                                                                                                </TableBody>
                                                                                                                        </Table>
                                                                                                                </div>
                                                                                                        ) : (
                                                                                                                <div className="flex justify-between">
                                                                                                                        <InfoRow label="Loại Vé" value={txDetails.ticket_package?.name || txDetails.ticket_package_name} bold />
                                                                                                                        <span className="text-[14px] font-bold text-slate-600">
                                                                                                                                {txDetails.ticket_package?.ticket_unit_price?.toLocaleString()}đ
                                                                                                                        </span>
                                                                                                                </div>
                                                                                                        )}

                                                                                                        {/* Danh sách phim combo nếu có */}
                                                                                                        {txDetails.ticket_package?.movies && txDetails.ticket_package.movies.length > 0 && (
                                                                                                                <div className="space-y-1 border-t border-amber-200/30 pt-3">
                                                                                                                        <p className="text-xs text-gray-500 font-medium">Phim trong gói:</p>
                                                                                                                        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                                                                                                                {txDetails.ticket_package?.movies?.map((m: any) => (
                                                                                                                                        <Badge
                                                                                                                                                key={m.id}
                                                                                                                                                variant="outline"
                                                                                                                                                className="bg-white text-[10px] border-amber-200 text-amber-800"
                                                                                                                                        >
                                                                                                                                                {m.title}
                                                                                                                                        </Badge>
                                                                                                                                ))}
                                                                                                                        </div>
                                                                                                                </div>
                                                                                                        )}

                                                                                                        <div className="flex justify-between items-end border-t border-amber-200/30 pt-3">
                                                                                                                <InfoRow
                                                                                                                        label="Số lượng vé"
                                                                                                                        value={txDetails.booking_details?.ticket_count || (Array.isArray(txDetails.vr_items) ? txDetails.vr_items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) : 1)}
                                                                                                                        large
                                                                                                                        color="text-amber-700"
                                                                                                                />
                                                                                                                <div className="text-right">
                                                                                                                        <p className="text-[10px] text-amber-600 uppercase font-bold">Tổng tiền</p>
                                                                                                                        <p className="text-3xl font-black text-emerald-700">
                                                                                                                                {txDetails.booking_details?.total_price?.toLocaleString()}đ
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
                                                                                title="Đối Soát & Trạng Thái"
                                                                                icon={<CheckIcon size={16} />}
                                                                        />
                                                                        <div
                                                                                className={`bg-white rounded-xl border shadow-sm divide-y divide-slate-100 overflow-hidden ${txDetails.payment_info?.expired ? 'border-red-200' : 'border-slate-200'
                                                                                        }`}
                                                                        >
                                                                                {/* Hàng 1: Trạng thái và Check-in */}
                                                                                <div
                                                                                        className={`flex justify-between p-5 items-center ${txDetails.payment_info?.expired ? 'bg-red-50/30' : 'bg-slate-50/50'
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
                                                                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 py-1.5 text-xs">
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
                                                                                                <span className="text-[14px] font-bold text-slate-700 uppercase">
                                                                                                        {txDetails.payment_info?.payment_method}
                                                                                                </span>
                                                                                        </div>

                                                                                        <div className="md:border-x md:px-8">
                                                                                                <p className="text-[11px] text-blue-500 uppercase font-bold mb-2 italic">
                                                                                                        Mã đặt chỗ (Booking Code)
                                                                                                </p>
                                                                                                <div
                                                                                                        className={`flex items-center gap-2 ${txDetails.payment_info?.expired && !txDetails.booking_details?.is_used
                                                                                                                ? 'opacity-40 grayscale pointer-events-none' // Làm mờ và chặn tương tác khi hết hạn
                                                                                                                : ''
                                                                                                                }`}
                                                                                                >
                                                                                                        {txDetails.booking_details?.booking_code && (
                                                                                                                <CopyableText text={txDetails.booking_details.booking_code} label="mã đặt chỗ" />
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

                                                                                {/* Hàng 3: Timeline */}
                                                                                {(() => {
                                                                                        const paymentStatus = txDetails.payment_info?.payment_status;
                                                                                        const isUsed = txDetails.booking_details?.is_used;
                                                                                        const isExpired = txDetails.payment_info?.expired;

                                                                                        // 1. Pending: Chỉ hiện ngày tạo
                                                                                        if (paymentStatus === 'pending') {
                                                                                                return (
                                                                                                        <div className="grid grid-cols-1 p-6 gap-2 bg-slate-50/30 text-center">
                                                                                                                <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 2. Cancelled: Hiện ngày tạo và ngày hủy (updatedAt)
                                                                                        if (paymentStatus === 'failed') {
                                                                                                return (
                                                                                                        <div className="grid grid-cols-2 p-6 gap-2 bg-slate-50/30 text-center">
                                                                                                                <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                                <InfoRow
                                                                                                                        label="Ngày hủy"
                                                                                                                        value={formatDate(txDetails.updatedAt || txDetails.booking_details?.updated_at)}
                                                                                                                        color="text-red-600"
                                                                                                                />
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 3. Used: Hiện Ngày tạo, Thanh toán, Hạn dùng, Thời điểm sử dụng, Nhân viên xác nhận
                                                                                        if (isUsed) {
                                                                                                return (
                                                                                                        <div className="grid grid-cols-5 p-6 gap-3 bg-slate-50/30 text-center">
                                                                                                                <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                                <InfoRow label="Thanh toán" value={formatDate(txDetails.payment_info?.paid_at)} />
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
                                                                                                                        value={txDetails.booking_details?.confirmed_by_staff_name || txDetails.booking_details?.confirmed_by_staff?.fullname || '-'}
                                                                                                                        color="text-green-600"
                                                                                                                />
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 4. Default (Paid / Expired / Others): Hiện Ngày tạo, Thanh toán, Hạn dùng, Còn lại
                                                                                        return (
                                                                                                <div className="grid grid-cols-4 p-6 gap-3 bg-slate-50/30 text-center">
                                                                                                        <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                        <InfoRow label="Thanh toán" value={formatDate(txDetails.payment_info?.paid_at)} />
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