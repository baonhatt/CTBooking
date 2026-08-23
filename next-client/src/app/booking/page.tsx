'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
	getActiveTickets,
	getVRPackages,
	VRPackageItem,
	createBookingApi,
	createMomoPaymentApi,
	createVnpayPaymentApi,
	API_BASE_URL,
	SERVER_BASE_URL,
	validateBookingApi,
	validateVrVoucher,
	validateVRBooking,
	createVRBooking
} from '@/lib/api';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import UserLayout from '@/layouts/UserLayout';
import {
	ArrowLeft,
	ArrowRight,
	CreditCard,
	ChevronRight,
	X,
	Loader2,
	Gamepad2,
	Plus,
	Minus,
	Users,
	Clock,
	Sparkles,
	Film,
	Tag,
	ShoppingCart,
	Trash2,
	Check,
	CheckCircle2,
	ShieldCheck,
	QrCode,
	Info
} from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { getCookie } from '@/lib/cookies';
import { useCart, cartStore } from '@/store/cartStore';

export default function BookingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { selectedBranch } = useBranch();
	const {
		items: allCartItems,
		selectedItems,
		movieItems,
		vrItems,
		movieSubtotal,
		vrSubtotal,
		selectedSubtotal,
		updateQuantity,
		removeItem,
		openCart,
		clearSelected
	} = useCart();

	const [name, setName] = useState<string>('');
	const [phone, setPhone] = useState<string>('');
	const [phoneError, setPhoneError] = useState<string>('');
	const [email, setEmail] = useState<string>('');
	const [emailError, setEmailError] = useState<string>('');
	const [paymentMethod, setPaymentMethod] = useState<'vietqr' | 'momo' | 'vnpay'>('vietqr');
	const [isProcessing, setIsProcessing] = useState(false);
	const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
	const [voucherCode, setVoucherCode] = useState<string>('');
	const [voucherValidating, setVoucherValidating] = useState(false);
	const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
	const [selectedMovieIds, setSelectedMovieIds] = useState<number[]>([]);
	const [confirmChecked, setConfirmChecked] = useState(false);
	const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
	const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);

	// Prefetch target routes
	useEffect(() => {
		router.prefetch('/qr-payment');
		router.prefetch('/checkout');
		router.prefetch('/');
	}, [router]);

	const urlBranchId = useMemo(() => {
		const raw = searchParams.get('branch_id');
		const parsed = raw ? Number(raw) : null;
		return parsed && Number.isFinite(parsed) ? parsed : null;
	}, [searchParams]);

	const activeBranchId = urlBranchId ?? selectedBranch?.id;

	// Fetch Tickets & VR packages
	const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
		queryKey: ['activeTickets', activeBranchId],
		queryFn: ({ signal }) => getActiveTickets(activeBranchId ?? undefined, { signal }),
		staleTime: 60000
	});

	const { data: vrPackagesData, isLoading: isLoadingVrPackages } = useQuery({
		queryKey: ['vrPackages', activeBranchId],
		queryFn: ({ signal }) => getVRPackages(activeBranchId ?? undefined, { signal }),
		staleTime: 60000
	});

	const vrPackages = useMemo(() => {
		const rawList = Array.isArray(vrPackagesData)
			? vrPackagesData
			: Array.isArray(vrPackagesData?.items)
				? vrPackagesData.items
				: Array.isArray((vrPackagesData as any)?.data)
					? (vrPackagesData as any).data
					: Array.isArray((vrPackagesData as any)?.data?.items)
						? (vrPackagesData as any).data.items
						: [];
		return rawList.filter((item: any) => item && item.is_active !== false && item.is_active !== 0);
	}, [vrPackagesData]);

	const ticketPackages = useMemo(() => {
		return (ticketsData?.items || []).map((t: any) => ({
			id: t.id,
			name: t.name,
			description: t.description || '',
			price: Number(t.price || 0),
			features: Array.isArray(t.features) ? t.features : [],
			type: t.type || '',
			display_order: t.display_order || 0,
			movies: t.movies || []
		}));
	}, [ticketsData]);

	// Auto-seed legacy query params into cartStore if cart was empty
	useEffect(() => {
		const vrPkgId = searchParams.get('vr_package_id');
		const qtyParam = Number(searchParams.get('qty') || 1);
		if (vrPkgId && allCartItems.length === 0) {
			const foundVr = vrPackages.find((v: any) => Number(v.id) === Number(vrPkgId));
			if (foundVr) {
				cartStore.addItem({
					packageId: foundVr.id,
					type: 'vr',
					name: foundVr.name,
					price: Number(foundVr.price || 0),
					cover_image: foundVr.cover_image,
					duration_min: foundVr.duration_min,
					vr_genre: foundVr.vr_genre,
					quantity: Math.max(1, qtyParam),
					branchId: activeBranchId,
					selected: true
				});
			}
		}

		try {
			const rawTicket = localStorage.getItem('selectedTicketPackage');
			if (rawTicket && allCartItems.length === 0) {
				const parsed = JSON.parse(rawTicket);
				if (parsed?.id) {
					cartStore.addItem({
						packageId: parsed.id,
						type: 'movie',
						name: parsed.name,
						price: Number(parsed.price || 0),
						cover_image: parsed.cover_image,
						movies: parsed.movies,
						quantity: 1,
						branchId: activeBranchId,
						selected: true
					});
					localStorage.removeItem('selectedTicketPackage');
				}
			}
		} catch { }
	}, [searchParams, vrPackages, allCartItems.length, activeBranchId]);

	// Available movies for selected movie packages
	const availableMovies = useMemo(() => {
		const moviesMap = new Map<number, any>();
		movieItems.forEach((item) => {
			const pkg = ticketPackages.find((p: any) => p.id === item.packageId);
			const list = (pkg?.movies && pkg.movies.length > 0) ? pkg.movies : (item.movies || []);
			list.forEach((m: any) => {
				if (m?.id && !moviesMap.has(m.id)) {
					moviesMap.set(m.id, m);
				}
			});
		});
		return Array.from(moviesMap.values());
	}, [movieItems, ticketPackages]);

	// Auto-select first movie if movies exist and none selected
	useEffect(() => {
		if (availableMovies.length > 0 && selectedMovieIds.length === 0) {
			setSelectedMovieIds([availableMovies[0].id]);
		}
	}, [availableMovies, selectedMovieIds.length]);

	const selectedMovie = useMemo(() => {
		return availableMovies.find((m) => selectedMovieIds.includes(m.id)) || availableMovies[0];
	}, [availableMovies, selectedMovieIds]);

	// Load user profile if saved
	useEffect(() => {
		try {
			const profRaw = getCookie('userProfile') || localStorage.getItem('userProfile');
			if (profRaw) {
				const p = JSON.parse(profRaw);
				if (!email && p?.email) setEmail(p.email);
				if (!name && p?.name) setName(p.name);
				if (!phone && p?.phone) setPhone(p.phone);
			}
		} catch { }
	}, [email, name, phone]);

	// Auto clear form errors
	useEffect(() => {
		if (phone.length === 10 && phone.startsWith('0') && /^\d+$/.test(phone) && formErrors.phone) {
			setFormErrors((prev) => ({ ...prev, phone: '' }));
		}
	}, [phone, formErrors.phone]);

	useEffect(() => {
		if (
			email &&
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
			/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(email) &&
			formErrors.email
		) {
			setFormErrors((prev) => ({ ...prev, email: '' }));
		}
	}, [email, formErrors.email]);

	const resolveImageUrl = (u: string | undefined | null) => {
		if (!u) return '';
		if (u.startsWith('http')) return u;
		const path = u.startsWith('/') ? u : `/${u}`;
		return `${API_BASE_URL}${path}`;
	};

	// Pricing Calculations
	const totalMovieCount = movieItems.reduce((s, i) => s + i.quantity, 0);
	const totalVrCount = vrItems.reduce((s, i) => s + i.quantity, 0);
	const originalTotalPrice = movieSubtotal + vrSubtotal;
	const voucherDiscount = Number(appliedVoucher?.discount_amount || 0);
	const totalPrice = Math.max(0, originalTotalPrice - voucherDiscount);

	// Reset voucher when cart changes
	useEffect(() => {
		setAppliedVoucher(null);
		setVoucherCode('');
	}, [movieSubtotal, vrSubtotal]);

	const applyVoucher = async () => {
		const code = voucherCode.trim();
		if (!code) {
			toast.error('Vui lòng nhập mã giảm giá');
			return;
		}
		try {
			setVoucherValidating(true);
			const vr_items = vrItems.map((i) => ({ vr_package_id: i.packageId, quantity: i.quantity }));
			const booking_type = movieItems.length > 0 && vrItems.length > 0 ? 'all' : (movieItems.length > 0 ? 'movie' : 'vr');

			const res = await validateVrVoucher({
				code,
				vr_items,
				branch_id: selectedBranch?.id,
				booking_type
			});

			if (res?.valid) {
				setAppliedVoucher(res);
				toast.success('Áp mã thành công', {
					description: `Tiết kiệm ${Number(res.discount_amount || 0).toLocaleString('vi-VN')}₫`
				});
			} else {
				setAppliedVoucher(null);
				toast.error('Mã không hợp lệ', {
					description: res?.message || 'Vui lòng kiểm tra lại mã'
				});
			}
		} catch (err: any) {
			setAppliedVoucher(null);
			toast.error('Mã không hợp lệ', {
				description: err?.message || 'Vui lòng kiểm tra lại mã'
			});
		} finally {
			setVoucherValidating(false);
		}
	};

	const validateForm = () => {
		const errors: { [key: string]: string } = {};

		if (selectedItems.length === 0) {
			errors.cart = 'Giỏ hàng của bạn đang trống. Vui lòng chọn ít nhất 1 dịch vụ.';
		}

		if (movieItems.length > 0 && availableMovies.length > 0 && selectedMovieIds.length === 0) {
			errors.movies = 'Vui lòng chọn bộ phim bạn muốn trải nghiệm';
		}

		if (!name.trim()) {
			errors.name = 'Vui lòng nhập họ và tên';
		} else if (name.trim().length < 2) {
			errors.name = 'Họ và tên phải có ít nhất 2 ký tự';
		}

		if (!phone.trim()) {
			errors.phone = 'Vui lòng nhập số điện thoại';
		} else if (phone.length !== 10) {
			errors.phone = 'Số điện thoại phải có 10 số';
		} else if (!phone.startsWith('0')) {
			errors.phone = 'Số điện thoại phải bắt đầu bằng số 0';
		} else if (phoneError) {
			errors.phone = phoneError;
		}

		if (!email.trim()) {
			errors.email = 'Vui lòng nhập email nhận vé';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Email không hợp lệ';
		} else if (!/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(email)) {
			errors.email = 'Vui lòng dùng Gmail, Outlook, Yahoo hoặc iCloud';
		} else if (emailError) {
			errors.email = emailError;
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleCheckoutSubmit = () => {
		if (isProcessing) return;
		if (selectedItems.length === 0) {
			toast.error('Giỏ hàng trống', {
				description: 'Vui lòng chọn dịch vụ trước khi thanh toán'
			});
			return;
		}
		if (!validateForm()) {
			toast.error('Vui lòng hoàn tất thông tin', {
				description: 'Kiểm tra lại các mục báo đỏ trên biểu mẫu'
			});
			return;
		}
		if (!confirmChecked) {
			toast.error('Chưa xác nhận điều khoản', {
				description: 'Vui lòng đánh dấu tick đồng ý điều khoản đặt vé'
			});
			return;
		}

		setShowEmailConfirmDialog(true);
	};

	const performBooking = async () => {
		try {
			setIsProcessing(true);
			const timestampSeconds = Math.floor(Date.now() / 1000);
			const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
			const orderId = `CS${String(timestampSeconds).padStart(10, '0')}${randomSuffix}`;

			const vr_items: VRPackageItem[] = vrItems.map((i) => ({
				vr_package_id: i.packageId,
				quantity: i.quantity
			}));

			const selectedVrList = vr_items.map((it) => {
				const p = vrPackages.find((pkg: any) => Number(pkg.id) === it.vr_package_id);
				return {
					...it,
					package_name: p?.name || 'Gói VR',
					unit_price: Number(p?.price || 0),
					duration_min: p?.duration_min,
					cover_image: p?.cover_image,
					line_total: Number(p?.price || 0) * it.quantity
				};
			});

			let canonicalTotal = totalPrice;
			let booking: any = null;

			// IF ONLY VR
			if (movieItems.length === 0 && vrItems.length > 0) {
				const validation = await validateVRBooking({
					email,
					emailBook: email,
					phone,
					name,
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id,
					paymentMethod
				});

				if (validation?.status && validation.status !== 200) {
					throw new Error(validation?.message || 'Không thể xác thực thông tin đặt vé VR');
				}
				canonicalTotal = Number(validation.total_price ?? totalPrice);

				const res = await createVRBooking({
					email,
					emailBook: email,
					phone,
					name,
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id,
					paymentMethod,
					pay_txt_code: orderId
				});
				if (res?.error || !res?.booking) {
					throw new Error(res?.error || 'Không thể tạo đặt vé VR');
				}
				booking = res.booking;
			} else {
				// HAS MOVIE TICKETS (and optionally VR)
				const mainMoviePkg = movieItems[0];
				const validation = await validateBookingApi({
					email,
					emailBook: email,
					phone,
					name,
					movieId: selectedMovie?.id,
					ticketCount: totalMovieCount,
					ticketPackageId: mainMoviePkg.packageId,
					combo: selectedMovieIds.map(String),
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id
				});

				if (!validation?.status) {
					throw new Error(validation?.message || 'Không thể xác thực thông tin đặt vé');
				}
				canonicalTotal = Number(validation.totalPrice ?? totalPrice);

				const res = await createBookingApi({
					email,
					emailBook: email,
					phone,
					name,
					movieId: selectedMovie?.id,
					ticketCount: totalMovieCount,
					paymentMethod,
					totalPrice: canonicalTotal,
					ticketPackageId: mainMoviePkg.packageId,
					pay_txt_code: orderId,
					combo: selectedMovieIds.map(String),
					vr_items,
					voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
					branch_id: selectedBranch?.id
				});
				booking = res.booking;
			}

			const summary = {
				orderId,
				movie: movieItems.length > 0 ? selectedMovie?.title : 'Gói Trải Nghiệm VR',
				name,
				phone,
				email,
				emailBook: email,
				quantity: movieItems.length > 0 ? totalMovieCount : totalVrCount,
				amount: canonicalTotal,
				movieTotalPrice: movieSubtotal,
				vrTotalPrice: vrSubtotal,
				vr_items: selectedVrList,
				booking_type: movieItems.length === 0 ? 'vr' : (vr_items.length > 0 ? 'combo_vr' : 'movie'),
				method: paymentMethod,
				poster: movieItems.length > 0 ? (selectedMovie?.cover_image || '') : (selectedVrList[0]?.cover_image || ''),
				duration: movieItems.length > 0 ? (selectedMovie?.duration_min ? `${selectedMovie.duration_min}` : '') : '',
				genres: movieItems.length > 0 ? (selectedMovie?.genres || '') : '',
				ticketPackageId: movieItems[0]?.packageId,
				ticketPackageName: movieItems.map((m) => `${m.name} x${m.quantity}`).join(', ') || 'Gói VR',
				branch_id: selectedBranch?.id,
				branch_name: selectedBranch?.name,
				voucher_code: appliedVoucher?.voucher_details?.code || null,
				voucher_discount_amount: voucherDiscount
			};

			// Clear purchased items from Cart
			try {
				clearSelected();
			} catch { }

			localStorage.setItem(
				'pendingOrder',
				JSON.stringify({
					...summary,
					booking_id: booking?.id,
					user_id: booking?.user_id
				})
			);

			if (paymentMethod === 'vietqr') {
				localStorage.setItem(
					'qrPaymentData',
					JSON.stringify({
						...summary,
						booking_id: booking?.id,
						user_id: booking?.user_id,
						totalAmount: canonicalTotal,
						movieTitle: summary.movie,
						ticketType: summary.ticketPackageName,
						branch_id: selectedBranch?.id,
						branch_name: selectedBranch?.name,
						branch_settings: selectedBranch?.settings
					})
				);
				localStorage.removeItem('qrPaymentEndTime');
				router.push('/qr-payment');
				return;
			}

			if (paymentMethod === 'momo') {
				const extraDataEncoded = btoa(
					unescape(
						encodeURIComponent(
							JSON.stringify({
								...summary,
								booking_id: booking?.id,
								user_id: booking?.user_id
							})
						)
					)
				);
				const partnerCode = process.env.NEXT_PUBLIC_MOMO_PARTNER_CODE || '';
				const partnerName = process.env.NEXT_PUBLIC_MOMO_PARTNER_NAME || 'CineSphere';
				const storeId = process.env.NEXT_PUBLIC_MOMO_STORE_ID || 'devstore';
				const clientBase = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
				const serverBase = SERVER_BASE_URL || clientBase;
				const redirectPath = process.env.NEXT_PUBLIC_MOMO_REDIRECT_URL || '/checkout';
				const ipnPath = process.env.NEXT_PUBLIC_MOMO_IPN_URL || '/api/momo/ipn';
				const redirectUrl = `${clientBase}${redirectPath}`;
				const ipnUrl = `${serverBase}${ipnPath}`;
				const accessKey = process.env.NEXT_PUBLIC_MOMO_ACCESS_KEY || '';
				const secretKey = process.env.NEXT_PUBLIC_MOMO_SECRET_KEY || '';
				const requestId = Date.now().toString();
				const payload: any = {
					partnerCode,
					partnerName,
					storeId,
					requestId,
					amount: canonicalTotal,
					orderId,
					orderInfo: `${summary.movie} | ${summary.quantity} vé`,
					redirectUrl,
					ipnUrl,
					lang: 'vi',
					extraData: extraDataEncoded,
					requestType: 'captureWallet',
					signature: '',
					accessKey,
					secretKey
				};

				const res = await createMomoPaymentApi(payload);
				if (res?.payUrl) {
					window.location.href = res.payUrl;
					return;
				}
				throw new Error('Không nhận được liên kết thanh toán MoMo');
			}

			if (paymentMethod === 'vnpay') {
				const clientBaseForVnp = process.env.NEXT_PUBLIC_CLIENT_BASE_URL || window.location.origin;
				const returnPathForVnp = process.env.NEXT_PUBLIC_VNPAY_RETURN_URL || '/checkout';
				const returnUrl = `${clientBaseForVnp}${returnPathForVnp}`;
				const res = await createVnpayPaymentApi({
					amount: canonicalTotal,
					orderId,
					orderInfo: String(booking?.id || orderId),
					locale: 'vn',
					returnUrl
				});
				if (res?.payUrl) {
					window.location.href = res.payUrl;
					return;
				}
				throw new Error('Không nhận được liên kết thanh toán VNPay');
			}
		} catch (err: any) {
			console.error('Booking failed:', err);
			toast.error('Đặt vé thất bại', {
				description: err?.message || 'Có lỗi xảy ra trong quá trình xử lý đơn hàng'
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const isLoadingPage = isLoadingTickets || isLoadingVrPackages;

	return (
		<UserLayout>
			<div className="min-h-screen bg-[#070b14] relative overflow-hidden text-slate-100 selection:bg-cyan-500/30">
				{/* Ambient Background Lights */}
				<div className="absolute inset-0 pointer-events-none overflow-hidden">
					<div className="hidden sm:block absolute top-10 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
					<div className="hidden sm:block absolute top-[500px] right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-[160px]" />
					<div className="hidden sm:block absolute top-[1200px] right-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-[130px]" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
					<div className="absolute inset-0 neon-noise opacity-20" />
				</div>

				<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-28 sm:pb-20">
					{/* Breadcrumb Navigation */}
					<div className="text-xs sm:text-sm pt-2 pb-6 flex items-center gap-2 text-slate-400">
						<button onClick={() => router.push('/')} className="hover:text-cyan-400 transition-colors">
							Trang chủ
						</button>
						<ChevronRight className="w-3.5 h-3.5 opacity-50" />
						<button onClick={openCart} className="hover:text-cyan-400 transition-colors">
							Giỏ hàng ({selectedItems.length})
						</button>
						<ChevronRight className="w-3.5 h-3.5 opacity-50" />
						<span className="text-cyan-300 font-semibold">Xác nhận &amp; Thanh toán</span>
					</div>

					{/* Header Title Bar */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
						<div>
							<div className="flex items-center gap-3">
								<span className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
									<ShoppingCart className="w-6 h-6" />
								</span>
								<div>
									<h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide flex items-center gap-2.5 flex-wrap">
										Xác Nhận Đơn Hàng
										<span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
											{selectedItems.length} dịch vụ đã chọn
										</span>
									</h1>
									<p className="text-xs sm:text-sm text-slate-400 mt-1">
										Chi nhánh:{' '}
										<span className="text-cyan-300 font-semibold">
											{selectedBranch?.name || 'CineSphere Mega Mall'}
										</span>
									</p>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Button
								variant="outline"
								onClick={openCart}
								className="h-10 text-xs px-4 border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold flex items-center gap-2"
							>
								<ShoppingCart className="w-4 h-4 text-cyan-400" />
								<span>Chỉnh sửa giỏ hàng</span>
							</Button>
						</div>
					</div>

					{isLoadingPage ? (
						<Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-white p-8 text-center rounded-2xl">
							<div className="flex flex-col items-center justify-center gap-3">
								<div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
								<p className="text-sm font-semibold text-slate-300">Đang chuẩn bị dữ liệu thanh toán...</p>
							</div>
						</Card>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
							{/* ================= LEFT COLUMN: SELECTED ITEMS & MOVIES (7 cols) ================= */}
							<div className="lg:col-span-7 space-y-6">
								{/* 1. ORDER ITEMS LIST CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5 sm:px-6">
										<div className="text-base sm:text-lg font-bold text-white flex items-center justify-between">
											<h2 className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-white">
												<span className="w-1.5 h-6 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
												<span>Chi Tiết Dịch Vụ Đã Chọn</span>
											</h2>
											<span className="text-xs text-slate-400 font-normal">
												Tổng {selectedItems.reduce((s, i) => s + i.quantity, 0)} vé/gói
											</span>
										</div>
									</CardHeader>

									<CardContent className="p-5 sm:p-6 space-y-4">
										{selectedItems.length === 0 ? (
											<div className="py-12 px-4 text-center space-y-4 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
												<div className="p-4 w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center">
													<ShoppingCart className="w-8 h-8 opacity-60" />
												</div>
												<div>
													<h4 className="font-bold text-white text-base">Giỏ hàng của bạn đang trống</h4>
													<p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
														Vui lòng chọn gói vé xem phim 8K hoặc gói trải nghiệm VR từ trang chủ để tiếp tục đặt vé.
													</p>
												</div>
												<div className="flex items-center justify-center gap-3 pt-2">
													<Button
														onClick={() => router.push('/')}
														className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs h-10 px-5 rounded-xl"
													>
														Khám phá gói vé
													</Button>
													<Button
														variant="outline"
														onClick={openCart}
														className="border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs h-10 px-5 rounded-xl font-bold"
													>
														Mở giỏ hàng
													</Button>
												</div>
											</div>
										) : (
											<div className="divide-y divide-white/10 space-y-4">
												{selectedItems.map((item) => {
													const lineTotal = item.price * item.quantity;
													const isMovie = item.type === 'movie';

													return (
														<div key={item.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
															{/* Item Left: Image & Details */}
															<div className="flex items-center gap-3.5 min-w-0 flex-1">
																<div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative bg-slate-950 border border-white/10 flex items-center justify-center shadow-md">
																	{item.cover_image ? (
																		<img
																			src={optimizeCloudinaryUrl(item.cover_image, 160)}
																			alt={item.name}
																			className="w-full h-full object-cover"
																			onError={(e) => {
																				(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
																			}}
																		/>
																	) : (
																		<div
																			className={`w-full h-full flex items-center justify-center ${isMovie
																				? 'bg-gradient-to-br from-blue-900/60 to-cyan-900/60 text-cyan-400'
																				: 'bg-gradient-to-br from-purple-900/60 to-pink-900/60 text-purple-400'
																				}`}
																		>
																			{isMovie ? <Film className="w-7 h-7" /> : <Gamepad2 className="w-7 h-7" />}
																		</div>
																	)}
																	{item.duration_min && (
																		<span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-[9px] font-bold text-white px-1 py-0.2 rounded">
																			{item.duration_min}'
																		</span>
																	)}
																</div>

																<div className="min-w-0 space-y-1">
																	<div className="flex items-center gap-2 flex-wrap">
																		<h4 className="font-extrabold text-white text-sm sm:text-base leading-snug">
																			{item.name}
																		</h4>
																		<span
																			className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isMovie
																				? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
																				: 'bg-purple-500/15 border-purple-500/30 text-purple-300'
																				}`}
																		>
																			{isMovie ? 'Vé Xem Phim 8K' : item.vr_genre || 'Gói VR'}
																		</span>
																	</div>
																	<p className="text-xs text-slate-400 flex items-center gap-2">
																		<span>Đơn giá: {item.price.toLocaleString('vi-VN')}₫</span>
																	</p>
																</div>
															</div>

															{/* Item Right: Quantity & Line Price */}
															<div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
																{/* Quantity Controls */}
																<div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
																	<button
																		type="button"
																		onClick={() => updateQuantity(item.id, item.quantity - 1)}
																		className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30"
																		disabled={item.quantity <= 1}
																		title="Giảm số lượng"
																	>
																		<Minus className="w-3.5 h-3.5" />
																	</button>
																	<span className="w-8 text-center text-xs font-black text-white">
																		{item.quantity}
																	</span>
																	<button
																		type="button"
																		onClick={() => updateQuantity(item.id, item.quantity + 1)}
																		className="w-7 h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 flex items-center justify-center transition-colors shadow-xs"
																		title="Tăng số lượng"
																	>
																		<Plus className="w-3.5 h-3.5" />
																	</button>
																</div>

																{/* Total Line Money */}
																<div className="text-right min-w-[100px]">
																	<p className="text-sm sm:text-base font-black text-white">
																		{lineTotal.toLocaleString('vi-VN')}₫
																	</p>
																</div>

																{/* Trash Button */}
																<button
																	type="button"
																	onClick={() => removeItem(item.id)}
																	className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
																	title="Xóa mục này"
																>
																	<Trash2 className="w-4 h-4" />
																</button>
															</div>
														</div>
													);
												})}
											</div>
										)}
									</CardContent>
								</Card>

								{/* 2. CHỌN PHIM TRẢI NGHIỆM (Chỉ hiện khi trong giỏ có gói vé xem phim) */}
								{movieItems.length > 0 && (
									<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
										<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5 sm:px-6">
											<CardTitle className="text-base sm:text-lg font-bold text-white flex items-center justify-between">
												<div className="flex items-center gap-2.5">
													<span className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-cyan-500 rounded-full" />
													<span>Chọn Phim Áp Dụng Cho Suất Xem</span>
												</div>
												<span className="text-xs text-cyan-400 font-semibold">
													{availableMovies.length} phim khả dụng
												</span>
											</CardTitle>
										</CardHeader>

										<CardContent className="p-5 sm:p-6 space-y-4">
											{availableMovies.length > 0 ? (
												<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
													{availableMovies.map((m: any) => {
														const isSelected = selectedMovieIds.includes(m.id);

														return (
															<div
																key={m.id}
																onClick={() => {
																	setSelectedMovieIds([m.id]);
																	if (formErrors.movies) {
																		setFormErrors((prev) => ({ ...prev, movies: '' }));
																	}
																}}
																className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 shadow-md ${isSelected
																	? 'ring-2 ring-cyan-400 border-2 border-cyan-400 bg-cyan-500/15 scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)]'
																	: 'border border-white/10 bg-white/5 hover:border-cyan-400/50 hover:bg-white/10'
																	}`}
															>
																<div className="aspect-[2/3] relative overflow-hidden bg-slate-950">
																	<img
																		src={optimizeCloudinaryUrl(m.cover_image, 300)}
																		alt={m.title}
																		loading="lazy"
																		className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
																		onError={(e) => {
																			(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
																		}}
																	/>

																	{/* Checkmark Tag */}
																	{isSelected && (
																		<div className="absolute top-2 right-2 z-10 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg text-black">
																			<Check className="w-3.5 h-3.5 stroke-[3]" />
																		</div>
																	)}

																	<div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-90" />

																	<div className="absolute bottom-0 p-2.5 w-full space-y-1">
																		<p className="text-xs font-black text-white leading-tight line-clamp-1 group-hover:text-cyan-300 transition-colors">
																			{m.title}
																		</p>
																		<div className="flex items-center gap-1.5">
																			<span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[9px] text-cyan-300 font-bold border border-cyan-500/30">
																				{m.duration_min ? `${m.duration_min} Phút` : '8K'}
																			</span>
																			{m.genres && (
																				<span className="text-[9px] text-slate-400 truncate">
																					{m.genres}
																				</span>
																			)}
																		</div>
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-slate-400 text-xs">
													Đang cập nhật danh sách phim cho gói vé này
												</div>
											)}

											{formErrors.movies && (
												<p className="text-orange-400 text-xs mt-1 animate-pulse flex items-center gap-1.5">
													<Info className="w-3.5 h-3.5" />
													{formErrors.movies}
												</p>
											)}
										</CardContent>
									</Card>
								)}

								{/* 3. SAFETY / CONVENIENCE NOTES */}
								<div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md space-y-2.5">
									<h4 className="text-slate-300 font-bold text-xs sm:text-sm flex items-center gap-2">
										<ShieldCheck className="w-4 h-4 text-cyan-400" />
										Lưu ý dành cho khách trải nghiệm:
									</h4>
									<ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400 list-inside list-disc">
										<li>Vui lòng có mặt trước giờ chiếu 10-15 phút.</li>
										<li>Xuất trình mã QR tại quầy tiếp tân để nhận vé cứng.</li>
										<li>Phòng chiếu trang bị hệ thống âm thanh vòm &amp; Hologram 8K.</li>
										<li>Vé điện tử đã thanh toán không hoàn trả hoặc hủy vé.</li>
									</ul>
								</div>
							</div>

							{/* ================= RIGHT COLUMN: CUSTOMER, PAYMENT & SUMMARY (5 cols) ================= */}
							<div className="lg:col-span-5 space-y-6">
								{/* 1. CUSTOMER INFO CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full" />
											<span>Thông Tin Nhận Vé</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-4">
										{/* Họ tên */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Họ và Tên <span className="text-cyan-400">*</span>
											</Label>
											<Input
												value={name}
												onChange={(e) => {
													setName(e.target.value);
													if (formErrors.name && e.target.value.trim().length >= 2) {
														setFormErrors((prev) => ({ ...prev, name: '' }));
													}
												}}
												placeholder="Ví dụ: Nguyễn Văn A"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${formErrors.name ? 'border-orange-500/50' : ''
													}`}
											/>
											{formErrors.name && (
												<p className="text-orange-400 text-[11px] animate-pulse">{formErrors.name}</p>
											)}
										</div>

										{/* SĐT */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Số Điện Thoại <span className="text-cyan-400">*</span>
											</Label>
											<Input
												value={phone}
												maxLength={10}
												inputMode="numeric"
												onChange={(e) => {
													const val = e.target.value;
													if (!/^\d*$/.test(val)) return;
													setPhone(val);
													if (val && !val.startsWith('0')) {
														setPhoneError('Số điện thoại phải bắt đầu bằng số 0');
													} else {
														setPhoneError('');
													}
												}}
												placeholder="VD: 0912345678"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${phoneError || formErrors.phone ? 'border-orange-500/50' : ''
													}`}
											/>
											{(phoneError || formErrors.phone) && (
												<p className="text-orange-400 text-[11px] animate-pulse">
													{phoneError || formErrors.phone}
												</p>
											)}
										</div>

										{/* Email */}
										<div className="space-y-1.5">
											<Label className="text-xs font-semibold text-slate-300">
												Email Nhận Mã QR Vé <span className="text-cyan-400">*</span>
											</Label>
											<Input
												type="email"
												value={email}
												onChange={(e) => {
													const val = e.target.value;
													setEmail(val);
													if (!val) {
														setEmailError('');
													} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
														setEmailError('Email không đúng định dạng');
													} else if (
														!/@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com)$/i.test(val)
													) {
														setEmailError('Vui lòng dùng Gmail, Outlook, Yahoo hoặc iCloud');
													} else {
														setEmailError('');
													}
												}}
												placeholder="you@email.com"
												className={`h-11 bg-white/5 border-white/10 focus:border-cyan-400 text-sm rounded-xl ${emailError || formErrors.email ? 'border-orange-500/50' : ''
													}`}
											/>
											{(emailError || formErrors.email) && (
												<p className="text-orange-400 text-[11px] animate-pulse">
													{emailError || formErrors.email}
												</p>
											)}
										</div>
									</CardContent>
								</Card>

								{/* 2. VOUCHER & PAYMENT METHOD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
											<span>Ưu Đãi &amp; Thanh Toán</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-5">
										{/* Voucher */}
										<div className="space-y-2">
											<Label className="text-xs font-semibold text-slate-300">Mã Giảm Giá (Voucher)</Label>
											{appliedVoucher ? (
												<div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
													<div className="flex items-center gap-2.5 min-w-0">
														<div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
															<Tag className="w-4 h-4" />
														</div>
														<div className="min-w-0">
															<p className="font-bold text-white truncate">
																{appliedVoucher?.voucher_details?.code?.toUpperCase() || voucherCode.toUpperCase()}
															</p>
															<p className="text-[11px] text-emerald-300 font-bold">
																Đã giảm: -{voucherDiscount.toLocaleString('vi-VN')}₫
															</p>
														</div>
													</div>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
														onClick={() => {
															setAppliedVoucher(null);
															setVoucherCode('');
															toast.info('Đã hủy áp dụng mã giảm giá');
														}}
													>
														<X className="w-4 h-4" />
													</Button>
												</div>
											) : (
												<div className="flex gap-2">
													<Input
														type="text"
														placeholder="NHẬP MÃ GIẢM GIÁ"
														value={voucherCode}
														onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
														onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
														className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 uppercase font-mono font-bold text-xs rounded-xl"
													/>
													<Button
														type="button"
														onClick={applyVoucher}
														disabled={voucherValidating || !voucherCode.trim()}
														className="h-11 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shrink-0 transition-all duration-300"
													>
														{voucherValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
														Áp dụng
													</Button>
												</div>
											)}
										</div>

										{/* Payment Gateway Choices */}
										<div className="space-y-2.5 pt-2 border-t border-white/5">
											<Label className="text-xs font-semibold text-slate-300">Phương Thức Thanh Toán</Label>
											<div className="grid grid-cols-1 gap-2.5">
												{/* VietQR */}
												<button
													type="button"
													onClick={() => setPaymentMethod('vietqr')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${paymentMethod === 'vietqr'
														? 'bg-red-500/15 border-red-500/60 ring-1 ring-red-500/30 text-white'
														: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
														}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xs shadow-md">
															<QrCode className="w-5 h-5" />
														</div>
														<div>
															<p className="font-bold text-sm text-white">Chuyển khoản VietQR</p>
															<p className="text-[11px] text-slate-400">Quét mã QR tự động 24/7 (Khuyên dùng)</p>
														</div>
													</div>
													{paymentMethod === 'vietqr' && (
														<span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button>

												{/* MoMo */}
												{/* <button
													type="button"
													onClick={() => setPaymentMethod('momo')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
														paymentMethod === 'momo'
															? 'bg-pink-500/15 border-pink-500/60 ring-1 ring-pink-500/30 text-white'
															: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
													}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-[#a50064] text-white flex items-center justify-center font-black text-xs shadow-md">
															M
														</div>
														<div>
															<p className="font-bold text-sm text-white">Ví điện tử MoMo</p>
															<p className="text-[11px] text-slate-400">Thanh toán tức thì qua ứng dụng MoMo</p>
														</div>
													</div>
													{paymentMethod === 'momo' && (
														<span className="w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button> */}

												{/* VNPay */}
												{/* <button
													type="button"
													onClick={() => setPaymentMethod('vnpay')}
													className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all ${
														paymentMethod === 'vnpay'
															? 'bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/30 text-white'
															: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
													}`}
												>
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-xl bg-[#005baa] text-white flex items-center justify-center font-black text-xs shadow-md">
															VNP
														</div>
														<div>
															<p className="font-bold text-sm text-white">Cổng thanh toán VNPAY</p>
															<p className="text-[11px] text-slate-400">Thẻ ATM nội địa, Visa, MasterCard</p>
														</div>
													</div>
													{paymentMethod === 'vnpay' && (
														<span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
															✓
														</span>
													)}
												</button> */}
											</div>
										</div>
									</CardContent>
								</Card>

								{/* 3. ORDER SUMMARY CARD */}
								<Card className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
									<CardHeader className="bg-white/[0.03] border-b border-white/10 py-4 px-5">
										<CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
											<span className="w-1.5 h-5 bg-gradient-to-b from-cyan-400 to-emerald-400 rounded-full" />
											<span>Tóm Tắt Thanh Toán</span>
										</CardTitle>
									</CardHeader>

									<CardContent className="p-5 space-y-3.5 text-xs sm:text-sm">
										{/* Movie Subtotal */}
										{movieSubtotal > 0 && (
											<div className="flex justify-between items-center text-slate-300">
												<span className="flex items-center gap-1.5">
													<Film className="w-3.5 h-3.5 text-cyan-400" />
													Vé xem phim 8K ({totalMovieCount} vé)
												</span>
												<span className="font-semibold text-white">
													{movieSubtotal.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* VR Subtotal */}
										{vrSubtotal > 0 && (
											<div className="flex justify-between items-center text-slate-300">
												<span className="flex items-center gap-1.5">
													<Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
													Gói trải nghiệm VR ({totalVrCount} lượt)
												</span>
												<span className="font-semibold text-white">
													{vrSubtotal.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* Voucher Discount */}
										{voucherDiscount > 0 && (
											<div className="flex justify-between items-center text-emerald-400 pt-2 border-t border-white/5">
												<span className="flex items-center gap-1.5 font-semibold">
													<Tag className="w-3.5 h-3.5" />
													Giảm giá Voucher ({appliedVoucher?.voucher_details?.code?.toUpperCase()})
												</span>
												<span className="font-bold">
													-{voucherDiscount.toLocaleString('vi-VN')}₫
												</span>
											</div>
										)}

										{/* Total Final Price */}
										<div className="pt-3 border-t border-white/10 flex justify-between items-end">
											<div>
												<p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
													Tổng thanh toán
												</p>
												<p className="text-[11px] text-slate-500">Đã bao gồm VAT &amp; dịch vụ</p>
											</div>
											<div className="text-right">
												<p className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(6,182,212,0.35)]">
													{totalPrice.toLocaleString('vi-VN')}₫
												</p>
											</div>
										</div>

										{/* Terms Agreement Checkbox */}
										<div className="pt-4 border-t border-white/5">
											<div className="flex items-start gap-2.5">
												<Checkbox
													id="agree-terms"
													checked={confirmChecked}
													onCheckedChange={(c) => setConfirmChecked(c === true)}
													className="mt-0.5 border-white/30 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
												/>
												<label
													htmlFor="agree-terms"
													className="text-[11px] leading-relaxed text-slate-400 cursor-pointer select-none"
												>
													Tôi đã kiểm tra kỹ thông tin đơn hàng và đồng ý với điều khoản đặt vé của CineSphere.
												</label>
											</div>
										</div>

										{/* Action Submit Button */}
										<div className="pt-2">
											<Button
												type="button"
												disabled={isProcessing || selectedItems.length === 0}
												onClick={handleCheckoutSubmit}
												className="w-full h-14 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-black font-extrabold text-base rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
											>
												{isProcessing ? (
													<span className="flex items-center justify-center gap-2 text-white">
														<Loader2 className="w-5 h-5 animate-spin" />
														<span>Đang khởi tạo đơn hàng...</span>
													</span>
												) : (
													<span className="flex items-center justify-center gap-2">
														<span>Xác Nhận &amp; Thanh Toán</span>
														<ArrowRight className="w-5 h-5" />
													</span>
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					)}
				</div>

				{/* Sticky Bottom Action Bar on Mobile */}
				{selectedItems.length > 0 && (
					<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 shadow-2xl">
						<div className="flex items-center justify-between gap-4">
							<div className="min-w-0">
								<p className="text-[10px] text-slate-400 uppercase font-bold truncate">
									Tổng ({selectedItems.reduce((s, i) => s + i.quantity, 0)} mục)
								</p>
								<p className="text-lg font-black text-cyan-300 leading-tight">
									{totalPrice.toLocaleString('vi-VN')}₫
								</p>
							</div>
							<Button
								type="button"
								disabled={isProcessing}
								onClick={handleCheckoutSubmit}
								className="px-6 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-sm rounded-xl shadow-lg active:scale-95 transition-all"
							>
								Thanh toán
							</Button>
						</div>
					</div>
				)}

				{/* EMAIL CONFIRMATION MODAL */}
				<AlertDialog open={showEmailConfirmDialog} onOpenChange={setShowEmailConfirmDialog}>
					<AlertDialogContent className="bg-slate-900 border border-white/15 text-white max-w-md rounded-2xl p-6">
						<AlertDialogHeader>
							<AlertDialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
								<CheckCircle2 className="w-5 h-5 text-cyan-400" />
								Kiểm tra thông tin nhận vé
							</AlertDialogTitle>
							<AlertDialogDescription className="text-slate-300 text-xs leading-relaxed space-y-3 pt-2">
								<p>
									Mã QR vé điện tử và hướng dẫn check-in sẽ được gửi trực tiếp tới email của bạn:
								</p>
								<div className="p-3 rounded-xl bg-white/5 border border-white/10 font-bold text-cyan-300 text-sm break-all text-center">
									{email}
								</div>
								<p className="text-[11px] text-slate-400">
									Vui lòng đảm bảo email trên là chính xác để không bỏ lỡ mã vé.
								</p>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter className="flex gap-2 pt-3">
							<AlertDialogCancel
								onClick={() => setShowEmailConfirmDialog(false)}
								className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl font-bold h-10 px-4"
							>
								Đổi email khác
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									setShowEmailConfirmDialog(false);
									performBooking();
								}}
								className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs rounded-xl h-10 px-5"
							>
								Đúng, tiến hành thanh toán
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</UserLayout>
	);
}
