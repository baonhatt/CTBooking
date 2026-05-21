import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import iconCine from '@/assets/images/iconCine.svg';
import {
        LayoutDashboard,
        Users as UsersIcon,
        Clapperboard,
        Package,
        FileText,
        Ticket as TicketIcon,
        CreditCard,
        ScanLine,
        LogOut,
        Settings,
        Mail,
        Menu,
        X
} from 'lucide-react';
import { buildUrl } from '@/lib/api/http';

interface Props {
        active:
        | 'dashboard'
        | 'users'
        | 'movies'
        | 'toys'
        | 'posts'
        | 'transactions'
        | 'tickets'
        | 'ticket-check'
        | 'uploads'
        | 'email-logs'
        | 'settings';
        setActive: (x: Props['active']) => void;
        adminEmailState: string;
        handleLogout: () => void;
        children: React.ReactNode;
}

export default function AdminLayout({ active, setActive, adminEmailState, handleLogout, children }: Props) {
        const navigate = useNavigate();
        const [isSidebarOpen, setIsSidebarOpen] = useState(false);

        function go(tab: Props['active']) {
                setActive(tab);
                setIsSidebarOpen(false); // Close sidebar on mobile when navigating
                navigate(`/${tab === 'ticket-check' ? 'ticket-check' : tab}`);
        }
        const itemClass = (isActive: boolean) =>
                `w-full justify-start gap-2 rounded-md ${isActive ? 'bg-white/10 text-white' : 'text-white/90'} hover:bg-white/10`;

        const [hiddenTabs, setHiddenTabs] = React.useState<string[] | { hidden_tabs: string[] }>(() => {
                const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
                if (!stored) return [];
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : (parsed?.hidden_tabs || []);
        });

        // Listen for storage changes to update sidebar visibility in real-time if needed
        React.useEffect(() => {
                const handleStorageChange = () => {
                        const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
                        if (!stored) {
                                setHiddenTabs([]);
                                return;
                        }
                        const parsed = JSON.parse(stored);
                        setHiddenTabs(Array.isArray(parsed) ? parsed : (parsed?.hidden_tabs || []));
                };
                window.addEventListener('storage', handleStorageChange);
                // Custom event for same-window updates
                window.addEventListener('admin_sidebar_update', handleStorageChange);

                // Initial sync from server if in production
                const isProd = window.location.hostname !== 'localhost';
                if (isProd) {
                        fetch(buildUrl('/api/admin/settings'))
                                .then((res) => res.json())
                                .then((data) => {
                                        if (data && data.settings) {
                                                const settings = data.settings;
                                                const hiddenTabsArray = Array.isArray(settings) ? settings : (settings?.hidden_tabs || []);
                                                const settingsStr = JSON.stringify(hiddenTabsArray);
                                                if (localStorage.getItem('admin_sidebar_hidden_tabs') !== settingsStr) {
                                                        localStorage.setItem('admin_sidebar_hidden_tabs', settingsStr);
                                                        setHiddenTabs(hiddenTabsArray);
                                                }
                                        }
                                })
                                .catch((err) => console.error('Failed to sync settings from server:', err));
                }

                return () => {
                        window.removeEventListener('storage', handleStorageChange);
                        window.removeEventListener('admin_sidebar_update', handleStorageChange);
                };
        }, []);

        const menu = [
                { key: 'dashboard' as const, label: 'Bảng điều khiển', icon: <LayoutDashboard className="h-4 w-4" /> },
                { key: 'users' as const, label: 'Người dùng', icon: <UsersIcon className="h-4 w-4" /> },
                { key: 'movies' as const, label: 'Phim', icon: <Clapperboard className="h-4 w-4" /> },
                { key: 'toys' as const, label: 'Đồ chơi', icon: <Package className="h-4 w-4" /> },
                { key: 'posts' as const, label: 'Bài viết', icon: <FileText className="h-4 w-4" /> },
                { key: 'tickets' as const, label: 'Gói vé', icon: <TicketIcon className="h-4 w-4" /> },
                { key: 'transactions' as const, label: 'Giao dịch', icon: <CreditCard className="h-4 w-4" /> },
                { key: 'ticket-check' as const, label: 'Kiểm Tra Vé', icon: <ScanLine className="h-4 w-4" /> },
                { key: 'uploads' as const, label: 'Uploads', icon: <Clapperboard className="h-4 w-4" /> },
                { key: 'email-logs' as const, label: 'Email Logs', icon: <Mail className="h-4 w-4" /> }
        ].filter((item) => {
                const hiddenTabsArray = Array.isArray(hiddenTabs) ? hiddenTabs : (hiddenTabs?.hidden_tabs || []);
                return !hiddenTabsArray.includes(item.key);
        });

        return (
                <div className="min-h-screen flex md:grid md:grid-cols-[260px_1fr] flex-col md:flex-row relative">
                        {/* Mobile Overlay */}
                        {isSidebarOpen && (
                                <div
                                        className="fixed inset-0 bg-black/60 z-40 md:hidden"
                                        onClick={() => setIsSidebarOpen(false)}
                                />
                        )}

                        {/* Sidebar */}
                        <aside
                                className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-gradient-to-b from-[#0e1b3d] to-[#15325f] border-r border-white/10 p-4 text-white flex flex-col justify-between h-screen overflow-y-auto
      `}>
                                <div>
                                        <div className="flex flex-col mb-4 px-1 gap-1 relative">
                                                {/* Mobile close button */}
                                                <button
                                                        className="absolute top-0 right-0 p-1 md:hidden text-white/70 hover:text-white"
                                                        onClick={() => setIsSidebarOpen(false)}
                                                >
                                                        <X className="h-5 w-5" />
                                                </button>
                                                <div className="flex items-center gap-3">
                                                        <img src={iconCine} alt="CINESPHERE" className="h-10 w-auto" />
                                                        <div className="font-bold tracking-widest text-sm">CINESPHERE</div>
                                                </div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 mt-2">
                                                        {adminEmailState}
                                                </div>
                                        </div>

                                        <div className="space-y-1">
                                                {menu.map((item) => (
                                                        <Button
                                                                key={item.key}
                                                                variant="ghost"
                                                                onClick={() => go(item.key)}
                                                                className={itemClass(active === item.key)}
                                                        >
                                                                {item.icon} {item.label}
                                                        </Button>
                                                ))}
                                        </div>
                                </div>

                                <div className="space-y-2 mt-auto pt-8 border-t border-white/5">
                                        <Button variant="ghost" onClick={() => go('settings')} className={itemClass(active === 'settings')}>
                                                <Settings className="h-4 w-4" /> Cấu hình
                                        </Button>
                                        <Button
                                                variant="destructive"
                                                onClick={handleLogout}
                                                className="w-full justify-start gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 transition-all duration-300 rounded-md px-3"
                                        >
                                                <LogOut className="h-4 w-4" /> Đăng xuất
                                        </Button>
                                </div>
                        </aside>

                        <main className="flex-1 bg-[#f8fafc] md:overflow-y-auto h-screen flex flex-col">
                                {/* Toggle Bar / Header for Mobile */}
                                <div className="lg:hidden md:hidden w-full bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                                        <div className="flex items-center gap-3">
                                                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
                                                        <Menu className="h-6 w-6 text-gray-700" />
                                                </Button>
                                                <span className="font-bold text-gray-800">Admin Dashboard</span>
                                        </div>
                                        <img src={iconCine} alt="Logo" className="h-8 w-auto filter invert brightness-0" />
                                </div>

                                {/* Content area */}
                                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                                        {children}
                                </div>
                        </main>
                </div>
        );
}
