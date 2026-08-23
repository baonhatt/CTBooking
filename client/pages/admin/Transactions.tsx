import React, { useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
import { getTransactions } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import TransactionsContent from '@/components/admin/content/TransactionsContent';

export default function TransactionsPage() {
=======
import { getTransactions, getAdminBranchOptions } from '@/lib/api';
import AdminLayout from '@/admin/layouts/AdminLayout';
import TransactionsContent from '@/components/admin/content/TransactionsContent';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

export default function TransactionsPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const [activeTab, setActiveTab] = useState('transactions');

>>>>>>> preview
        const getInitialFilters = () => {
                try {
                        const raw = localStorage.getItem('admin_transactions_filters');
                        if (raw) return JSON.parse(raw);
                } catch { }
                return {};
        };

        const initialFilters = getInitialFilters();

        const [transactions, setTransactions] = useState<any[]>([]);
        const [totalTransactions, setTotalTransactions] = useState(0);
        const [txPage, setTxPage] = useState(1);
        const pageSize = 10;
        const [txQuery, setTxQuery] = useState(initialFilters.txQuery ?? '');
<<<<<<< HEAD
        const [txStatus, setTxStatus] = useState<'paid' | 'all'>(initialFilters.txStatus ?? 'paid');
=======
        const [txStatus, setTxStatus] = useState<'paid' | 'all'>(initialFilters.txStatus ?? 'all');
>>>>>>> preview
        const [sortKey, setSortKey] = useState<'created_at' | 'paid_at'>(initialFilters.sortKey ?? 'created_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sortDir ?? 'desc');
        const [paymentMethod, setPaymentMethod] = useState<string>(initialFilters.paymentMethod ?? '');
        const [fromDate, setFromDate] = useState<string>(initialFilters.fromDate ?? '');
        const [toDate, setToDate] = useState<string>(initialFilters.toDate ?? '');
<<<<<<< HEAD
        const [isLoading, setIsLoading] = useState(false);

=======
        const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'movie' | 'vr'>(initialFilters.bookingTypeFilter ?? 'all');
        const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
                if (initialFilters.branchId !== undefined) return initialFilters.branchId;
                if (staff?.isSuperAdmin) return 'all';
                return null;
        });
        const canViewBranches = useStaffPermission('branches', 'view');
        const [branches, setBranches] = useState<any[]>([]);
        const [isLoading, setIsLoading] = useState(false);

        // Load branches only when branch viewing is allowed
        useEffect(() => {
                if (!canViewBranches) {
                        setBranches([]);
                        return;
                }

                (async () => {
                        try {
                                const { items } = await getAdminBranchOptions({ includeInactive: true });
                                setBranches(items);

                                // If not superadmin and no branch selected, default to first branch
                                if (!staff?.isSuperAdmin && selectedBranchId === null && items.length > 0) {
                                        setSelectedBranchId(items[0].id);
                                }
                        } catch (error) {
                                console.error('Error loading branches:', error);
                        }
                })();
        }, [staff, canViewBranches, selectedBranchId]);

>>>>>>> preview
        useEffect(() => {
                try {
                        const state = {
                                txQuery,
                                txStatus,
                                sortKey,
                                sortDir,
                                paymentMethod,
                                fromDate,
<<<<<<< HEAD
                                toDate
                        };
                        localStorage.setItem('admin_transactions_filters', JSON.stringify(state));
                } catch { }
        }, [txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate]);
=======
                                toDate,
                                branchId: selectedBranchId,
                                bookingTypeFilter
                        };
                        localStorage.setItem('admin_transactions_filters', JSON.stringify(state));
                } catch { }
        }, [txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate, selectedBranchId, bookingTypeFilter]);
>>>>>>> preview

        // Load transactions khi page hoặc query thay đổi
        useEffect(() => {
                (async () => {
                        try {
                                setIsLoading(true);
                                const { items, total } = await getTransactions({
                                        page: txPage,
                                        pageSize,
                                        searchText: txQuery,
                                        status: txStatus,
                                        sort: sortKey,
                                        dir: sortDir,
                                        payment_method: paymentMethod || undefined,
                                        from: fromDate || undefined,
<<<<<<< HEAD
                                        to: toDate || undefined
=======
                                        to: toDate || undefined,
                                        branch_id: selectedBranchId,
                                        booking_type: bookingTypeFilter
>>>>>>> preview
                                });
                                setTransactions(
                                        items.map((t: any) => ({
                                                id: String(t.id),
                                                userId: t.user_id,
                                                email: t.email,
                                                userName: t.userName,
                                                ticket_package_name: t.ticket_package_name,
                                                ticketCount: t.ticketCount,
                                                totalPrice: t.totalPrice,
                                                paymentMethod: t.paymentMethod,
                                                paymentStatus: t.paymentStatus,
                                                is_used: t.is_used,
                                                expired: t.expired,
                                                createdAt: new Date(t.createdAt),
                                                paidAt: t.paidAt ? new Date(t.paidAt) : null,
<<<<<<< HEAD
                                                updatedAt: t.updatedAt ? new Date(t.updatedAt) : null
=======
                                                updatedAt: t.updatedAt ? new Date(t.updatedAt) : null,
                                                branch_id: t.branch_id,
                                                booking_type: t.booking_type || 'movie'
>>>>>>> preview
                                        }))
                                );
                                setTotalTransactions(total);
                        } catch (error) {
                                console.error('Lỗi load giao dịch:', error);
                        } finally {
                                setIsLoading(false);
                        }
                })();
<<<<<<< HEAD
        }, [txPage, pageSize, txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate]);
