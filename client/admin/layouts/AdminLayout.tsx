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
			title: 'Vận hành Rạp & Phim',
			icon: <Clapperboard className="h-4 w-4 text-emerald-400" />,
			items: [
				{ key: 'movies', label: 'Danh sách Phim', icon: <Clapperboard className="h-4 w-4 text-emerald-400" /> },
				{ key: 'showtimes', label: 'Lịch chiếu phim', icon: <CalendarClock className="h-4 w-4 text-emerald-400" /> },
				{ key: 'tickets', label: 'Gói vé xem phim & VR', icon: <TicketIcon className="h-4 w-4 text-emerald-400" /> },
				{ key: 'toys', label: 'Đồ chơi & quà tặng', icon: <Package className="h-4 w-4 text-emerald-400" /> },
				{ key: 'posts', label: 'Bài viết & Bảng tin', icon: <FileText className="h-4 w-4 text-emerald-400" /> }
			]
		},
		{
			id: 'sales_customers',
			title: 'Kinh doanh & Khách hàng',
			icon: <CreditCard className="h-4 w-4 text-amber-400" />,
			items: [
				{ key: 'transactions', label: 'Giao dịch vé', icon: <CreditCard className="h-4 w-4 text-amber-400" /> },
				{ key: 'vouchers', label: 'Mã Giảm Giá (Vouchers)', icon: <Percent className="h-4 w-4 text-amber-400" /> },
				{ key: 'ticket-check', label: 'Kiểm Tra Vé (Soát vé)', icon: <ScanLine className="h-4 w-4 text-amber-400" /> },
				{ key: 'users', label: 'Tài khoản Khách hàng', icon: <UsersIcon className="h-4 w-4 text-amber-400" /> }
			]
		},
		{
			id: 'system_management',
			title: 'Quản trị Systems & Nhân sự',
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
			initial[group.id] = group.items.some((item) => item.key === active);
		}
		return initial;
	});

	useEffect(() => {
		for (const group of menuGroups) {
			if (group.items.some((item) => item.key === active)) {
				setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
				break;
			}
		}
	}, [active]);

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
		? 'min-h-screen flex md:grid md:grid-cols-[280px_1fr] flex-col md:flex-row relative'
		: 'min-h-screen flex flex-col relative';

	return (
		<div className={layoutClass}>
			{isSidebarOpen && (
				<div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
			)}

			{showSidebar && (
				<aside
					className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        bg-gradient-to-b from-[#0a1530] via-[#0e1b3d] to-[#14284d] border-r border-white/10 p-3 text-white flex flex-col justify-between h-screen overflow-y-auto select-none
      `}
				>
					<div>
						<div className="flex flex-col mb-3 px-2 gap-1 relative pt-1">
							<button
								className="absolute top-1 right-1 p-1 md:hidden text-white/70 hover:text-white"
								onClick={() => setIsSidebarOpen(false)}
							>
								<X className="h-5 w-5" />
							</button>
							<div className="flex items-center gap-3">
								<img src={iconCine} alt="CINESPHERE" className="h-9 w-auto" />
								<div>
									<div className="font-black tracking-widest text-sm text-blue-100">CINESPHERE</div>
									<div className="text-[10px] font-semibold text-blue-400/90 uppercase tracking-wider">Management Portal</div>
								</div>
							</div>
							<div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md py-1 px-2.5 mb-1 mt-2 flex items-center gap-1.5 w-fit" title={staffEmail}>
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
								{isSuperAdmin ? '⚡ SUPER ADMIN' : ' STAFF'} • {staffName}
							</div>
						</div>

						<div className="px-2 mb-3">
							<div className="relative">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
								<input
									type="text"
									placeholder="Tìm kiếm danh mục..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
								/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className="absolute right-2 top-2 text-white/40 hover:text-white text-xs"
									>
										×
									</button>
								)}
							</div>
						</div>

						<div className="space-y-2 px-1">
							{filteredGroups.map((group) => {
								const isOpen = openGroups[group.id] || searchQuery.trim() !== '';
								const hasActiveChild = group.items.some((item) => item.key === active);

								return (
									<div key={group.id} className="rounded-lg overflow-hidden border border-white/5 bg-white/[0.02]">
										<button
											onClick={() => toggleGroup(group.id)}
											className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${hasActiveChild
													? 'text-blue-300 bg-white/5'
													: 'text-white/70 hover:text-white hover:bg-white/5'
												}`}
										>
											<div className="flex items-center gap-2 truncate">
												{isOpen ? <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <Folder className="h-3.5 w-3.5 text-white/40 shrink-0" />}
												<span className="truncate">{group.title}</span>
											</div>
											<div className="flex items-center gap-1.5 shrink-0">
												<span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full font-mono text-white/60">
													{group.items.length}
												</span>
												{isOpen ? (
													<ChevronDown className="h-3.5 w-3.5 text-white/60 transition-transform duration-200" />
												) : (
													<ChevronRight className="h-3.5 w-3.5 text-white/40 transition-transform duration-200" />
												)}
											</div>
										</button>

										{isOpen && (
											<div className="ml-3 pl-2.5 border-l border-white/10 my-1 py-1 space-y-0.5 pr-2">
												{group.items.map((item) => {
													const isActive = active === item.key;
													return (
														<button
															key={item.key}
															onClick={() => go(item.key)}
															className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-all duration-200 text-left ${isActive
																	? 'bg-blue-600/30 text-white border-l-2 border-blue-400 shadow-sm font-semibold pl-2'
																	: 'text-white/75 hover:text-white hover:bg-white/10'
																}`}
														>
															<span className="shrink-0">{item.icon}</span>
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

					<div className="space-y-1.5 mt-auto pt-3 border-t border-white/10 px-1">
						<button
							onClick={() => go('profile')}
							className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${active === 'profile' ? 'bg-blue-600/30 text-white font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'
								}`}
						>
							<User className="h-4 w-4 text-blue-400 shrink-0" />
							<span>Hồ sơ & Mật khẩu</span>
						</button>

						{hasPermission('settings', 'view') && (
							<button
								onClick={() => go('settings')}
								className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all ${active === 'settings' ? 'bg-blue-600/30 text-white font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'
									}`}
							>
								<Settings className="h-4 w-4 text-amber-400 shrink-0" />
								<span>Cấu hình Hệ thống</span>
							</button>
						)}

						<div
							onClick={() => go('profile')}
							className="px-2.5 py-2 flex items-center gap-2 text-white/80 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all border border-white/5 mt-1"
							title="Bấm để xem hồ sơ và đổi mật khẩu"
						>
							<div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow shrink-0">
								{staffName?.charAt(0) || 'A'}
							</div>
							<div className="flex flex-col min-w-0 flex-1">
								<span className="text-xs font-semibold text-white truncate">{staffName}</span>
								<span className="text-[10px] text-white/60 truncate">{staffEmail}</span>
							</div>
						</div>

						<Button
							variant="destructive"
							onClick={handleLogout}
							className="w-full justify-start gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all duration-200 rounded-md px-3 h-9 text-xs font-semibold mt-1"
						>
							<LogOut className="h-3.5 w-3.5" /> Đăng xuất
						</Button>
					</div>
				</aside>
			)}

			<main className="flex-1 bg-[#f8fafc] md:overflow-y-auto h-screen flex flex-col">
				<div className="lg:hidden md:hidden w-full bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
							<Menu className="h-6 w-6 text-gray-700" />
						</Button>
						<span className="font-bold text-gray-800">Admin Dashboard</span>
					</div>
					<img src={iconCine} alt="Logo" className="h-8 w-auto filter invert brightness-0" />
				</div>

				<div className="p-4 md:p-6 overflow-y-auto flex-1">{children}</div>
			</main>
		</div>
	);
}
