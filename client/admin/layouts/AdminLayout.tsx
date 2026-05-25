import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Film,
  Puzzle,
  FileText,
  Ticket,
  Receipt,
  Scan,
  Upload,
  Mail,
  Settings,
  LogOut,
  Building2
} from 'lucide-react';
import { getAdminProfileFromStorage } from '@/lib/admin-profile-utils';

interface AdminLayoutProps {
  children: React.ReactNode;
  active?: string;
  setActive?: (active: string) => void;
  adminEmailState?: string;
  handleLogout?: () => void;
}

interface NavigationItem {
  title: string;
  url: string;
  icon: React.ElementType<{ className?: string }>;
  superAdminOnly?: boolean;
  requiredPermissions?: string[];
}

export const adminNavigationItems: NavigationItem[] = [
  { title: 'Tổng quan', url: '/', icon: Home, requiredPermissions: ['dashboard.view', 'dashboard.stats'] },
  { title: 'Người dùng', url: '/users', icon: Users, superAdminOnly: true },
  {
    title: 'Phim',
    url: '/movies',
    icon: Film,
    requiredPermissions: ['movies.view', 'movies.create', 'movies.edit', 'movies.delete', 'movies.publish']
  },
  { title: 'Đồ chơi', url: '/toys', icon: Puzzle, requiredPermissions: ['toys.view', 'toys.create', 'toys.edit', 'toys.delete'] },
  {
    title: 'Bài viết',
    url: '/posts',
    icon: FileText,
    requiredPermissions: ['posts.view', 'posts.create', 'posts.edit', 'posts.delete', 'posts.publish']
  },
  {
    title: 'Gói vé',
    url: '/tickets',
    icon: Ticket,
    requiredPermissions: ['tickets.view', 'tickets.create', 'tickets.edit', 'tickets.delete']
  },
  {
    title: 'Giao dịch',
    url: '/transactions',
    icon: Receipt,
    requiredPermissions: ['transactions.view', 'transactions.refund']
  },
  {
    title: 'Soát vé',
    url: '/ticket-check',
    icon: Scan,
    requiredPermissions: ['ticket_check.scan', 'ticket_check.validate', 'ticket_check.history']
  },
  {
    title: 'Chi nhánh',
    url: '/branches',
    icon: Building2,
    requiredPermissions: ['branches.view', 'branches.create', 'branches.edit', 'branches.delete']
  },
  { title: 'Tải lên', url: '/uploads', icon: Upload, requiredPermissions: ['uploads.view', 'uploads.upload', 'uploads.delete'] },
  { title: 'Nhật ký email', url: '/email-logs', icon: Mail, requiredPermissions: ['email_logs.view', 'email_logs.resend'] },
  { title: 'Cài đặt', url: '/settings', icon: Settings, requiredPermissions: ['settings.manage'] },
];

export default function AdminLayout({ children, setActive, adminEmailState, handleLogout }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminRole, setAdminRole] = useState<string>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.role || '';
  });
  const [adminPermissions, setAdminPermissions] = useState<string[]>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.permissions || [];
  });

  useEffect(() => {
    const onAuthChanged = () => {
      const profile = getAdminProfileFromStorage();
      setAdminRole(profile?.role || '');
      setAdminPermissions(profile?.permissions || []);
    };
    window.addEventListener('admin-auth-changed', onAuthChanged as any);
    window.addEventListener('storage', onAuthChanged as any);
    return () => {
      window.removeEventListener('admin-auth-changed', onAuthChanged as any);
      window.removeEventListener('storage', onAuthChanged as any);
    };
  }, []);

  useEffect(() => {
    if (!setActive) return;
    const item = adminNavigationItems.find(
      (i) => location.pathname === i.url || (i.url !== '/' && location.pathname.startsWith(i.url))
    );
    setActive(item?.title || 'Dashboard');
  }, [location.pathname, setActive, adminNavigationItems]);

  const adminPermissionsSet = useMemo(() => new Set(adminPermissions), [adminPermissions]);

  const filteredNavItems = useMemo(() => {
    return adminNavigationItems.filter((item) => {
      if (adminRole === 'super_admin') return true;
      if (item.superAdminOnly) return false;

      const required = item.requiredPermissions;
      if (!required || required.length === 0) return true;
      return required.some((p) => adminPermissionsSet.has(p));
    });
  }, [adminRole, adminPermissionsSet]);

  const currentTitle = adminNavigationItems.find((item) =>
    location.pathname === item.url ||
    (item.url !== '/' && location.pathname.startsWith(item.url))
  )?.title || 'Admin Dashboard';

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="h-14 bg-white border-b shadow-sm shrink-0 flex">
        <div className="w-60 border-r flex items-center px-4 font-semibold text-gray-900 shrink-0">
          Quản trị hệ thống
        </div>
        <div className="flex-1 flex items-center px-6 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{currentTitle}</h1>
          <div className="flex-1" />
          {adminEmailState && <span className="text-sm text-gray-600 truncate max-w-[320px]">{adminEmailState}</span>}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-white border-r flex flex-col overflow-hidden shrink-0">
          <nav className="flex-1 p-2 overflow-y-auto">
            <ul className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.url ||
                  (item.url !== '/' && location.pathname.startsWith(item.url));
                return (
                  <li key={item.title}>
                    <button
                      onClick={() => navigate(item.url)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors border-l-4 ${
                        isActive
                          ? 'bg-blue-50 font-semibold text-blue-800 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 border-transparent'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t mt-auto shrink-0">
            {adminEmailState && (
              <div className="text-xs text-gray-500 mb-2 truncate" title={adminEmailState}>
                {adminEmailState}
              </div>
            )}
            {handleLogout && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded"
              >
                <LogOut className="h-4 w-4" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
