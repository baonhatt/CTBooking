import React, { useState, useEffect, useMemo } from 'react';
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
	User,
	Menu,
	X,
	CalendarClock,
	Percent,
	ChevronDown,
	ChevronRight,
	Building2,
	ShieldCheck,
	History,
	UploadCloud,
	Search,
	Folder,
	FolderOpen
} from 'lucide-react';
import { request } from '@/lib/api/http';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';

interface AdminSettingsData {
	settings: {
		hidden_tabs?: string[];
	};
}

interface Props {
	active:
	| 'dashboard'
	| 'users'
	| 'movies'
	| 'showtimes'
	| 'toys'
	| 'posts'
	| 'transactions'
	| 'tickets'
	| 'vouchers'
	| 'deleted-vouchers'
	| 'ticket-check'
	| 'uploads'
	| 'email-logs'
	| 'settings'
	| 'branches'
	| 'staff'
	| 'roles'
	| 'audit-logs'
	| 'profile';
	setActive: React.Dispatch<React.SetStateAction<Props['active']>>;
	adminEmailState?: string;
	handleLogout: () => void;
	children: React.ReactNode;
}

interface SidebarMenuItem {
	key: Props['active'];
	label: string;
	icon: React.ReactNode;
	module?: string;
	action?: string;
}

interface SidebarMenuGroup {
	id: string;
	title: string;
	icon: React.ReactNode;
	items: SidebarMenuItem[];
}

