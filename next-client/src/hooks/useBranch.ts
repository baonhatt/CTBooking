'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getDefaultBranch, getPublicBranches } from '@/lib/api/branches';
import { deleteCookie, getCookie, setCookie } from '@/lib/cookies';

const SELECTED_BRANCH_KEY = 'selected_branch_id';
const DONT_SHOW_CONFIRM_KEY = 'dont_show_branch_confirm';

interface Branch {
  id: number;
  name: string;
  code: string;
  is_default: boolean;
  is_active: boolean;
}

async function fetchBranchData(branchId?: number | null): Promise<{ branches: Branch[]; selectedBranch: Branch | null }> {
  const { items } = await getPublicBranches();

  if (branchId !== undefined && branchId !== null) {
    const selected = items.find((b: Branch) => b.id === Number(branchId));
    if (selected) return { branches: items, selectedBranch: selected };
  }

  const savedBranchId =
    typeof window !== 'undefined' ? getCookie(SELECTED_BRANCH_KEY) || localStorage.getItem(SELECTED_BRANCH_KEY) : null;
  if (savedBranchId) {
    const saved = items.find((b: Branch) => b.id === Number(savedBranchId));
    if (saved) return { branches: items, selectedBranch: saved };
  }

  const { branch: defaultBranch } = await getDefaultBranch();
  if (defaultBranch) {
    if (typeof window !== 'undefined') {
      setCookie(SELECTED_BRANCH_KEY, String(defaultBranch.id), 60 * 60 * 24 * 30);
      localStorage.setItem(SELECTED_BRANCH_KEY, String(defaultBranch.id));
    }
    return { branches: items, selectedBranch: defaultBranch };
  }

  return { branches: items, selectedBranch: items[0] ?? null };
}

export function useBranch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPostsRoute = pathname === '/bai-viet' || pathname.startsWith('/bai-viet/');

  const urlBranchId = useMemo(() => {
    const raw = searchParams.get('branch_id');
    const parsed = raw ? Number(raw) : null;
    return parsed && Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const [dontShowConfirm, setDontShowConfirmState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DONT_SHOW_CONFIRM_KEY) === 'true';
  });

  const { data, isLoading } = useQuery({
    queryKey: ['branches', urlBranchId],
    queryFn: () => fetchBranchData(urlBranchId),
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    if (isPostsRoute || urlBranchId || !data?.selectedBranch) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('branch_id', String(data.selectedBranch.id));
    router.replace(`${pathname}?${params.toString()}`);
  }, [data?.selectedBranch, isPostsRoute, pathname, router, searchParams, urlBranchId]);

  const selectBranch = useCallback(
    (branch: Branch) => {
      setCookie(SELECTED_BRANCH_KEY, String(branch.id), 60 * 60 * 24 * 30);
      localStorage.setItem(SELECTED_BRANCH_KEY, String(branch.id));

      queryClient.setQueryData(['branches', branch.id], (old: typeof data) =>
        old ? { ...old, selectedBranch: branch } : old
      );

      const params = new URLSearchParams(searchParams.toString());
      params.set('branch_id', branch.id.toString());
      if (isPostsRoute) {
        router.push(pathname);
      } else {
        router.push(`${pathname}?${params.toString()}`);
      }

      queryClient.invalidateQueries({ queryKey: ['activeMovies'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
    },
    [data, isPostsRoute, pathname, queryClient, router, searchParams]
  );

  const toggleDontShowConfirm = useCallback((value: boolean) => {
    setDontShowConfirmState(value);
    setCookie(DONT_SHOW_CONFIRM_KEY, String(value), 60 * 60 * 24 * 30);
    localStorage.setItem(DONT_SHOW_CONFIRM_KEY, String(value));
  }, []);

  return {
    selectedBranch: data?.selectedBranch ?? null,
    branches: data?.branches ?? [],
    isLoading,
    selectBranch,
    dontShowConfirm,
    toggleDontShowConfirm
  };
}
