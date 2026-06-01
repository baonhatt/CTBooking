import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import DashboardContent from '@/components/admin/content/DashboardContent';
import {
        getDashboardMetrics,
        getRevenueByDate,
        getRevenue7Days,
        getRevenueByMonth,
        getTransactions,
        getBranches
} from '@/lib/api';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const [activeTab, setActiveTab] = useState('dashboard');
        const [metrics, setMetrics] = useState({
                totalMovies: 0,
                totalToys: 0,
                totalUsers: 0,
                totalTransactions: 0,
                revenueTotal: 0,
                revenueByMethod: { cash: 0, momo: 0, vnpay: 0, vietqr: 0 },
                topTicketsWeek: [],
                paymentStats: [],
                topVipUsers: [],
                ticketUsage: { used: 0, total: 0 },
                paymentHealth: { paid: 0, pending: 0, failed: 0 },
                bookingHours: Array(24).fill(0)
        });

        // Master Year Filter (with localStorage)
        const [selectedYear, setSelectedYear] = useState<number>(() => {
                const stored = localStorage.getItem('dashboard_selected_year');
                return stored ? parseInt(stored) : new Date().getFullYear();
        });

        // Save to localStorage when year changes
        useEffect(() => {
                localStorage.setItem('dashboard_selected_year', String(selectedYear));
        }, [selectedYear]);

        // Date picker state
        const [selectedDate, setSelectedDate] = useState<string>('');
        const [dateFilterType, setDateFilterType] = useState<'year' | 'day' | 'month'>('year');
        const [dateRevenue, setDateRevenue] = useState({
                total: 0,
                count: 0,
                revenueByMethod: { cash: 0, momo: 0, vnpay: 0, vietqr: 0 }
        });

        // 7-day chart state
        const [revenue7DaysData, setRevenue7DaysData] = useState<Array<{ day: string; revenue: number }>>([]);

        // Monthly chart state (removed - will use selectedYear)
        const [revenueByMonthData, setRevenueByMonthData] = useState<Array<{ month: number; revenue: number }>>([]);

        // Specific Loading States
        const [isPageLoading, setIsPageLoading] = useState(true);
        const [isTopTicketsLoading, setIsTopTicketsLoading] = useState(false);
        const [isRevenueLoading, setIsRevenueLoading] = useState(false);

        // Period for top tickets
        const [topPeriod, setTopPeriod] = useState<string>('week');

        // Global Refresh Key
        const [refreshKey, setRefreshKey] = useState(0);

        // Branch filter
        const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
                if (staff?.isSuperAdmin) return 'all';
                return null;
        });
        const [branches, setBranches] = useState<any[]>([]);

        // Load branches
        useEffect(() => {
                (async () => {
                        try {
                                const { items } = await getBranches({ includeInactive: true });
                                setBranches(items);

                                // If not superadmin, default to their first branch if none selected
                                if (!staff?.isSuperAdmin && !selectedBranchId && items.length > 0) {
                                        setSelectedBranchId(items[0].id);
                                }
                        } catch (error) {
                                console.error('Error loading branches:', error);
                        }
                })();
        }, [staff]);

        const handleRefresh = () => {
                setRefreshKey((prev) => prev + 1);
        };

        // Load metrics when topPeriod, selectedYear, or refreshKey changes
        useEffect(() => {
                (async () => {
                        try {
                                setIsTopTicketsLoading(true);
                                const data = await getDashboardMetrics(topPeriod, selectedYear, selectedBranchId);
                                setMetrics(data);
                        } catch (err) {
                                console.error('Failed to load metrics:', err);
                        } finally {
                                setIsTopTicketsLoading(false);
                                setIsPageLoading(false);
                        }
                })();
        }, [topPeriod, selectedYear, refreshKey, selectedBranchId]);

        // Load revenue for selected year on mount or refresh
        useEffect(() => {
                (async () => {
                        try {
                                setIsRevenueLoading(true);
                                const data = await getRevenueByDate(undefined, 'paid', selectedYear, selectedBranchId);
                                setDateRevenue({ total: data.total, count: data.count, revenueByMethod: data.revenueByMethod });
                        } catch (err) {
                                console.error('Failed to load date revenue:', err);
                        } finally {
                                setIsRevenueLoading(false);
                        }
                })();
        }, [selectedYear, refreshKey, selectedBranchId]);

        // Handle date filter apply
        const handleApplyDateFilter = async () => {
                try {
                        setIsRevenueLoading(true);
                        if (dateFilterType === 'year') {
                                const data = await getRevenueByDate(undefined, 'paid', selectedYear, selectedBranchId);
                                setDateRevenue({ total: data.total, count: data.count, revenueByMethod: data.revenueByMethod });
                        } else if (dateFilterType === 'day') {
                                const data = await getRevenueByDate(selectedDate, 'paid', selectedYear, selectedBranchId);
                                setDateRevenue({ total: data.total, count: data.count, revenueByMethod: data.revenueByMethod });
                        } else if (dateFilterType === 'month') {
                                const [year, month] = selectedDate.split('-');
                                const data = await getRevenueByMonth(parseInt(year), parseInt(month), 'paid', selectedBranchId);
                                if ('total' in data) {
                                        setDateRevenue({
                                                total: data.total,
                                                count: data.count,
                                                revenueByMethod: (data as any).revenueByMethod || { cash: 0, momo: 0, vnpay: 0, vietqr: 0 }
                                        });
                                }
                        }
                } catch (err) {
                        console.error('Failed to apply date filter:', err);
                } finally {
                        setIsRevenueLoading(false);
                }
        };

        // Load 7-day revenue for selected year
        useEffect(() => {
                (async () => {
                        try {
                                const data = await getRevenue7Days(selectedYear, selectedBranchId);
                                setRevenue7DaysData(data.data);
                        } catch (err) {
                                console.error('Failed to load 7-day revenue:', err);
                        }
                })();
        }, [selectedYear, refreshKey, selectedBranchId]);

        // Load monthly revenue when selectedYear or refreshKey changes
        useEffect(() => {
                (async () => {
                        try {
                                const data = await getRevenueByMonth(selectedYear, undefined, 'paid', selectedBranchId);
                                if ('data' in data) {
                                        setRevenueByMonthData(data.data);
                                }
                        } catch (err) {
                                console.error('Failed to load monthly revenue:', err);
                        }
                })();
        }, [selectedYear, refreshKey, selectedBranchId]);

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
                >
                        <DashboardContent
                                metrics={metrics}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                dateRevenue={dateRevenue}
                                onApplyDateFilter={handleApplyDateFilter}
                                dateFilterType={dateFilterType}
                                setDateFilterType={setDateFilterType}
                                revenue7DaysData={revenue7DaysData}
                                selectedYear={selectedYear}
                                setSelectedYear={setSelectedYear}
                                revenueByMonthData={revenueByMonthData}
                                isPageLoading={isPageLoading}
                                isTopTicketsLoading={isTopTicketsLoading}
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                                setSelectedBranchId={setSelectedBranchId}
                                isRevenueLoading={isRevenueLoading}
                                topPeriod={topPeriod}
                                setTopPeriod={setTopPeriod}
                                onRefresh={handleRefresh}
                        />
                </AdminLayout>
        );
}