=======
        }, [txPage, pageSize, txQuery, txStatus, sortKey, sortDir, paymentMethod, fromDate, toDate, selectedBranchId, bookingTypeFilter]);
>>>>>>> preview

        const txTotalPages = useMemo(() => Math.max(1, Math.ceil(totalTransactions / pageSize)), [totalTransactions]);

        const handleRefresh = async () => {
                try {
                        setIsLoading(true);
                        const { items, total } = await getTransactions({
                                page: txPage,
                                pageSize,
                                searchText: txQuery,
                                status: txStatus,
                                sort: sortKey,
                                dir: sortDir,
                                payment_method: paymentMethod || undefined,
                                from: fromDate || undefined,
<<<<<<< HEAD
                                to: toDate || undefined
=======
                                to: toDate || undefined,
                                branch_id: selectedBranchId,
                                booking_type: bookingTypeFilter
>>>>>>> preview
                        });
                        setTransactions(
                                items.map((t: any) => ({
                                        id: String(t.id),
                                        userId: t.user_id,
                                        email: t.email,
                                        userName: t.userName,
                                        transactionId: t.transactionId,
                                        ticket_package_name: t.ticket_package_name,
                                        ticketCount: t.ticketCount,
                                        totalPrice: t.totalPrice,
                                        paymentMethod: t.paymentMethod,
                                        paymentStatus: t.paymentStatus,
                                        createdAt: new Date(t.createdAt),
                                        paidAt: t.paidAt ? new Date(t.paidAt) : null,
                                        updatedAt: t.updatedAt ? new Date(t.updatedAt) : null,
<<<<<<< HEAD
                                        is_used: t.is_used
=======
                                        branch_id: t.branch_id,
                                        is_used: t.is_used,
                                        booking_type: t.booking_type || 'movie'
>>>>>>> preview
                                }))
                        );
                        setTotalTransactions(total);
                } catch (error) {
                        console.error('Lỗi refresh giao dịch:', error);
                } finally {
                        setIsLoading(false);
                }
        };

<<<<<<< HEAD
        return (
                <AdminLayout
                        active={'transactions' as any}
                        setActive={(() => { }) as any}
                        adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
                        handleLogout={() => {
                                localStorage.removeItem('adminToken');
                                localStorage.removeItem('adminEmail');
                                window.dispatchEvent(new Event('admin-auth-changed'));
                                window.location.href = '/';
                        }}
=======
        const handleLogout = () => {
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login');
        };

        return (
                <AdminLayout
                        active={activeTab as any}
                        setActive={setActiveTab as any}
                        adminEmailState={staff?.email || 'admin@email.com'}
                        handleLogout={handleLogout}
>>>>>>> preview
                >
                        <TransactionsContent
                                data={transactions}
                                totalPages={txTotalPages}
                                currentPage={txPage}
                                setPage={setTxPage}
                                txQuery={txQuery}
                                setTxQuery={setTxQuery}
                                transactionsLength={totalTransactions}
                                onRefresh={handleRefresh}
                                txStatus={txStatus}
                                setTxStatus={setTxStatus}
<<<<<<< HEAD
=======
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                                setSelectedBranchId={setSelectedBranchId}
>>>>>>> preview
                                sortKey={sortKey}
                                sortDir={sortDir}
                                setSortKey={setSortKey}
                                setSortDir={setSortDir}
                                paymentMethod={paymentMethod}
                                setPaymentMethod={setPaymentMethod}
                                fromDate={fromDate}
                                toDate={toDate}
                                setFromDate={setFromDate}
                                setToDate={setToDate}
<<<<<<< HEAD
=======
                                bookingTypeFilter={bookingTypeFilter}
                                setBookingTypeFilter={setBookingTypeFilter}
>>>>>>> preview
                                isLoading={isLoading}
                        />
                </AdminLayout>
        );
}
