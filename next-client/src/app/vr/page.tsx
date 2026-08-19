'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  getVRPackages,
  createVRBooking,
  createMomoPaymentApi,
  createVnpayPaymentApi,
  API_BASE_URL,
  SERVER_BASE_URL,
  validateVRBooking,
  validateVrVoucher
} from '@/lib/api';
import UserLayout from '@/layouts/UserLayout';
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  ChevronRight,
  X,
  Loader2,
  Minus,
  Plus,
  Ticket,
  Clock,
  Users,
  Tag,
  Gamepad2,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Award,
  Zap
} from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { getCookie } from '@/lib/cookies';
import { Badge } from '@/components/ui/badge';

// Mock specific premium features included in each VR package to present standard templates
const packageHighlights = [
  'Kính thực tế ảo thế hệ mới Ultra HD',
  'Bộ rung phản hồi xúc giác Haptic Vest',
  'Hệ thống âm thanh vòm định vị 3D',
  'Phòng chơi biệt lập chuẩn an toàn',
  'Tặng 01 phần bắp nước ngọt miễn phí',
  'Trợ tá hướng dẫn 1-kèm-1 nhiệt tình'
];

const safetyGuidelines = [
  'Không dành cho người có tiền sử động kinh, cao huyết áp hoặc bệnh tim mạch nặng.',
  'Trẻ em dưới 8 tuổi cần có sự giám hộ của phụ huynh.',
  'Hãy báo ngay cho trợ tá nếu bạn cảm thấy chóng mặt, buồn nôn trong quá trình trải nghiệm.',
  'Luôn tuân thủ giới hạn khu vực chơi để tránh va chạm vật lý ngoài đời thực.'
];