export default function AdminLayout({ active, setActive, handleLogout, children }: Props) {
	const navigate = useNavigate();
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const permissions = useStaffPermissions();
	const isSuperAdmin = useIsSuperAdmin();
	const staff = useStaffStore((state) => state.staff);

	const staffEmail = staff?.email || 'Admin';
	const staffName = staff?.fullname || staffEmail;

	const menuGroups: SidebarMenuGroup[] = [
		{
			id: 'overview',
			title: 'Tổng quan',
			icon: <LayoutDashboard className="h-4 w-4 text-blue-400" />,
			items: [
				{ key: 'dashboard', label: 'Bảng điều khiển', icon: <LayoutDashboard className="h-4 w-4 text-blue-400" /> }
			]
		},
		{
			id: 'cinema_ops',
			title: 'Vận hành Rạp',
			icon: <Clapperboard className="h-4 w-4 text-emerald-400" />,
			items: [
				{ key: 'movies', label: 'Danh sách Phim', icon: <Clapperboard className="h-4 w-4 text-emerald-400" /> },
				{ key: 'showtimes', label: 'Lịch chiếu phim', icon: <CalendarClock className="h-4 w-4 text-emerald-400" /> },
				{ key: 'tickets', label: 'Gói vé & Bảng giá', icon: <TicketIcon className="h-4 w-4 text-emerald-400" /> },
				{ key: 'toys', label: 'Đồ chơi & quà tặng', icon: <Package className="h-4 w-4 text-emerald-400" /> },
				{ key: 'posts', label: 'Bài viết & Bảng tin', icon: <FileText className="h-4 w-4 text-emerald-400" /> }
			]
		},
		{
			id: 'sales_customers',
			title: 'Kinh doanh & Vé',
			icon: <CreditCard className="h-4 w-4 text-amber-400" />,
			items: [
				{ key: 'transactions', label: 'Hóa đơn & Đơn hàng', icon: <CreditCard className="h-4 w-4 text-amber-400" /> },
				{ key: 'vouchers', label: 'Mã giảm giá (Voucher)', icon: <Percent className="h-4 w-4 text-amber-400" /> },
				{ key: 'ticket-check', label: 'Soát vé xem phim', icon: <ScanLine className="h-4 w-4 text-amber-400" /> },
				{ key: 'users', label: 'Tài khoản Khách hàng', icon: <UsersIcon className="h-4 w-4 text-amber-400" /> }
			]
		},
		{
			id: 'system_management',
			title: 'Quản trị & Nhân sự',
			icon: <Building2 className="h-4 w-4 text-purple-400" />,
			items: [
				{ key: 'branches', label: 'Quản lý Chi nhánh', icon: <Building2 className="h-4 w-4 text-purple-400" /> },
				{ key: 'staff', label: 'Tài khoản Nhân viên', icon: <UsersIcon className="h-4 w-4 text-purple-400" /> },
				{ key: 'roles', label: 'Quyền & Vai trò (RBAC)', icon: <ShieldCheck className="h-4 w-4 text-purple-400" /> },
				{ key: 'audit-logs', label: 'Nhật ký hoạt động', icon: <History className="h-4 w-4 text-purple-400" /> },
				{ key: 'uploads', label: 'Quản lý Media Uploads', icon: <UploadCloud className="h-4 w-4 text-purple-400" /> },
				{ key: 'email-logs', label: 'Nhật ký Email', icon: <Mail className="h-4 w-4 text-purple-400" /> }
			]
		}
	];

	const menuPermissions: Record<string, { module: string; action: string }> = {
		dashboard: { module: 'dashboard', action: 'view' },
		users: { module: 'users', action: 'view' },
		movies: { module: 'movies', action: 'view' },
		showtimes: { module: 'showtimes', action: 'view' },
		toys: { module: 'toys', action: 'view' },
		posts: { module: 'posts', action: 'view' },
		tickets: { module: 'tickets', action: 'view' },
		vouchers: { module: 'vouchers', action: 'view' },
		transactions: { module: 'transactions', action: 'view' },
		'ticket-check': { module: 'ticket_check', action: 'scan' },
		branches: { module: 'branches', action: 'view' },
		staff: { module: 'staff', action: 'view' },
		roles: { module: 'roles', action: 'view' },
		'audit-logs': { module: 'audit_logs', action: 'view' },
		uploads: { module: 'uploads', action: 'view' },
		'email-logs': { module: 'email_logs', action: 'view' },
		settings: { module: 'settings', action: 'view' }
	};

	const hasPermission = (module: string, action: string) => {
		if (isSuperAdmin) return true;
		return permissions.some((p) => p.module === module && p.action === action);
	};

	const [hiddenTabs, setHiddenTabs] = useState<string[] | { hidden_tabs: string[] }>(() => {
		const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed : parsed?.hidden_tabs || [];
	});

	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const group of menuGroups) {
			initial[group.id] = true;
		}
		return initial;
	});

	const toggleGroup = (groupId: string) => {
		setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
	};

	useEffect(() => {
		const handleStorageChange = () => {
			const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
			if (!stored) {
				setHiddenTabs([]);
				return;
			}
			const parsed = JSON.parse(stored);
			setHiddenTabs(Array.isArray(parsed) ? parsed : parsed?.hidden_tabs || []);
		};
		window.addEventListener('storage', handleStorageChange);
		window.addEventListener('admin_sidebar_update', handleStorageChange);

		const isProd = window.location.hostname !== 'localhost';
		if (isProd && hasPermission('settings', 'view')) {
			request<AdminSettingsData>('/api/admin/settings')
				.then((data) => {
					if (data && data.settings) {
						const settings = data.settings;
						const hiddenTabsArray = Array.isArray(settings) ? settings : settings?.hidden_tabs || [];
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

	const filteredGroups = useMemo(() => {
		const hiddenTabsArray = Array.isArray(hiddenTabs) ? hiddenTabs : hiddenTabs?.hidden_tabs || [];
		const query = searchQuery.trim().toLowerCase();

		return menuGroups
			.map((group) => {
				const visibleItems = group.items.filter((item) => {
					const perm = menuPermissions[item.key];
					const hasPerm = perm ? hasPermission(perm.module, perm.action) : true;
					const isNotHidden = !hiddenTabsArray.includes(item.key);
					const matchesSearch = query === '' || item.label.toLowerCase().includes(query) || group.title.toLowerCase().includes(query);
					return hasPerm && isNotHidden && matchesSearch;
				});

				return {
					...group,
					items: visibleItems
				};
			})
			.filter((group) => group.items.length > 0);
	}, [hiddenTabs, permissions, isSuperAdmin, searchQuery]);

	function go(tab: Props['active']) {
		setActive(tab);
		setIsSidebarOpen(false);
		if (tab === 'vouchers') {
			navigate('/vouchers');
		} else if (tab === 'deleted-vouchers') {
			navigate('/deleted/vouchers');
		} else {
			const path = tab === 'ticket-check' ? 'ticket-check' : tab === 'audit-logs' ? 'audit-logs' : tab;
			navigate(`/${path}`);
		}
	}

	const showSidebar = filteredGroups.length > 0 || hasPermission('settings', 'view');
	const layoutClass = showSidebar
		? 'h-screen w-full overflow-hidden flex md:grid md:grid-cols-[260px_1fr] bg-slate-50'
		: 'h-screen w-full overflow-hidden flex flex-col bg-slate-50';

	const currentTabLabel = useMemo(() => {
		if (active === 'settings') return 'Cấu hình Hệ thống';
		if (active === 'profile') return 'Hồ sơ cá nhân';
		for (const group of menuGroups) {
			const item = group.items.find(i => i.key === active);
			if (item) return item.label;
		}
		return 'Admin Dashboard';
	}, [active]);

	return (
		<div className={layoutClass}>
			{isSidebarOpen && (
				<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-all" onClick={() => setIsSidebarOpen(false)} />
			)}

			{showSidebar && (
				<aside
					className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-all duration-300 ease-in-out md:static md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col h-screen select-none shadow-2xl md:shadow-none
      `}
				>
					<div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
						<div className="flex flex-col mb-6 relative">
							<button
								className="absolute top-0 right-0 p-1 md:hidden text-slate-400 hover:text-white transition-colors"
								onClick={() => setIsSidebarOpen(false)}
							>
								<X className="h-5 w-5" />
							</button>
							<div className="flex items-center gap-3">
								<img src={iconCine} alt="CINESPHERE" className="h-9 w-auto" />
								<div>
									<div className="font-black tracking-widest text-sm text-white">CINESPHERE</div>
									<div className="text-[10px] font-medium text-emerald-400/90 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
										Workspace
									</div>
								</div>
							</div>
						</div>

						<div className="mb-6">
							<div className="relative group">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
								<input
									type="search"
									name="admin_sidebar_search_query"
									id="admin_sidebar_search_query"
									placeholder="Tìm kiếm..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									autoComplete="off"
									className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-blue-500/50 transition-all [&::-webkit-search-cancel-button]:hidden"
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								)}
							</div>
						</div>

						<div className="space-y-6">
							{filteredGroups.map((group) => {
								const isOpen = openGroups[group.id] || searchQuery.trim() !== '';
								return (
									<div key={group.id} className="flex flex-col">
										<button
											onClick={() => toggleGroup(group.id)}
											className="w-full flex items-center justify-between px-1 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors group"
										>
											<span className="flex items-center gap-2">
												{group.title}
											</span>
											{isOpen ? (
												<ChevronDown className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-transform" />
											) : (
												<ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition-transform" />
											)}
										</button>

										{isOpen && (
											<div className="space-y-1">
												{group.items.map((item) => {
													const isActive = active === item.key;
													return (
														<button
															key={item.key}
															onClick={() => go(item.key)}
															className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left relative overflow-hidden group ${isActive
																	? 'text-blue-400 bg-blue-500/10'
																	: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
																}`}
														>
															{isActive && (
																<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full" />
															)}
															<span className={`shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>{item.icon}</span>
															<span className="truncate flex-1">{item.label}</span>
														</button>
													);
												})}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>

					<div className="p-4 border-t border-slate-800/80 bg-slate-950 shrink-0">
						{hasPermission('settings', 'view') && (
							<button
								onClick={() => go('settings')}
								className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active === 'settings'
										? 'text-blue-400 bg-blue-500/10'
										: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
									}`}
							>
								<Settings className={`h-4 w-4 ${active === 'settings' ? 'text-blue-400' : 'text-slate-500'}`} />
								<span>Cấu hình Hệ thống</span>
							</button>
						)}
					</div>
				</aside>
			)}

			<main className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
				{/* Desktop Topbar */}
				<header className="hidden md:flex h-16 shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 px-6 items-center justify-between shadow-sm/50">
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2 text-sm text-slate-500">
							<LayoutDashboard className="h-4 w-4" />
							<span className="text-slate-300">/</span>
							<span className="font-semibold text-slate-800">{currentTabLabel}</span>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<div className="h-6 w-px bg-slate-200" />
						<div
							className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 px-2 py-1.5 rounded-xl transition-colors border border-transparent hover:border-slate-200"
							onClick={() => go('profile')}
						>
							<div className="flex flex-col items-end">
								<span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{staffName}</span>
								<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
									{isSuperAdmin ? 'Super Admin' : 'Staff'}
								</span>
							</div>
							<div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-sm font-bold text-white uppercase shadow-md border border-white/20">
								{staffName?.charAt(0) || 'A'}
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleLogout}
							className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
							title="Đăng xuất"
						>
							<LogOut className="h-5 w-5" />
						</Button>
					</div>
				</header>

				{/* Mobile Topbar */}
				<div className="lg:hidden md:hidden shrink-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm/50">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="rounded-xl">
							<Menu className="h-6 w-6 text-slate-700" />
						</Button>
						<span className="font-bold text-slate-800 text-sm">{currentTabLabel}</span>
					</div>
					<div className="flex items-center gap-3">
						<div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm cursor-pointer" onClick={() => go('profile')}>
							{staffName?.charAt(0) || 'A'}
						</div>
					</div>
				</div>

				{/* Main Content Area */}
				<div className="p-4 md:p-8 overflow-y-auto flex-1 bg-slate-50/50">
					<div className="max-w-7xl mx-auto">
						{children}
					</div>
				</div>
			</main>
		</div>
	);
}
