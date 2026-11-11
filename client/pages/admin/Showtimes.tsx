import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import ShowtimesContent, { type BranchesStatus } from '@/components/admin/content/ShowtimesContent';
import { getShowtimesAdmin, getAdminBranchOptions } from '@/lib/api';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { notify } from '@/components/admin/common/notify';
import type { ShowtimeItem } from '@/lib/api/showtimes';

export default function ShowtimesPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);

  const [activeTab, setActiveTab] = useState('showtimes');
  const [branches, setBranches] = useState<any[]>([]);
  // loading: waiting for the branch list; ready: loaded (the list may be empty); error: the branch list failed to load
  const [branchesStatus, setBranchesStatus] = useState<BranchesStatus>('loading');
  const [schedules, setSchedules] = useState<Record<number, ShowtimeItem[]>>({});
  // Branches whose schedule failed to load: they must not look like "no schedule yet"
  const [failedBranchIds, setFailedBranchIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSchedules = useCallback(async (branchList: any[]) => {
    setIsLoading(true);
    try {
      const results = await Promise.all(
        branchList.map(async (branch) => {
          try {
            const { items } = await getShowtimesAdmin(branch.id);
            return { branchId: branch.id as number, items: items || [], failed: false };
          } catch {
            return { branchId: branch.id as number, items: [] as ShowtimeItem[], failed: true };
          }
        })
      );
      // A failed branch keeps whatever was loaded before; it is only marked as failed
      setSchedules((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (!result.failed) next[result.branchId] = result.items;
        });
        return next;
      });
      setFailedBranchIds(results.filter((result) => result.failed).map((result) => result.branchId));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    setBranchesStatus('loading');
    try {
      // ALWAYS use getAdminBranchOptions to respect backend branch scoping
      const { items: branchItems } = await getAdminBranchOptions({ includeInactive: true });
      const activeBranches = (branchItems || []).filter((b: any) => !b.deleted_at);
      setBranches(activeBranches);
      setBranchesStatus('ready');
      await loadSchedules(activeBranches);
    } catch (error) {
      console.error('Error loading branches:', error);
      setBranchesStatus('error');
      notify.error('Không tải được danh sách chi nhánh');
    }
  }, [loadSchedules]);

  const handleRefresh = useCallback(async () => {
    await loadSchedules(branches);
  }, [branches, loadSchedules]);

  const refreshBranch = useCallback(async (branchId: number) => {
    try {
      const { items } = await getShowtimesAdmin(branchId);
      setSchedules((prev) => ({ ...prev, [branchId]: items || [] }));
      setFailedBranchIds((prev) => prev.filter((id) => id !== branchId));
    } catch (err: any) {
      setFailedBranchIds((prev) => (prev.includes(branchId) ? prev : [...prev, branchId]));
      notify.error(err, 'Không tải được lịch chiếu');
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

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
        branchesStatus={branchesStatus}
        schedules={schedules}
        failedBranchIds={failedBranchIds}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onRetryBranches={loadBranches}
        onRefreshBranch={refreshBranch}
      />
    </AdminLayout>
  );
}
