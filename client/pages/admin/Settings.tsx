import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
        Settings as SettingsIcon,
        LayoutDashboard,
        Users,
        Clapperboard,
        Package,
        Ticket,
        CreditCard,
        ScanLine,
        Eye,
        Mail,
        FileText
} from 'lucide-react';
import { buildUrl } from '@/lib/api/http';

const ALL_TABS = [
        { key: 'dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
        { key: 'users', label: 'Người dùng', icon: Users },
        { key: 'movies', label: 'Phim', icon: Clapperboard },
        { key: 'toys', label: 'Đồ chơi', icon: Package },
        { key: 'posts', label: 'Bài viết (Admin)', icon: FileText },
        { key: 'posts-user', label: 'Bài viết ở User', icon: FileText },
        { key: 'tickets', label: 'Gói vé', icon: Ticket },
        { key: 'transactions', label: 'Giao dịch', icon: CreditCard },
        { key: 'ticket-check', label: 'Kiểm Tra Vé', icon: ScanLine },
        { key: 'uploads', label: 'Uploads', icon: Clapperboard },
        { key: 'email-logs', label: 'Email Logs', icon: Mail }
];

export default function SettingsPage() {
        const navigate = useNavigate();
        const [adminEmail, setAdminEmail] = useState('');
        const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => {
                if (window.location.hostname !== 'localhost') return [];
                const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
                return stored ? JSON.parse(stored) : [];
        });
        const [isSyncing, setIsSyncing] = useState(false);

        const isProd = window.location.hostname !== 'localhost';

        useEffect(() => {
                setAdminEmail(localStorage.getItem('adminEmail') || 'admin@email.com');

                // Sync with server if in production
                if (isProd) {
                        fetchSettings();
                }
        }, []);

        const fetchSettings = async () => {
                try {
                        const res = await fetch(buildUrl('/api/admin/settings'));
                        const data = await res.json();
                        if (data && data.settings) {
                                setHiddenTabs(data.settings);
                                localStorage.setItem('admin_sidebar_hidden_tabs', JSON.stringify(data.settings));
                                window.dispatchEvent(new Event('admin_sidebar_update'));
                        }
                } catch (err) {
                        console.error('Failed to fetch admin settings:', err);
                }
        };

        const handleToggleTab = async (key: string) => {
                if (key === 'posts' || key === 'posts-user') {
                        const password = window.prompt("Nhập mật khẩu để thay đổi cài đặt Bài viết:");
                        if (password !== 'nhat123') {
                                alert("Mật khẩu không đúng!");
                                return;
                        }
                }

                const newHidden = hiddenTabs.includes(key) ? hiddenTabs.filter((k) => k !== key) : [...hiddenTabs, key];

                setHiddenTabs(newHidden);
                localStorage.setItem('admin_sidebar_hidden_tabs', JSON.stringify(newHidden));

                // Sync to server if in production
                if (isProd) {
                        setIsSyncing(true);
                        try {
                                await fetch(buildUrl('/api/admin/settings'), {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(newHidden)
                                });
                        } catch (err) {
                                console.error('Failed to save admin settings:', err);
                        } finally {
                                setIsSyncing(false);
                        }
                }

                // Trigger sidebar update
                window.dispatchEvent(new Event('admin_sidebar_update'));
                window.dispatchEvent(new Event('storage'));
        };

        const handleLogout = () => {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminEmail');
                window.dispatchEvent(new Event('admin-auth-changed'));
                navigate('/');
        };

        return (
                <AdminLayout active="settings" setActive={() => { }} adminEmailState={adminEmail} handleLogout={handleLogout}>
                        <div className="space-y-6 max-w-5xl mx-auto">
                                {/* Header */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                                        <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200">
                                                        <SettingsIcon size={28} className="text-white" />
                                                </div>
                                                <div>
                                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Cấu hình Hệ thống</h1>
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">
                                                                Tùy chỉnh không gian làm việc của bạn
                                                        </p>
                                                </div>
                                        </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Left Column: UI Customization */}
                                        <div className="lg:col-span-2 space-y-6">
                                                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
                                                        <div className="p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                                                                <div className="relative z-10 flex items-center gap-4">
                                                                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                                                                <Eye size={24} className="text-blue-400" />
                                                                        </div>
                                                                        <div>
                                                                                <CardTitle className="text-2xl font-black tracking-tight">Cấu hình Hiển thị Menu</CardTitle>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                        <p className="text-slate-400 text-sm font-medium">
                                                                                                Bật/Tắt các đề mục trên thanh điều hướng để tối ưu hóa diện tích
                                                                                        </p>
                                                                                        {isProd && (
                                                                                                <Badge
                                                                                                        variant="outline"
                                                                                                        className={`ml-2 text-[10px] ${isSyncing ? 'animate-pulse bg-blue-500/10 text-blue-400 border-blue-400/20' : 'bg-green-500/10 text-green-400 border-green-400/20'}`}
                                                                                                >
                                                                                                        {isSyncing ? 'Đang lưu...' : 'Đã đồng bộ Cloud'}
                                                                                                </Badge>
                                                                                        )}
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                        <CardContent className="p-8">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                        {ALL_TABS.map((tab) => {
                                                                                const Icon = tab.icon;
                                                                                const isHidden = hiddenTabs.includes(tab.key);
                                                                                return (
                                                                                        <div
                                                                                                key={tab.key}
                                                                                                className={`group flex items-center justify-between p-5 rounded-[1.5rem] border transition-all duration-500 ${isHidden
                                                                                                                ? 'bg-slate-50 border-slate-100'
                                                                                                                : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 cursor-pointer'
                                                                                                        }`}
                                                                                                onClick={() => handleToggleTab(tab.key)}
                                                                                        >
                                                                                                <div className="flex items-center gap-4">
                                                                                                        <div
                                                                                                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500 ${isHidden
                                                                                                                                ? 'bg-slate-200 text-slate-400'
                                                                                                                                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                                                                                                                        }`}
                                                                                                        >
                                                                                                                <Icon size={20} />
                                                                                                        </div>
                                                                                                        <div className="flex flex-col">
                                                                                                                <span
                                                                                                                        className={`font-black text-sm tracking-tight ${isHidden ? 'text-slate-400' : 'text-slate-900'}`}
                                                                                                                >
                                                                                                                        {tab.label}
                                                                                                                </span>
                                                                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                                                                        {isHidden ? 'Đang ẩn' : 'Hiển thị'}
                                                                                                                </span>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <Switch
                                                                                                        checked={!isHidden}
                                                                                                        onCheckedChange={() => handleToggleTab(tab.key)}
                                                                                                        className="data-[state=checked]:bg-blue-600"
                                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                                />
                                                                                        </div>
                                                                                );
                                                                        })}
                                                                </div>
                                                        </CardContent>
                                                </Card>
                                        </div>

                                        {/* Right Column: Tips & Info */}
                                        <div className="space-y-6">
                                                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] bg-indigo-600 text-white p-8 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                                                        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                                                                <LayoutDashboard size={20} /> Mẹo nhỏ
                                                        </h3>
                                                        <p className="text-sm font-medium text-indigo-100 leading-[1.6]">
                                                                Bạn có thể ẩn đi những mục ít sử dụng như "Uploads" hoặc "Đồ chơi" để thanh điều hướng trông gọn gàng
                                                                hơn. Đừng lo, các mục này sẽ không bị xóa vĩnh viễn!
                                                        </p>
                                                </Card>

                                                <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2rem] space-y-4">
                                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                                                <SettingsIcon size={20} />
                                                        </div>
                                                        <h4 className="text-lg font-black text-slate-900">Quyền riêng tư</h4>
                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                                {isProd
                                                                        ? 'Cài đặt hiển thị này được đồng bộ trực tuyến (Workers KV) và sẽ tự động áp dụng khi bạn đăng nhập từ bất kỳ thiết bị nào.'
                                                                        : 'Cài đặt hiển thị này đang được lưu trữ cục bộ (LocalStorage) vì bạn đang ở môi trường phát triển.'}
                                                        </p>
                                                </div>
                                        </div>
                                </div>
                        </div>
                </AdminLayout>
        );
}
