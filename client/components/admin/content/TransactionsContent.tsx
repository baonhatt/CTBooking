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
        RefreshCw,
        SortAsc,
        SortDesc,
        FilterX
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
        isLoading?: boolean;
        branches?: any[];
        selectedBranchId?: number | null;
        setSelectedBranchId?: (id: number | null) => void;
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
                        <h3 className="font-bold uppercase text-xs tracking-widest">{title}</h3>
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
                        <p className="text-[10px] text-gray-400 uppercase font-bold leading-tight">{label}</p>
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
                                <Badge className="bg-orange-100 text-orange-700 border-orange-200 py-1">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse" /> CHỜ THANH TOÁN
                                </Badge>
                        );
                }
                if (isUsed) {
                        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-1 font-bold">ĐÃ SỬ DỤNG</Badge>;
                }
                return (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 py-1 font-bold">SẴN SÀNG SỬ DỤNG</Badge>
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
                                        >
                                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                        </Button>
                                </div>

                                <div className="h-px bg-slate-100 my-2" />

                                {/* Toolbar Grid */}
                                <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                                <div className="relative flex-1 min-w-[300px]">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <Input
                                                                placeholder="Tìm email hoặc mã giao dịch..."
                                                                value={txQuery}
                                                                onChange={(e) => setTxQuery(e.target.value)}
                                                                className="pl-10 h-11 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
                                                        />
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                                                <span className="text-[10px] font-black uppercase text-slate-500 whitespace-nowrap">
                                                                        Chỉ hiện đã thanh toán
                                                                </span>
                                                                <Switch
                                                                        checked={txStatus === 'paid'}
                                                                        onCheckedChange={(val) => setTxStatus?.(val ? 'paid' : 'all')}
                                                                        className="scale-75 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 cursor-pointer"
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
                                                                        <span className="text-[10px] font-black uppercase text-slate-400">Từ</span>
                                                                        <Input
                                                                                type="date"
                                                                                value={fromDate}
                                                                                onChange={(e) => setFromDate?.(e.target.value)}
                                                                                className="w-36 h-8 bg-white border-0 shadow-sm text-xs rounded-lg"
                                                                        />
                                                                </div>
                                                                <div className="w-px h-4 bg-slate-200" />
                                                                <div className="flex items-center gap-2 px-3">
                                                                        <span className="text-[10px] font-black uppercase text-slate-400">Đến</span>
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

                                                        {branches.length > 0 && (
                                                                <select
                                                                        value={selectedBranchId || ''}
                                                                        onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                                                                        className="h-11 px-3 bg-white border rounded-xl text-xs w-40 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                        <option value="">Tất cả chi nhánh</option>
                                                                        {branches.map((branch) => (
                                                                                <option key={branch.id} value={branch.id}>
                                                                                        {branch.name}
                                                                                </option>
                                                                        ))}
                                                                </select>
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
                        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden bg-white">
                                <CardContent className="p-0">
                                        <Table>
                                                <TableHeader className="bg-slate-50/80">
                                                        <TableRow className="hover:bg-transparent border-none">
                                                                <TableHead className="w-16 text-center text-[10px] uppercase font-bold text-slate-400 pr-0">
                                                                        ID
                                                                </TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Người dùng</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Sản phẩm</TableHead>
                                                                <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">Số lượng</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Doanh thu</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-slate-500">Thời gian</TableHead>
                                                                <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500">
                                                                        Phương thức
                                                                </TableHead>
                                                                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 pr-6">
                                                                        Thao tác
                                                                </TableHead>
                                                        </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                        {isLoading
                                                                ? Array.from({ length: 5 }).map((_, idx) => (
                                                                        <TableRow key={`sk-${idx}`}>
                                                                                <TableCell colSpan={8}>
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
                                                                                                style: 'border-amber-200 bg-amber-50 text-amber-700',
                                                                                                icon: <Timer size={10} className="mr-1 mt-[1px]" />,
                                                                                                modalIcon: <Timer size={14} />,
                                                                                                ticketText: 'Chờ Thanh Toán',
                                                                                                ticketStyle: 'bg-orange-100 text-orange-700 border-orange-200'
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
                                                                                                style: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                                                                                                icon: <Timer size={10} className="mr-1 mt-[1px] animate-pulse" />,
                                                                                                modalIcon: <Timer size={14} />,
                                                                                                ticketText: 'Đang Đợi Dùng',
                                                                                                ticketStyle: 'bg-emerald-100 text-emerald-700 border-emerald-200 font-bold'
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
                                                                                <TableRow key={t.id} className="hover:bg-blue-50/30 transition-colors">
                                                                                        <TableCell className="font-mono text-xs text-gray-500">#{t.id}</TableCell>
                                                                                        <TableCell>
                                                                                                <div className="flex flex-col">
                                                                                                        <span className="font-semibold text-sm text-gray-900">
                                                                                                                {t.userName || 'Khách Vãng Lai'}
                                                                                                        </span>
                                                                                                        <span className="text-[11px] text-gray-500">{t.email}</span>
                                                                                                </div>
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
                                {/* Tăng max-w-2xl lên max-w-4xl để không gian rộng rãi, chuyên nghiệp hơn */}
                                <DialogContent className="max-w-4xl p-0 border-none shadow-2xl overflow-hidden bg-white flex flex-col max-h-[92vh] [&>button]:hidden">
                                        {/* HEADER CỐ ĐỊNH */}
                                        <div className="bg-slate-900 p-5 text-white shrink-0">
                                                <div className="flex justify-between items-start">
                                                        <div>
                                                                <DialogTitle className="text-xl font-bold text-white">Chi Tiết Giao Dịch</DialogTitle>
                                                                <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-1 italic">
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
                                                                                                <div className="bg-blue-500/15 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30 flex items-center gap-2">
                                                                                                        <CheckCircle2 size={14} className="text-blue-500" />
                                                                                                        <span className="text-[10px] font-bold uppercase tracking-tight">Đã sử dụng</span>
                                                                                                </div>
                                                                                        );
                                                                                }
                                                                                if (isExpired) {
                                                                                        return (
                                                                                                <div className="bg-slate-500/15 text-slate-400 px-3 py-1 rounded-full border border-slate-500/30 flex items-center gap-2">
                                                                                                        <Clock size={14} className="text-slate-500" />
                                                                                                        <span className="text-[10px] font-bold uppercase tracking-tight">Đã quá hạn</span>
                                                                                                </div>
                                                                                        );
                                                                                }
                                                                                return (
                                                                                        <div className="bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-2">
                                                                                                <Timer size={14} className="text-emerald-500 animate-pulse" />
                                                                                                <span className="text-[10px] font-bold uppercase tracking-tight">Đang đợi dùng</span>
                                                                                        </div>
                                                                                );
                                                                        }

                                                                        if (paymentStatus === 'pending') {
                                                                                return (
                                                                                        <div className="bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-2">
                                                                                                <Timer size={14} className="text-amber-500 animate-pulse" />
                                                                                                <span className="text-[10px] font-bold uppercase tracking-tight">Chờ thanh toán</span>
                                                                                        </div>
                                                                                );
                                                                        }

                                                                        if (paymentStatus === 'failed') {
                                                                                return (
                                                                                        <div className="bg-red-500/15 text-red-400 px-3 py-1 rounded-full border border-red-500/30 flex items-center gap-2">
                                                                                                <XCircle size={14} className="text-red-500" />
                                                                                                <span className="text-[10px] font-bold uppercase tracking-tight">Đã hủy</span>
                                                                                        </div>
                                                                                );
                                                                        }

                                                                        return null;
                                                                })()}
                                                                <button
                                                                        onClick={() => setIsDetailsOpen(false)}
                                                                        className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                                                >
                                                                        <X size={20} />
                                                                </button>
                                                        </div>
                                                </div>
                                        </div>

                                        {/* NỘI DUNG CUỘN */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
                                                        <div className="space-y-6">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        {/* Cột 1: Khách Hàng */}
                                                                        <div className="space-y-3">
                                                                                <SectionHeader color="text-blue-600" title="Khách Hàng" icon={<UserIcon size={14} />} />
                                                                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 shadow-sm">
                                                                                        <InfoRow label="Họ và Tên" value={txDetails.user?.fullname} bold />
                                                                                        <InfoRow label="Email" value={txDetails.user?.email} color="text-blue-600" />
                                                                                        <InfoRow
                                                                                                label="Email Tài Khoản"
                                                                                                value={txDetails.user?.email_auth ? txDetails.user?.email_auth : 'VÃNG LAI'}
                                                                                                color="text-red-600"
                                                                                        />
                                                                                        <div className="flex justify-between items-end border-t border-slate-200/60 pt-2">
                                                                                                <InfoRow label="Số điện thoại" value={txDetails.user?.phone} />
                                                                                                <Badge
                                                                                                        variant={txDetails.user?.is_active ? 'default' : 'destructive'}
                                                                                                        className="text-[9px] h-4"
                                                                                                >
                                                                                                        {txDetails.user?.is_active ? 'Hoạt động' : 'Vô hiệu'}
                                                                                                </Badge>
                                                                                        </div>
                                                                                </div>
                                                                        </div>

                                                                        {/* Cột 2: Gói & Phim */}
                                                                        <div className="space-y-3">
                                                                                <SectionHeader color="text-amber-600" title="Gói & Phim" icon={<TicketIcon size={14} />} />
                                                                                <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-100 space-y-3 shadow-sm">
                                                                                        <div className="flex justify-between">
                                                                                                <InfoRow label="Loại Vé" value={txDetails.ticket_package?.name} bold />
                                                                                                <span className="text-[13px] font-bold text-slate-600">
                                                                                                        {txDetails.ticket_package?.ticket_unit_price?.toLocaleString()}đ
                                                                                                </span>
                                                                                        </div>
                                                                                        <div className="flex flex-wrap gap-1 border-t border-amber-200/30 pt-2 min-h-[40px]">
                                                                                                {txDetails.ticket_package?.movies?.map((m: any) => (
                                                                                                        <Badge
                                                                                                                key={m.id}
                                                                                                                variant="outline"
                                                                                                                className="bg-white text-[9px] border-amber-200 text-amber-800"
                                                                                                        >
                                                                                                                {m.title}
                                                                                                        </Badge>
                                                                                                ))}
                                                                                        </div>
                                                                                        <div className="flex justify-between items-end border-t border-amber-200/30 pt-2">
                                                                                                <InfoRow
                                                                                                        label="Số lượng"
                                                                                                        value={txDetails.booking_details?.ticket_count}
                                                                                                        large
                                                                                                        color="text-amber-700"
                                                                                                />
                                                                                                <div className="text-right">
                                                                                                        <p className="text-[9px] text-amber-600 uppercase font-bold">Tổng tiền</p>
                                                                                                        <p className="text-2xl font-black text-emerald-700">
                                                                                                                {txDetails.booking_details?.total_price?.toLocaleString()}đ
                                                                                                        </p>
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                                {/* Phần 3: Trạng thái & Đối soát */}
                                                                <div className="space-y-3">
                                                                        <SectionHeader
                                                                                color="text-emerald-600"
                                                                                title="Đối Soát & Trạng Thái"
                                                                                icon={<CheckIcon size={14} />}
                                                                        />
                                                                        <div
                                                                                className={`bg-white rounded-xl border shadow-sm divide-y divide-slate-100 overflow-hidden ${txDetails.payment_info?.expired ? 'border-red-200' : 'border-slate-200'
                                                                                        }`}
                                                                        >
                                                                                {/* Hàng 1: Trạng thái và Check-in */}
                                                                                <div
                                                                                        className={`flex justify-between p-4 items-center ${txDetails.payment_info?.expired ? 'bg-red-50/30' : 'bg-slate-50/50'
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
                                                                                                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 py-1 font-bold flex items-center gap-1">
                                                                                                                                        <CheckCircle2 size={12} />
                                                                                                                                        ĐÃ SỬ DỤNG
                                                                                                                                </Badge>
                                                                                                                        );
                                                                                                                }
                                                                                                                if (isExpired) {
                                                                                                                        return (
                                                                                                                                <Badge className="bg-slate-600 text-white border-slate-700 py-1 font-bold uppercase text-[10px] flex items-center gap-1">
                                                                                                                                        <Clock size={12} />
                                                                                                                                        ĐÃ QUÁ HẠN
                                                                                                                                </Badge>
                                                                                                                        );
                                                                                                                }
                                                                                                                return (
                                                                                                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 py-1 font-bold flex items-center gap-1">
                                                                                                                                <Timer size={12} className="animate-pulse" />
                                                                                                                                ĐANG ĐỢI DÙNG
                                                                                                                        </Badge>
                                                                                                                );
                                                                                                        }

                                                                                                        if (paymentStatus === 'pending') {
                                                                                                                return (
                                                                                                                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 py-1 flex items-center gap-1">
                                                                                                                                <Timer size={12} className="animate-pulse" />
                                                                                                                                CHỜ THANH TOÁN
                                                                                                                        </Badge>
                                                                                                                );
                                                                                                        }

                                                                                                        if (paymentStatus === 'failed') {
                                                                                                                return (
                                                                                                                        <Badge className="bg-red-100 text-red-700 border-red-200 py-1 font-bold flex items-center gap-1">
                                                                                                                                <XCircle size={12} />
                                                                                                                                ĐÃ HỦY
                                                                                                                        </Badge>
                                                                                                                );
                                                                                                        }

                                                                                                        return (
                                                                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 py-1">
                                                                                                                        KHÔNG KHẢ DỤNG
                                                                                                                </Badge>
                                                                                                        );
                                                                                                })()}
                                                                                        </div>
                                                                                </div>

                                                                                {/* Hàng 2: Mã đặt chỗ & Đối soát */}
                                                                                <div className="grid grid-cols-1 md:grid-cols-3 p-4 gap-6">
                                                                                        <div>
                                                                                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Phương thức</p>
                                                                                                <span className="text-[13px] font-bold text-slate-700 uppercase">
                                                                                                        {txDetails.payment_info?.payment_method}
                                                                                                </span>
                                                                                        </div>

                                                                                        <div className="md:border-x md:px-6">
                                                                                                <p className="text-[10px] text-blue-500 uppercase font-bold mb-1 italic">
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
                                                                                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                                                                                                        Nội dung chuyển khoản (Đối soát)
                                                                                                </p>
                                                                                                <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 text-[11px] font-mono">
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
                                                                                                        <div className="grid grid-cols-1 p-4 gap-2 bg-slate-50/30 text-center">
                                                                                                                <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 2. Cancelled: Hiện ngày tạo và ngày hủy (updatedAt)
                                                                                        if (paymentStatus === 'failed') {
                                                                                                return (
                                                                                                        <div className="grid grid-cols-2 p-4 gap-2 bg-slate-50/30 text-center">
                                                                                                                <InfoRow label="Ngày tạo" value={formatDate(txDetails.booking_details?.created_at)} />
                                                                                                                <InfoRow
                                                                                                                        label="Ngày hủy"
                                                                                                                        value={formatDate(txDetails.updatedAt || txDetails.booking_details?.updated_at)}
                                                                                                                        color="text-red-600"
                                                                                                                />
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 3. Used: Hiện Ngày tạo, Thanh toán, Hạn dùng, Thời điểm sử dụng
                                                                                        if (isUsed) {
                                                                                                return (
                                                                                                        <div className="grid grid-cols-4 p-4 gap-2 bg-slate-50/30 text-center">
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
                                                                                                        </div>
                                                                                                );
                                                                                        }

                                                                                        // 4. Default (Paid / Expired / Others): Hiện Ngày tạo, Thanh toán, Hạn dùng, Còn lại
                                                                                        return (
                                                                                                <div className="grid grid-cols-4 p-4 gap-2 bg-slate-50/30 text-center">
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
                                        </div>

                                        {/* FOOTER CỐ ĐỊNH */}
                                        <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0 gap-3">
                                                <Button
                                                        variant="outline"
                                                        onClick={() => setIsDetailsOpen(false)}
                                                        className="h-10 px-10 border-slate-300 hover:bg-white font-bold text-xs uppercase"
                                                >
                                                        Đóng cửa sổ
                                                </Button>
                                        </div>
                                </DialogContent>
                        </Dialog>
                </div>
        );
}