export default function VRShowcasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranch } = useBranch();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherValidating, setVoucherValidating] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'vietqr'>('vietqr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);

  // Modal detail view state
  const [selectedDetailPkg, setSelectedDetailPkg] = useState<any | null>(null);

  // Navigation state (Showcase -> Inline Checkout)
  const [showCheckout, setShowCheckout] = useState(false);

  const urlBranchId = useMemo(() => {
    const raw = searchParams.get('branch_id');
    const parsed = raw ? Number(raw) : null;
    return parsed && Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const activeBranchId = urlBranchId ?? selectedBranch?.id;

  const { data: vrData, isLoading: isLoadingVR } = useQuery({
    queryKey: ['vrPackages', activeBranchId],
    queryFn: ({ signal }) => getVRPackages(activeBranchId ?? undefined, { signal }),
    staleTime: 0
  });

  const vrPackages = useMemo(() => {
    const rawList = Array.isArray(vrData)
      ? vrData
      : Array.isArray(vrData?.items)
      ? vrData.items
      : Array.isArray((vrData as any)?.data)
      ? (vrData as any).data
      : Array.isArray((vrData as any)?.data?.items)
      ? (vrData as any).data.items
      : [];

    return rawList
      .filter((t: any) => t && t.is_active !== false && t.is_active !== 0)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        price: Number(t.price || 0),
        cover_image: t.cover_image,
        duration_min: Number(t.duration_min || 0),
        vr_genre: t.vr_genre,
        min_players: Number(t.min_players || 1),
        max_players: Number(t.max_players || 1),
        type: t.type,
        display_order: t.display_order || 0,
        features: (() => {
          try {
            if (typeof t.features === 'string' && t.features.trim()) {
              const parsed = JSON.parse(t.features);
              if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } else if (Array.isArray(t.features)) {
              return t.features.filter(Boolean);
            }
          } catch {}
          return [];
        })()
      }));
  }, [vrData]);

  const selectedVRItems = useMemo(() => Object.entries(quantities)
    .filter(([_, qty]) => qty > 0)
    .map(([idStr, qty]) => {
      const pkg = vrPackages.find((p: any) => p.id === Number(idStr));
      return pkg ? { vr_package_id: pkg.id, quantity: qty, unit_price: pkg.price, name: pkg.name } : null;
    })
    .filter(Boolean) as any[], [quantities, vrPackages]);

  const subtotal = useMemo(() => selectedVRItems.reduce((sum: number, it: any) => sum + it.unit_price * it.quantity, 0), [selectedVRItems]);
  const totalQuantity = useMemo(() => selectedVRItems.reduce((sum: number, it: any) => sum + it.quantity, 0), [selectedVRItems]);
  const voucherDiscount = Number(appliedVoucher?.discount_amount || 0);
  const finalTotal = Math.max(0, subtotal - voucherDiscount);

  // Autofill user profile
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

  const clearFormError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  useEffect(() => {
    if (phone.length === 10 && phone.startsWith('0') && /^\d+$/.test(phone) && formErrors.phone) clearFormError('phone');
  }, [phone, formErrors.phone]);

  useEffect(() => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && formErrors.email) clearFormError('email');
  }, [email, formErrors.email]);

  const resolveImageUrl = (u: string | undefined | null) => {
    if (!u) return '';
    if (u.startsWith('http')) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${API_BASE_URL}${path}`;
  };

  const handleQtyChange = (id: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleBookNow = (pkg: any) => {
    const params = new URLSearchParams();
    if (selectedBranch?.id) {
      params.set('branch_id', String(selectedBranch.id));
    }
    params.set('vr_package_id', String(pkg.id));
    params.set('qty', '1');
    router.push(`/booking?${params.toString()}`);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (selectedVRItems.length === 0) errors.vr = 'Vui lòng chọn ít nhất 1 gói trải nghiệm VR';
    if (!name.trim()) errors.name = 'Vui lòng nhập họ và tên';
    else if (name.trim().length < 2) errors.name = 'Họ và tên phải có ít nhất 2 ký tự';
    if (!phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (phone.length !== 10) errors.phone = 'Số điện thoại phải có 10 số';
    else if (!phone.startsWith('0')) errors.phone = 'Số điện thoại phải bắt đầu bằng số 0';
    if (!email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không hợp lệ';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyVoucher = async () => {
    const code = voucherCode.trim();
    if (!code) {
      toast.error('Vui lòng nhập mã giảm giá');
      return;
    }
    if (selectedVRItems.length === 0) {
      toast.error('Vui lòng chọn gói VR trước khi áp mã');
      return;
    }
    try {
      setVoucherValidating(true);
      const res = await validateVrVoucher({
        code,
        vr_items: selectedVRItems.map((it) => ({ vr_package_id: it.vr_package_id, quantity: it.quantity })),
        branch_id: selectedBranch?.id
      });
      if (res?.valid) {
        setAppliedVoucher(res);
        toast.success('Áp mã thành công', { description: `Tiết kiệm ${new Intl.NumberFormat('en-US').format(Number(res.discount_amount || 0))}₫` });
      } else {
        setAppliedVoucher(null);
        toast.error('Mã không hợp lệ', { description: res?.message || 'Vui lòng kiểm tra lại mã' });
      }
    } catch (err: any) {
      setAppliedVoucher(null);
      toast.error('Mã không hợp lệ', { description: err?.message || 'Vui lòng kiểm tra lại mã' });
    } finally {
      setVoucherValidating(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    toast.info('Đã bỏ mã giảm giá');
  };

  const handleCreateAndPay = () => {
    if (isProcessing) return;
    if (!confirmChecked) {
      toast.error('Vui lòng xác nhận thông tin', { description: 'Hãy tick vào ô xác nhận trước khi thanh toán' });
      return;
    }
    if (!validateForm()) {
      toast.error('Vui lòng kiểm tra lại thông tin', { description: Object.values(formErrors)[0] });
      return;
    }
    setShowPaymentConfirmDialog(true);
  };

  const performBooking = async () => {
    try {
      setIsProcessing(true);
      const timestampSeconds = Math.floor(Date.now() / 1000);
      const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const orderId = `CSVR${String(timestampSeconds).padStart(10, '0')}${randomSuffix}`;

      const payload: any = {
        email,
        emailBook: email,
        phone,
        name,
        vr_items: selectedVRItems.map((it) => ({ vr_package_id: it.vr_package_id, quantity: it.quantity })),
        voucher_code: appliedVoucher ? voucherCode.trim() : undefined,
        branch_id: selectedBranch?.id,
        paymentMethod,
        pay_txt_code: orderId
      };

      const validation = await validateVRBooking(payload);
      if (!validation || validation.status === 400 || validation.status === 'error') {
        throw new Error(validation?.message || 'Không thể xác thực thông tin đặt VR');
      }

      const canonicalTotal = Number(validation.total_price ?? finalTotal);

      const summary = {
        orderId,
        movie: '',
        name,
        phone,
        email,
        emailBook: email,
        quantity: totalQuantity,
        amount: canonicalTotal,
        method: paymentMethod,
        booking_type: 'vr',
        vr_items: selectedVRItems,
        branch_id: selectedBranch?.id,
        branch_name: selectedBranch?.name,
        branch_address: selectedBranch?.address,
        voucher_code: appliedVoucher?.voucher_details?.code || null,
        voucher_discount_amount: voucherDiscount
      };

      const result = await createVRBooking(payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Không thể tạo đơn đặt VR');
      }

      const booking = result.booking;
      localStorage.setItem('pendingOrder', JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }));

      const vrNames = selectedVRItems.map((it) => it.name).join(' + ');
      const orderInfoText = `VR | ${totalQuantity} gói | ${vrNames || 'VR Booking'}`;

      if (paymentMethod === 'vietqr') {
        localStorage.setItem('qrPaymentData', JSON.stringify({
          ...summary,
          booking_id: booking?.id,
          user_id: booking?.user_id,
          totalAmount: canonicalTotal,
          ticketType: 'VR Booking',
          movieTitle: vrNames,
          booking_type: 'vr'
        }));
        localStorage.removeItem('qrPaymentEndTime');
        router.push('/qr-payment');
        return;
      }

      if (paymentMethod === 'momo') {
        const extraDataEncoded = btoa(unescape(encodeURIComponent(JSON.stringify({ ...summary, booking_id: booking?.id, user_id: booking?.user_id }))));
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
        const momoPayload: any = {
          partnerCode, partnerName, storeId, requestId,
          amount: canonicalTotal, orderId, orderInfo: orderInfoText,
          redirectUrl, ipnUrl, lang: 'vi', extraData: extraDataEncoded,
          requestType: 'captureWallet', signature: '', accessKey, secretKey
        };
        const res = await createMomoPaymentApi(momoPayload);
        if (res?.payUrl) {
          window.location.href = res.payUrl;
          return;
        }
        throw new Error('Không nhận được liên kết thanh toán MoMo');
      } else if (paymentMethod === 'vnpay') {
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
      setIsProcessing(false);
      toast.error('Không thể tạo đơn đặt VR', { description: err?.message || 'Đã xảy ra lỗi, vui lòng thử lại' });
    }
  };

  const formatMoney = (n: number) => new Intl.NumberFormat('en-US').format(Number(n || 0));

  return (
    <UserLayout className="bg-[#0f172a] border-none text-white font-sans">
      <section className="relative min-h-screen pt-20 md:pt-24 lg:pt-28 pb-16 overflow-hidden">
        {/* Futuristic glowing gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[5%] left-[5%] w-[45%] h-[45%] bg-purple-600/10 blur-[130px] rounded-full animate-pulse" />
          <div className="absolute bottom-[10%] right-[5%] w-[45%] h-[45%] bg-blue-600/10 blur-[130px] rounded-full animate-pulse" />
        </div>

        <div className="container mx-auto px-4 relative z-10 max-w-6xl">
          {/* Active Navigation Header */}
          <div className="mb-8 flex items-center justify-between">
            {showCheckout ? (
              <button
                onClick={() => setShowCheckout(false)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group text-sm font-semibold"
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                <span>Quay lại Showcase</span>
              </button>
            ) : (
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group text-sm font-semibold"
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                <span>Về trang chủ</span>
              </button>
            )}
            
            <div className="flex items-center gap-2.5">
              <Gamepad2 className="w-7 h-7 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              <h1 className="text-xl md:text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 font-mono">
                CINESPHERE VR LAB
              </h1>
            </div>
          </div>

          {/* MAIN CONDITIONAL LAYOUT */}
          {!showCheckout ? (
            /* --- SHOWCASE MODE --- */
            <div className="space-y-12">
              {/* Showcase Hero */}
              <div className="text-center max-w-3xl mx-auto space-y-4 py-6">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-mono py-1 px-3 mb-2 text-xs uppercase tracking-widest">
                  Trải nghiệm tương lai
                </Badge>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  VƯỢT GIỚI HẠN THỰC TẠI VỚI <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">VIRTUAL REALITY</span>
                </h2>
                <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                  Đắm chìm vào thế giới thực tế ảo đỉnh cao tại CineSphere. Thiết bị tối tân, không gian chuẩn quốc tế, và những tựa game hấp dẫn đang chờ đón bạn.
                </p>
              </div>

              {/* VR Packages Grid */}
              {isLoadingVR ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
                </div>
              ) : vrPackages.length === 0 ? (
                <Card className="bg-white/5 border-white/10 backdrop-blur py-16 text-center">
                  <Gamepad2 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Chưa có gói VR nào được phát hành</h3>
                  <p className="text-slate-400 text-sm">Vui lòng kiểm tra lại chi nhánh hoặc quay lại sau.</p>
                </Card>
              ) : (
                <div className="flex flex-wrap justify-center gap-6">
                  {vrPackages.map((pkg: any) => (
                    <Card
                      key={pkg.id}
                      className="bg-slate-900/40 border border-white/10 backdrop-blur-md overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] transition-all duration-300 group flex flex-col h-full rounded-2xl w-full max-w-sm md:w-[340px]"
                    >
                      {/* Image header with overlay tags */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
                        {pkg.cover_image ? (
                          <img
                            src={resolveImageUrl(pkg.cover_image)}
                            alt={pkg.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <Gamepad2 className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                        
                        {pkg.vr_genre && (
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-purple-500/90 text-white text-[10px] font-bold uppercase tracking-widest shadow-md">
                            {pkg.vr_genre}
                          </span>
                        )}
                        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-purple-300 font-bold bg-black/55 py-1 px-2.5 rounded-lg border border-purple-500/20">
                          <Clock className="w-3.5 h-3.5" /> {pkg.duration_min} Phút
                        </span>
                      </div>

                      {/* Content Card Body */}
                      <CardContent className="p-5 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <h3 className="font-extrabold text-white text-lg tracking-wide line-clamp-1 group-hover:text-purple-300 transition-colors">
                            {pkg.name}
                          </h3>
                          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 min-h-[2.5rem]">
                            {pkg.description || 'Trải nghiệm không gian ảo hóa 3D chân thực cao với trang bị haptic tiên tiến bậc nhất.'}
                          </p>

                          {/* Quick checklist of dynamic premium components */}
                          <div className="space-y-1.5 pt-1.5">
                            {pkg.features && pkg.features.length > 0 ? (
                              pkg.features.slice(0, 2).map((feat: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  <span className="line-clamp-1">{feat}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>Trang bị Kính VR &amp; Haptic Vest cao cấp</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>Phòng chơi rộng rãi dành cho {pkg.min_players}-{pkg.max_players} người</span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Action footer */}
                        <div className="pt-5 mt-4 border-t border-white/5 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Giá vé trọn gói</p>
                            <p className="text-2xl font-black text-white">
                              {formatMoney(pkg.price)}<span className="text-xs ml-1 text-slate-400 font-normal">₫/vé</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setSelectedDetailPkg(pkg)}
                              className="h-10 text-xs px-3.5 border-white/10 hover:bg-white/5 text-slate-300 hover:text-white rounded-xl font-bold"
                            >
                              Chi tiết
                            </Button>
                            <Button
                              onClick={() => handleBookNow(pkg)}
                              className="h-10 text-xs px-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-bold tracking-wide shadow-md shadow-purple-500/20"
                            >
                              Mua vé
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Extra banner: Why choose CineSphere VR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                {[
                  { icon: <Gamepad2 className="w-8 h-8 text-purple-400" />, title: 'Kính VR Siêu Nét', desc: 'Sử dụng hệ máy kính VR tiên tiến nhất với tấm nền hiển thị 4K sắc nét và tốc độ quét cao hạn chế chóng mặt.' },
                  { icon: <Award className="w-8 h-8 text-blue-400" />, title: 'Haptic Feedback', desc: 'Trang bị áo rung haptic toàn thân giúp bạn cảm nhận rõ nét từng va chạm vật lý, tiếng nổ, hay luồng gió.' },
                  { icon: <ShieldAlert className="w-8 h-8 text-pink-400" />, title: 'An Toàn Tuyệt Đối', desc: 'Mỗi buồng chơi riêng biệt rộng rãi đều có thiết lập rào chắn hồng ngoại ảo tránh va đập và hướng dẫn viên trực sẵn.' }
                ].map((item, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-3">
                    <div className="p-2 w-fit rounded-xl bg-white/5 border border-white/10">{item.icon}</div>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">{item.title}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* --- INLINE CHECKOUT MODE --- */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left 2 Cols: Checkout inputs (aligned with colors and font sizes) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Step 1: Quantities Adjuster */}
                <Card className="bg-[#1e293b]/30 border-white/10 backdrop-blur-md rounded-2xl shadow-xl">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-white text-base md:text-lg font-bold">
                      <span className="w-7 h-7 rounded-xl bg-purple-600/90 text-white flex items-center justify-center text-xs font-black shadow-md shadow-purple-500/25">1</span>
                      Số lượng vé đặt
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    {selectedVRItems.map((item) => (
                      <div key={item.vr_package_id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 rounded-xl bg-black/25 border border-white/5">
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatMoney(item.unit_price)}₫/vé</p>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 bg-white/5 rounded-full p-1 border border-white/10 self-end sm:self-auto">
                          <button
                            onClick={() => handleQtyChange(item.vr_package_id, -1)}
                            className="w-8 h-8 rounded-full hover:bg-white/10 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-white text-sm">{item.quantity}</span>
                          <button
                            onClick={() => handleQtyChange(item.vr_package_id, +1)}
                            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-colors shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Step 2: Voucher Code */}
                <Card className="bg-[#1e293b]/30 border-white/10 backdrop-blur-md rounded-2xl shadow-xl">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-white text-base md:text-lg font-bold">
                      <span className="w-7 h-7 rounded-xl bg-purple-600/90 text-white flex items-center justify-center text-xs font-black shadow-md shadow-purple-500/25">2</span>
                      Mã giảm giá
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {appliedVoucher ? (
                      <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                              <Tag className="w-4 h-4 text-emerald-400" />
                              {appliedVoucher?.voucher_details?.code?.toUpperCase() || voucherCode.toUpperCase()}
                              <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-slate-300 font-mono">
                                {appliedVoucher?.voucher_details?.name || ''}
                              </span>
                            </p>
                            <p className="text-xs text-emerald-300 font-bold mt-1">
                              Đã giảm: -{formatMoney(voucherDiscount)}₫
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white hover:bg-white/5"
                          onClick={removeVoucher}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="NHẬP MÃ GIẢM GIÁ (VD: VR20OFF)"
                            value={voucherCode}
                            onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                            className="h-11 bg-black/30 border-white/10 text-white placeholder:text-slate-500 uppercase tracking-widest font-mono font-bold text-sm focus:border-purple-500/50"
                            onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                          />
                        </div>
                        <Button
                          onClick={applyVoucher}
                          disabled={voucherValidating || !voucherCode.trim()}
                          className="h-11 px-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold rounded-xl transition-all shadow-md"
                        >
                          {voucherValidating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          Áp dụng
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Step 3: Customer Information */}
                <Card className="bg-[#1e293b]/30 border-white/10 backdrop-blur-md rounded-2xl shadow-xl">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-white text-base md:text-lg font-bold">
                      <span className="w-7 h-7 rounded-xl bg-purple-600/90 text-white flex items-center justify-center text-xs font-black shadow-md shadow-purple-500/25">3</span>
                      Thông tin khách hàng
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 block">Họ và tên *</Label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`h-11 bg-black/30 border-white/10 text-white focus:border-purple-500/50 text-sm ${formErrors.name ? 'border-red-500' : ''}`}
                          placeholder="Nguyễn Văn A"
                        />
                        {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                      </div>
                      
                      <div>
                        <Label className="text-slate-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 block">Số điện thoại *</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className={`h-11 bg-black/30 border-white/10 text-white focus:border-purple-500/50 text-sm ${formErrors.phone ? 'border-red-500' : ''}`}
                          placeholder="09xxxxxxxx"
                        />
                        {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-slate-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 block">Email nhận vé *</Label>
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value.trim())}
                          className={`h-11 bg-black/30 border-white/10 text-white focus:border-purple-500/50 text-sm ${formErrors.email ? 'border-red-500' : ''}`}
                          placeholder="example@gmail.com"
                        />
                        {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Sticky Summary Panel (aligned with colors and font sizes) */}
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-purple-500/10 via-black/45 to-blue-500/10 border-purple-500/20 backdrop-blur-xl rounded-2xl shadow-2xl sticky top-24">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <h3 className="font-extrabold text-white text-sm uppercase tracking-widest flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-purple-400" />
                      Tóm tắt đơn hàng
                    </h3>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Item list */}
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                      {selectedVRItems.map((it: any) => (
                        <div key={it.vr_package_id} className="flex justify-between text-xs">
                          <div className="flex-1">
                            <p className="text-white font-bold">{it.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {formatMoney(it.unit_price)}₫ × {it.quantity}
                            </p>
                          </div>
                          <p className="font-bold text-white ml-4">{formatMoney(it.unit_price * it.quantity)}₫</p>
                        </div>
                      ))}
                    </div>

                    {/* Price calculations */}
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Tạm tính ({totalQuantity} vé)</span>
                        <span className="text-white font-semibold">{formatMoney(subtotal)}₫</span>
                      </div>
                      
                      {voucherDiscount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Giảm giá ({appliedVoucher?.voucher_details?.code?.toUpperCase()})
                          </span>
                          <span className="text-emerald-400 font-bold">-{formatMoney(voucherDiscount)}₫</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-end pt-3 border-t border-white/10 mt-1">
                        <span className="text-white font-black uppercase tracking-wide text-xs">Tổng cộng</span>
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300">
                          {formatMoney(finalTotal)}<span className="text-sm ml-1 text-slate-300">₫</span>
                        </span>
                      </div>
                    </div>

                    {/* Payment methods list */}
                    <div className="pt-4 border-t border-white/5 space-y-3">
                      <h4 className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        Phương thức thanh toán
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'vietqr', label: 'VietQR', cls: 'from-blue-600 to-cyan-500' },
                          { id: 'momo', label: 'MoMo', cls: 'from-pink-600 to-rose-500' },
                          { id: 'vnpay', label: 'VNPay', cls: 'from-indigo-600 to-blue-500' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setPaymentMethod(m.id as any)}
                            className={`py-2 rounded-xl font-bold text-xs transition-all border-2 ${
                              paymentMethod === m.id
                                ? `bg-gradient-to-br ${m.cls} text-white border-transparent shadow-md scale-[1.02]`
                                : 'bg-black/40 text-slate-400 border-white/10 hover:border-white/20'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Terms agreement checkbox */}
                    <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                      <Checkbox
                        checked={confirmChecked}
                        onCheckedChange={(v) => setConfirmChecked(Boolean(v))}
                        className="mt-0.5 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 border-white/20"
                      />
                      <span className="text-[10px] text-slate-400 leading-relaxed">
                        Tôi xác nhận đã đọc, hiểu và hoàn toàn đồng ý với các <span className="text-purple-300 underline">điều khoản &amp; quy chế</span> sử dụng phòng VR.
                      </span>
                    </label>

                    {/* Submit Pay button */}
                    <Button
                      size="lg"
                      onClick={handleCreateAndPay}
                      disabled={isProcessing || selectedVRItems.length === 0}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 hover:from-purple-600 hover:via-blue-600 hover:to-purple-600 text-white font-black text-sm tracking-widest shadow-md shadow-purple-500/25 disabled:opacity-40 uppercase transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xử lý...
                        </>
                      ) : (
                        <>
                          Xác nhận đặt vé
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* ==================== DIALOG 1: PACKAGE DETAILS MODAL ==================== */}
        <Dialog open={selectedDetailPkg !== null} onOpenChange={(open) => !open && setSelectedDetailPkg(null)}>
          <DialogContent className="bg-[#0f172a] border border-white/10 text-white max-w-xl p-0 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
            {selectedDetailPkg && (
              <div className="flex flex-col">
                {/* Image block header */}
                <div className="relative aspect-video w-full bg-slate-800">
                  {selectedDetailPkg.cover_image ? (
                    <img
                      src={resolveImageUrl(selectedDetailPkg.cover_image)}
                      alt={selectedDetailPkg.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Gamepad2 className="w-16 h-16" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  
                  <div className="absolute bottom-4 left-5 right-5">
                    {selectedDetailPkg.vr_genre && (
                      <Badge className="bg-purple-500 text-white font-bold text-[9px] uppercase tracking-wider mb-1">
                        {selectedDetailPkg.vr_genre}
                      </Badge>
                    )}
                    <h2 className="text-xl md:text-2xl font-black text-white">{selectedDetailPkg.name}</h2>
                  </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[50vh]">
                  {/* Package Metadata Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                      <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Thời lượng</p>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{selectedDetailPkg.duration_min} phút</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                      <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Số lượng chơi</p>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{selectedDetailPkg.min_players}-{selectedDetailPkg.max_players} người</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                      <CreditCard className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Giá trọn gói</p>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">{formatMoney(selectedDetailPkg.price)}₫</p>
                    </div>
                  </div>

                  {/* Main Description */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      Mô tả chi tiết
                    </h4>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {selectedDetailPkg.description || 'Gói dịch vụ mang đến cho bạn và đồng đội thế giới thực tế ảo đỉnh cao đầy ấn tượng, trang bị thiết bị tốt nhất cùng đội ngũ hướng dẫn viên hỗ trợ 100% thời gian chơi.'}
                    </p>
                  </div>

                  {/* Premium Checklist (What's included) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-400" />
                      Dịch vụ bao gồm trong gói
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(selectedDetailPkg.features && selectedDetailPkg.features.length > 0
                        ? selectedDetailPkg.features
                        : packageHighlights
                      ).map((hl: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{hl}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Safety instructions */}
                  <div className="p-3.5 bg-pink-500/5 border border-pink-500/10 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-black uppercase text-pink-400 tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-pink-400 shrink-0" />
                      Hướng dẫn an toàn khi chơi VR
                    </h5>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400 leading-relaxed">
                      {safetyGuidelines.map((gl, idx) => (
                        <li key={idx}>{gl}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer Modal Action bar */}
                <div className="p-4 bg-slate-900 border-t border-white/5 flex items-center justify-between gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedDetailPkg(null)}
                    className="text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl h-10 px-4"
                  >
                    Đóng lại
                  </Button>
                  <Button
                    onClick={() => {
                      const pkg = selectedDetailPkg;
                      setSelectedDetailPkg(null);
                      handleBookNow(pkg);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-xs font-black rounded-xl h-10 px-6 gap-2 shadow-lg shadow-purple-500/20"
                  >
                    Đặt vé ngay
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ==================== DIALOG 2: PAYMENT CONFIRM ALERT ==================== */}
        <AlertDialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
          <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md rounded-2xl shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2.5 text-base md:text-lg font-bold">
                <CreditCard className="w-5 h-5 text-purple-400" />
                Xác nhận thanh toán
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                <div className="space-y-2 mt-3.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Họ và tên người đặt:</span>
                    <span className="text-white font-bold">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số điện thoại liên hệ:</span>
                    <span className="text-white font-bold">{phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tổng số vé đặt:</span>
                    <span className="text-white font-bold">{totalQuantity} vé</span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Giảm giá voucher:</span>
                      <span className="text-emerald-400 font-bold">-{formatMoney(voucherDiscount)}₫</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2.5 border-t border-white/10 mt-1">
                    <span className="text-slate-300 font-black uppercase text-[11px] tracking-wide">Tổng thanh toán</span>
                    <span className="text-xl font-black text-purple-400">{formatMoney(finalTotal)}₫</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 text-right">
                    Cổng thanh toán: <span className="text-white font-semibold uppercase">{paymentMethod}</span>
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-5">
              <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-xs h-9">
                Quay lại
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  setShowPaymentConfirmDialog(false);
                  performBooking();
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold border-0 rounded-xl text-xs h-9 shadow-md shadow-purple-500/25"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                Xác nhận thanh toán
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </UserLayout>
  );
}
