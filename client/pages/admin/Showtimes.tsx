import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import ShowtimesContent from '@/components/admin/content/ShowtimesContent';
import { getShowtimesAdmin, getAdminBranchOptions, getPublicBranches } from '@/lib/api';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ShowtimeItem } from '@/lib/api/showtimes';

export default function ShowtimesPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const canViewBranches = useStaffPermission('branches', 'view');

        const [activeTab, setActiveTab] = useState('showtimes');
        const [branches, setBranches] = useState<any[]>([]);
        const [schedules, setSchedules] = useState<Record<number, ShowtimeItem[]>>({});
        const [isLoading, setIsLoading] = useState(false);

        const loadSchedules = useCallback(async (branchList: any[]) => {
                setIsLoading(true);
                try {
                        const entries = await Promise.all(
                                branchList.map(async (branch) => {
                                        try {
                                                const { items } = await getShowtimesAdmin(branch.id);
                                                return [branch.id, items || []] as const;
                                        } catch {
                                                return [branch.id, []] as const;
                                        }
                                })
                        );
                        setSchedules(Object.fromEntries(entries));
                } finally {
                        setIsLoading(false);
                }
        }, []);

        const handleRefresh = useCallback(async () => {
                await loadSchedules(branches);
        }, [branches, loadSchedules]);

        const refreshBranch = useCallback(async (branchId: number) => {
                try {
                        const { items } = await getShowtimesAdmin(branchId);
                        setSchedules((prev) => ({ ...prev, [branchId]: items || [] }));
                } catch (err: any) {
                        toast.error(err.message || 'Không tải được lịch chiếu');
                }
        }, []);

        useEffect(() => {
                (async () => {
                        try {
                                const { items: branchItems } = canViewBranches
                                        ? await getAdminBranchOptions({ includeInactive: true })
                                        : await getPublicBranches();
                                const activeBranches = (branchItems || []).filter((b: any) => !b.deleted_at);
                                setBranches(activeBranches);
                                await loadSchedules(activeBranches);
                        } catch (error) {
                                console.error('Error loading branches:', error);
                                toast.error('Không tải được danh sách chi nhánh');
                        }
                })();
        }, [canViewBranches, loadSchedules]);

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
                        <ShowtimesContent
                                branches={branches}
                                schedules={schedules}
                                isLoading={isLoading}
                                onRefresh={handleRefresh}
                                onRefreshBranch={refreshBranch}
                        />
                </AdminLayout>
        );
}
