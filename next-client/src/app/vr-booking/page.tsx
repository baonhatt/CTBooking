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
import { optimizeCloudinaryUrl } from '@/lib/utils';
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
  Sparkles
} from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { getCookie } from '@/lib/cookies';

export default function VRBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranch } = useBranch();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherValidating, setVoucherValidating] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'vietqr'>('vietqr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);

  const { data: vrData, isLoading: isLoadingVR } = useQuery({
    queryKey: ['vrPackages', selectedBranch?.id],
    queryFn: ({ signal }) => getVRPackages(selectedBranch?.id, { signal }),
    staleTime: 0
  });

  const vrPackages = useMemo(() => (vrData?.items || []).map((t: any) => ({
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
    display_order: t.display_order || 0
  })), [vrData]);

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
    <UserLayout className="bg-[#0f172a] border-none">
      <section className="relative min-h-screen pt-16 md:pt-20 lg:pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        </div>

        <div className="container mx-auto px-4 relative z-10 max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Về trang chủ</span>
            </button>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-purple-400" />
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">ĐẶT TRẢI NGHIỆM VR</h1>
            </div>
          </div>

          {isLoadingVR ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            </div>
          ) : vrPackages.length === 0 ? (
            <Card className="bg-white/5 border-white/10 backdrop-blur">
              <CardContent className="py-20 text-center">
                <Gamepad2 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Chưa có gói VR nào</h3>
                <p className="text-slate-400">Vui lòng quay lại sau hoặc chọn chi nhánh khác.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Bước 1: Chọn gói VR */}
              <Card className="bg-white/5 border-white/10 backdrop-blur mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <span className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-black">1</span>
                    Chọn gói trải nghiệm VR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vrPackages.map((pkg: any) => {
                      const qty = quantities[pkg.id] || 0;
                      return (
                        <Card
                          key={pkg.id}
                          className={`bg-black/30 border-2 overflow-hidden transition-all ${qty > 0 ? 'border-purple-500 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]' : 'border-white/10 hover:border-white/20'}`}
                        >
                          <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
                            {pkg.cover_image ? (
                              <img
                                src={resolveImageUrl(pkg.cover_image)}
                                alt={pkg.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <Gamepad2 className="w-12 h-12" />
                              </div>
                            )}
                            {pkg.vr_genre && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-500/90 text-white text-[10px] font-bold uppercase tracking-wide">
                                {pkg.vr_genre}
                              </span>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-bold text-white text-base mb-2 line-clamp-1">{pkg.name}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                              {pkg.duration_min > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> {pkg.duration_min} phút
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" /> {pkg.min_players}-{pkg.max_players} người
                              </span>
                            </div>
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Giá</p>
                                <p className="text-xl font-black text-white">
                                  {formatMoney(pkg.price)}<span className="text-sm ml-1 text-slate-400">₫</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                                <button
                                  onClick={() => handleQtyChange(pkg.id, -1)}
                                  className="w-8 h-8 rounded-full hover:bg-white/10 text-white flex items-center justify-center disabled:opacity-40"
                                  disabled={qty <= 0}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-bold text-white text-sm">{qty}</span>
                                <button
                                  onClick={() => handleQtyChange(pkg.id, +1)}
                                  className="w-8 h-8 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Bước 2: Voucher */}
              <Card className="bg-white/5 border-white/10 backdrop-blur mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <span className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-black">2</span>
                    Mã giảm giá (nếu có)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm flex items-center gap-2">
                            <Tag className="w-4 h-4 text-emerald-400" />
                            {appliedVoucher?.voucher_details?.code?.toUpperCase() || voucherCode.toUpperCase()}
                            <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-slate-300">
                              {appliedVoucher?.voucher_details?.name || ''}
                            </span>
                          </p>
                          <p className="text-xs text-emerald-300 font-semibold mt-0.5">Tiết kiệm: {formatMoney(voucherDiscount)}₫</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10" onClick={removeVoucher}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="Nhập mã giảm giá (VD: VR20OFF)"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                          className="h-11 bg-black/30 border-white/10 text-white placeholder:text-slate-500 uppercase tracking-wider font-semibold"
                          onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                        />
                      </div>
                      <Button
                        onClick={applyVoucher}
                        disabled={voucherValidating || !voucherCode.trim()}
                        className="h-11 px-6 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold"
                      >
                        {voucherValidating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Áp dụng
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bước 3: Thông tin khách hàng */}
              <Card className="bg-white/5 border-white/10 backdrop-blur mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <span className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-black">3</span>
                    Thông tin khách hàng
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide mb-1.5 block">Họ và tên</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`h-11 bg-black/30 border-white/10 text-white ${formErrors.name ? 'border-red-500' : ''}`}
                        placeholder="Nguyễn Văn A"
                      />
                      {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide mb-1.5 block">Số điện thoại</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className={`h-11 bg-black/30 border-white/10 text-white ${formErrors.phone ? 'border-red-500' : ''}`}
                        placeholder="09xxxxxxxx"
                      />
                      {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-wide mb-1.5 block">Email</Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        className={`h-11 bg-black/30 border-white/10 text-white ${formErrors.email ? 'border-red-500' : ''}`}
                        placeholder="example@gmail.com"
                      />
                      {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tổng kết + Thanh toán */}
              <Card className="bg-gradient-to-br from-purple-500/10 via-black/40 to-blue-500/10 border-purple-500/20 backdrop-blur-xl sticky bottom-4 z-20 shadow-2xl">
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-3">
                      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-purple-400" />
                        Tóm tắt đơn hàng
                      </h3>
                      {selectedVRItems.length === 0 ? (
                        <p className="text-slate-500 text-sm italic py-4 text-center">Chưa chọn gói VR nào</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {selectedVRItems.map((it: any) => (
                            <div key={it.vr_package_id} className="flex items-center justify-between text-sm">
                              <div className="flex-1">
                                <p className="text-white font-semibold">{it.name}</p>
                                <p className="text-xs text-slate-400">
                                  {formatMoney(it.unit_price)}₫ × {it.quantity}
                                </p>
                              </div>
                              <p className="font-bold text-white ml-4">{formatMoney(it.unit_price * it.quantity)}₫</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-3 border-t border-white/10 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Tạm tính ({totalQuantity} gói)</span>
                          <span className="text-white font-semibold">{formatMoney(subtotal)}₫</span>
                        </div>
                        {voucherDiscount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-emerald-400 font-semibold">Giảm giá ({appliedVoucher?.voucher_details?.code?.toUpperCase()})</span>
                            <span className="text-emerald-400 font-bold">-{formatMoney(voucherDiscount)}₫</span>
                          </div>
                        )}
                        <div className="flex justify-between items-end pt-2 mt-2 border-t border-white/5">
                          <span className="text-white font-black uppercase tracking-wide text-sm">Tổng cộng</span>
                          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300">
                            {formatMoney(finalTotal)}<span className="text-lg ml-1 text-slate-300">₫</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div>
                        <h3 className="font-black text-white text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          Phương thức thanh toán
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'vietqr', label: 'VietQR', cls: 'from-blue-500 to-cyan-500' },
                            { id: 'momo', label: 'MoMo', cls: 'from-pink-500 to-rose-500' },
                            { id: 'vnpay', label: 'VNPay', cls: 'from-indigo-500 to-blue-500' }
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setPaymentMethod(m.id as any)}
                              className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                paymentMethod === m.id
                                  ? `bg-gradient-to-br ${m.cls} text-white border-transparent shadow-lg scale-[1.02]`
                                  : 'bg-black/30 text-slate-300 border-white/10 hover:border-white/30'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <Checkbox checked={confirmChecked} onCheckedChange={(v) => setConfirmChecked(Boolean(v))} className="mt-0.5 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500" />
                        <span className="text-xs text-slate-400 leading-relaxed">
                          Tôi đã đọc và đồng ý với <span className="text-purple-300 underline">điều khoản sử dụng</span>. Thông tin đặt vé sẽ được gửi qua email.
                        </span>
                      </label>

                      <Button
                        size="lg"
                        onClick={handleCreateAndPay}
                        disabled={isProcessing || selectedVRItems.length === 0}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-blue-500 to-purple-600 hover:from-purple-700 hover:via-blue-600 hover:to-purple-700 text-white font-black text-base tracking-wide shadow-[0_8px_30px_rgba(147,51,234,0.35)] disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang xử lý...
                          </>
                        ) : (
                          <>
                            Tiến hành thanh toán
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Payment confirm dialog */}
        <AlertDialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
          <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" />
                Xác nhận thanh toán
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tổng số gói VR:</span>
                    <span className="text-white font-bold">{totalQuantity}</span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Đã giảm:</span>
                      <span className="text-emerald-400 font-bold">-{formatMoney(voucherDiscount)}₫</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-slate-300 font-bold uppercase">Thành tiền</span>
                    <span className="text-2xl font-black text-purple-300">{formatMoney(finalTotal)}₫</span>
                  </div>
                  <p className="text-xs text-slate-500 pt-2">Phương thức: <span className="text-white font-semibold uppercase">{paymentMethod}</span></p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Quay lại</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  setShowPaymentConfirmDialog(false);
                  performBooking();
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold border-0"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Xác nhận & Thanh toán
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </UserLayout>
  );
}
