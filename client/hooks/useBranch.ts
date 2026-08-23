import { useState, useEffect } from 'react';
import { getDefaultBranch, getPublicBranches } from '@/lib/api/branches';

const SELECTED_BRANCH_KEY = 'selected_branch_id';
const DONT_SHOW_CONFIRM_KEY = 'dont_show_branch_confirm';

interface Branch {
  id: number;
  name: string;
  code: string;
  is_default: boolean;
  is_active: boolean;
}

export function useBranch() {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dontShowConfirm, setDontShowConfirm] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoading(true);

      // Load saved branch from localStorage
      const savedBranchId = localStorage.getItem(SELECTED_BRANCH_KEY);
      const savedDontShow = localStorage.getItem(DONT_SHOW_CONFIRM_KEY);
      setDontShowConfirm(savedDontShow === 'true');

      // Load all branches
      const { items } = await getPublicBranches();
      setBranches(items);

      if (savedBranchId) {
        const savedBranch = items.find((b: Branch) => b.id === Number(savedBranchId));
        if (savedBranch) {
          setSelectedBranch(savedBranch);
          setIsLoading(false);
          return;
        }
      }

      // If no saved branch or saved branch not found, get default
      const { branch: defaultBranch } = await getDefaultBranch();
      if (defaultBranch) {
        setSelectedBranch(defaultBranch);
        localStorage.setItem(SELECTED_BRANCH_KEY, String(defaultBranch.id));
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    localStorage.setItem(SELECTED_BRANCH_KEY, String(branch.id));
  };

  const toggleDontShowConfirm = (value: boolean) => {
    setDontShowConfirm(value);
    localStorage.setItem(DONT_SHOW_CONFIRM_KEY, String(value));
  };

  return {
    selectedBranch,
    branches,
    isLoading,
    selectBranch,
    dontShowConfirm,
    toggleDontShowConfirm
  };
}
