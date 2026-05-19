'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import UserLayout from '@/layouts/UserLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle2, Clock, Copy, Lock, Mars, ShieldCheck, User, Venus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { updateUserProfileApi, changePasswordApi, getUserTransactionsApi, getUserProfileByEmailApi } from '@/lib/api';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';

export default function Account() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    name: string;
    phone: string;
    email: string;
    gender?: string;
    dob?: string;
  }>({ name: '', phone: '', email: '', gender: '', dob: '' });
  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState<'history' | 'info'>('history');
  const pageSize = 5;
  const [detailCountdown, setDetailCountdown] = useState<string | null>(null);
  const PAYMENT_METHODS_DISPLAY: Record<string, string> = {
    momo: 'Ví MoMo',
    vnpay: 'VNPay',
    vietqr: 'Chuyển khoản VietQR',
    card: 'Thẻ ngân hàng'
  };

  const getMovieCountFromCombo = (comboStr: string) => {
    try {
      if (!comboStr) return 0;
      const comboArray = JSON.parse(comboStr);
      return Array.isArray(comboArray) ? comboArray.length : 0;
    } catch (error) {
      console.error('Lỗi parse combo:', error);
      return 0;
    }
  };
  const handleCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.success('Đã sao chép nội dung: ' + text);
    } catch (err) {
      console.error('Lỗi copy:', err);
    }
  };

  const parseData = (data: any) => {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return [];
    }
  };

  const formatDateTime = (dateStr: any) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year} ${hour}:${min}`;
    } catch {
      return String(dateStr);
    }
  };

  useEffect(() => {
    const authRaw = localStorage.getItem('authUser');
    if (!authRaw) {
      toast.error('Vui lòng đăng nhập trước!');
      window.dispatchEvent(new Event('open-login'));
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userProfile');
      const authRaw = localStorage.getItem('authUser');
      let email = '';
      let name = '';
      let phone = '';
      let gender = '';
      let dob = '';
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          email = parsed?.user?.email || parsed?.email || email;
          name = parsed?.user?.username || parsed?.username || name;
          phone = (parsed?.user as any)?.phone || phone;
        } catch {}
      }
      if (raw) {
        try {
          const p = JSON.parse(raw);
          email = p?.email || email;
          name = p?.name || name;
          phone = p?.phone || phone;
          gender = p?.gender || gender;
          dob = p?.dob || dob;
        } catch {}
      }
      setProfile({
        name: name || '',
        phone: phone || '',
        email: email || '',
        gender: gender || '',
        dob: dob || ''
      });
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const email = profile.email;
        if (!email) return;
        const data = await getUserProfileByEmailApi(email);
        const dobStr = (() => {
          try {
            if (!data?.dob) return '';
            const d = new Date(data.dob as any);
            if (isNaN(d.getTime())) return String(data.dob);
            return d.toISOString().slice(0, 10);
          } catch {
            return '';
          }
        })();
        setProfile((p) => ({
          ...p,
          name: data?.fullname || p.name || '',
          phone: data?.phone || p.phone || '',
          email: data?.email || p.email || '',
          gender: (data?.gender as any) || p.gender || '',
          dob: dobStr || p.dob || ''
        }));
      } catch (e: any) {
        // silent
      }
    })();
  }, [profile.email]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingTx(true);
        const email = profile.email;
        if (!email) return;
        const { items } = await getUserTransactionsApi({
          email,
          status: 'paid'
        });
        const mapped =
          (items || []).map((t: any) => ({
            ...t,
            poster: t?.poster || t?.cover_image || t?.coverImage || t?.poster_url,
            date: (() => {
              try {
                const src = t?.paid_at || t?.created_at;
                return src ? new Date(src) : null;
              } catch {
                return null;
              }
            })(),
            dateDisplay: (() => {
              try {
                const dsrc = t?.paid_at || t?.created_at;
                if (!dsrc) return '';
                const d = new Date(dsrc);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
              } catch {
                return '';
              }
            })(),
            isExpired: (() => {
              try {
                if (!t.expiry_date) return false;
                return new Date(t.expiry_date).getTime() < Date.now();
              } catch {
                return false;
              }
            })(),
            remainingTimeLabel: (() => {
              try {
                if (!t.expiry_date || t.is_used || t.payment_status !== 'paid') return null;
                const expiry = new Date(t.expiry_date).getTime();
                const now = Date.now();
                const diff = expiry - now;
                if (diff <= 0) return 'Đã hết hạn';

                const dayMs = 24 * 60 * 60 * 1000;
                const hourMs = 60 * 60 * 1000;
                const minMs = 60 * 1000;

                if (diff >= dayMs) {
                  return `(còn ${Math.ceil(diff / dayMs)} ngày)`;
                } else if (diff >= hourMs) {
                  return `(còn ${Math.floor(diff / hourMs)} giờ)`;
                } else {
                  return `(còn ${Math.max(1, Math.floor(diff / minMs))} phút)`;
                }
              } catch {
                return null;
              }
            })()
          })) || [];
        mapped.sort((a: any, b: any) => {
          const tA = a.date ? a.date.getTime() : 0;
          const tB = b.date ? b.date.getTime() : 0;
          return tB - tA;
        });
        setTransactions(mapped);
      } catch (e: any) {
        console.error(e);
      } finally {
        setIsLoadingTx(false);
      }
    })();
  }, [profile.email]);

  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  useEffect(() => {
    const readHash = () => {
      const hash = (window.location.hash || '').replace('#', '').toLowerCase();
      if (hash === 'profile' || hash === 'info') setTab('info');
      else if (hash === 'transaction' || hash === 'history') setTab('history');
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  useEffect(() => {
    if (!isDetailOpen) {
      setDetailCountdown(null);
      return;
    }
    const expirySrc = selectedTx?.expiry_date;
    const expired = Boolean(selectedTx?.expired);
    const isUsed = Boolean(selectedTx?.is_used);
    if (!expirySrc || expired || isUsed) {
      setDetailCountdown(null);
      return;
    }
    let expiry = 0;
    try {
      expiry = new Date(expirySrc as any).getTime();
    } catch {
      expiry = 0;
    }
    if (!expiry) {
      setDetailCountdown(null);
      return;
    }
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, expiry - now);
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setDetailCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isDetailOpen, selectedTx?.expiry_date, selectedTx?.expired, selectedTx?.is_used]);

  const handleTabChange = (val: string) => {
    const value = val === 'info' ? 'info' : 'history';
    setTab(value);
    const targetHash = value === 'info' ? '#profile' : '#transaction';
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  };

  const limitedTransactions = useMemo(() => {
    return (transactions || []).slice(0, 20);
  }, [transactions]);

  const pagedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return limitedTransactions.slice(start, start + pageSize);
  }, [limitedTransactions, currentPage]);

  const totalPages = useMemo(() => {
    const total = Math.ceil(limitedTransactions.length / pageSize);
    return total || 1;
  }, [limitedTransactions]);

  const groups = useMemo(() => {
    const toMonthKey = (t: any) => {
      try {
        const src = t?.paid_at || t?.created_at;
        if (!src) return 'Khác';
        const d = new Date(src);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `Tháng ${mm}/${yyyy}`;
      } catch {
        return 'Khác';
      }
    };
    const map = new Map<string, any[]>();
    pagedTransactions?.forEach((t) => {
      const key = toMonthKey(t);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    const arr = Array.from(map.entries()).map(([month, items]) => ({
      month,
      items
    }));
    return arr.sort((a, b) => {
      try {
        const parseDate = (str: string) => {
          if (str === 'Khác') return 0;
          const [_, datePart] = str.split(' ');
          const [month, year] = datePart.split('/');
          return new Date(Number(year), Number(month) - 1).getTime();
        };
        return parseDate(b.month) - parseDate(a.month);
      } catch {
        return 0;
      }
    });
  }, [pagedTransactions]);

  const getBookingCode = (tx: any | null) =>
    tx?.booking_code || tx?.bookingCode || tx?.code || tx?.bookingCodeEmail || '--';

  const formatMoney = (value: number | string | undefined) => {
    const num = Number(value || 0);
    return num.toLocaleString('vi-VN');
  };

  const getPoster = (tx: any | null) =>
    tx?.cover_image || tx?.coverImage || tx?.poster || tx?.poster_url || tx?.thumbnail || tx?.image || '';

  const handleSaveProfile = async () => {
    try {
      await updateUserProfileApi({
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        gender: profile.gender,
        dob: profile.dob
      });
      const p = {
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        gender: profile.gender,
        dob: profile.dob
      };
      localStorage.setItem('userProfile', JSON.stringify(p));
      const authRaw = localStorage.getItem('authUser');
      if (authRaw) {
        try {
          const parsed = JSON.parse(authRaw);
          if (parsed?.user) {
            parsed.user.username = profile.name || parsed.user.username;
            (parsed.user as any).phone = profile.phone || (parsed.user as any).phone;
          }
          localStorage.setItem('authUser', JSON.stringify(parsed));
        } catch {}
      }
      window.dispatchEvent(new Event('user-auth-changed'));
      toast.success('Cập nhật thành công');
    } catch (e: any) {
      toast.error('Cập nhật thất bại', { description: e?.message || '' });
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPwd || newPwd !== confirmPwd) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    try {
      await changePasswordApi({
        email: profile.email,
        oldPassword: oldPwd,
        newPassword: newPwd
      });
      toast.success('Đã cập nhật mật khẩu');
      setIsPwdOpen(false);
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e: any) {
      toast.error('Đổi mật khẩu thất bại', { description: e?.message || '' });
    }
  };

  return (
    <UserLayout
      className="bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d]"
      hideFooter
    >
      <div className="relative min-h-screen">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.35),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.25),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.3),transparent_30%)]" />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: `rgba(0,0,0,${Number(process.env.NEXT_PUBLIC_BACKDROP_DARK_BASE ?? 0.5)})`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
          <div className="absolute inset-0 neon-noise opacity-25" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-16 md:pt-24">
          <div className="flex items-center my-5 gap-2 text-sm text-gray-300 mb-4">
            <Link href="/" className="text-blue-300 hover:text-blue-200">
              Home
            </Link>
            <span className="text-gray-400">›</span>
            <span className="text-white font-medium">Tài Khoản</span>
          </div>
          <Card className="w-full bg-[rgba(11,29,58,0.85)] border border-white/10 text-white shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-blue-400">Tài Khoản</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="bg-white/5 border border-white/10 rounded-full px-1">
                  <TabsTrigger
                    className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                    value="history"
                  >
                    Lịch Sử Giao Dịch
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white rounded-full"
                    value="info"
                  >
                    Thông Tin Cá Nhân
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-6 outline-none">
                  <div className="space-y-8 bg-[#1e2536]/50 p-6 rounded-2xl border border-white/5">
                    {/* Section 1: Thông tin cá nhân */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <User size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Thông tin cá nhân</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-400 ml-1">Họ và tên</Label>
                          <Input
                            className="h-11 bg-[#0f172a] border-white/10 text-white focus:border-blue-500/50 transition-all"
                            value={profile.name}
                            onChange={(e) =>
                              setProfile((p) => ({
                                ...p,
                                name: e.target.value
                              }))
                            }
                            placeholder="Nhập họ và tên"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-400 ml-1">Ngày sinh</Label>
                          <DatePicker
                            value={profile.dob ? dayjs(profile.dob) : null}
                            onChange={(date) =>
                              setProfile((p) => ({
                                ...p,
                                dob: date ? date.format('YYYY-MM-DD') : ''
                              }))
                            }
                            format="DD/MM/YYYY"
                            placeholder="Chọn ngày sinh"
                            className="w-full h-11 bg-[#0f172a] border-white/10 hover:border-blue-500/50"
                            style={{
                              backgroundColor: '#0f172a',
                              color: '#ffffff'
                            }}
                            styles={{
                              input: {
                                color: '#ffffff'
                              }
                            }}
                            suffixIcon={<Calendar size={16} className="text-gray-400" />}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-400 ml-1">Giới tính</Label>
                          <div className="flex gap-4">
                            {['male', 'female'].map((gender) => (
                              <button
                                key={gender}
                                onClick={() => setProfile((p) => ({ ...p, gender }))}
                                className={`flex-1 h-11 rounded-md border transition-all flex items-center justify-center gap-2 text-sm ${
                                  profile.gender === gender
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                    : 'bg-[#0f172a] border-white/10 text-gray-400 hover:border-white/20'
                                }`}
                              >
                                {gender === 'male' ? <Mars size={16} /> : <Venus size={16} />}
                                {gender === 'male' ? 'Nam' : 'Nữ'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Liên hệ & Bảo mật */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                        <ShieldCheck size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tài khoản & Bảo mật</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 group">
                          <Label className="text-xs font-semibold text-gray-400 ml-1">Email (Định danh)</Label>
                          <div className="relative">
                            <Input
                              className="h-11 bg-white/5 border-white/5 text-gray-500 cursor-not-allowed pr-10"
                              value={profile.email}
                              readOnly
                            />
                            <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-400 ml-1">Số điện thoại</Label>
                          <Input
                            className="h-11 bg-[#0f172a] border-white/10 text-white"
                            value={profile.phone}
                            onChange={(e) =>
                              setProfile((p) => ({
                                ...p,
                                phone: e.target.value
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-white/5">
                      <Button
                        onClick={handleSaveProfile}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-10 h-11 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                      >
                        Lưu thay đổi
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-6 outline-none">
                  {isLoadingTx ? (
                    <div className="flex items-center gap-3 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-8 justify-center">
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Đang tải lịch sử giao dịch...
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="text-sm text-gray-400">Chưa có giao dịch nào</div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-400 italic">
                          * Chỉ hiển thị {limitedTransactions.length} giao dịch gần nhất
                          <br />* Các giao dịch chờ thanh toán sẽ tự động bị xóa sau 3 giờ nếu chưa hoàn tất
                        </div>
                      </div>

                      {groups.map((g, idx) => (
                        <div key={idx} className="space-y-4">
                          {/* Nhãn tháng */}
                          <div className="flex items-center gap-4">
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                            <span className="text-sm text-blue-300 font-bold uppercase tracking-widest px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                              {g.month}
                            </span>
                            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                          </div>

                          <div className="grid gap-4">
                            {g.items.map((t: any, i: number) => {
                              const movieCount = getMovieCountFromCombo(t.combo);
                              const isVietQR = t.method?.toLowerCase() === 'vietqr';
                              const isPaid = t.payment_status === 'paid';

                              return (
                                <div
                                  key={i}
                                  className="group relative w-full rounded-2xl bg-[#1e2536] border border-white/10 p-5 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300"
                                >
                                  {/* Thanh chỉ thị trạng thái mỏng ở cạnh trái */}
                                  {!isPaid && (
                                    <div className="absolute top-4 left-0 w-1 h-12 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                  )}

                                  <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                          <h3 className="text-lg font-bold text-white">
                                            {t.ticket_package || 'Vé đơn'}
                                          </h3>
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase tracking-wider">
                                            {t.method}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                          <span className="flex items-center gap-1.5">
                                            <Calendar size={12} />
                                            {formatDateTime(t.created_at)}
                                          </span>
                                          <span className="opacity-30">|</span>
                                          <span className="text-gray-300 font-medium bg-white/5 px-2 py-0.5 rounded">
                                            {movieCount} phim
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm">
                                          {t.is_used ? (
                                            <span className="text-gray-500 font-medium flex items-center gap-2 px-2 py-1 bg-gray-500/5 rounded-lg border border-gray-500/10">
                                              <CheckCircle2 size={14} /> Đã sử dụng
                                            </span>
                                          ) : t.isExpired ? (
                                            <span className="text-rose-400 font-medium flex items-center gap-2 px-2 py-1 bg-rose-400/5 rounded-lg border border-rose-400/20">
                                              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                              Đã hết hạn
                                            </span>
                                          ) : isPaid ? (
                                            <span
                                              className="text-emerald-400 font-medium flex items-center gap-2 px-2 py-1 bg-emerald-400/5 rounded-lg border border-emerald-400/20 cursor-help"
                                              title={t.expiry_date ? `Hết hạn: ${formatDateTime(t.expiry_date)}` : ''}
                                            >
                                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                              Sẵn sàng sử dụng {t.remainingTimeLabel}
                                            </span>
                                          ) : (
                                            <span
                                              className={`px-2 py-1 rounded-lg border flex items-center gap-2 font-medium ${
                                                isVietQR
                                                  ? 'text-blue-400 bg-blue-400/5 border-blue-400/20'
                                                  : 'text-amber-500 bg-amber-500/5 border-amber-500/20'
                                              }`}
                                            >
                                              <Clock size={14} className={isVietQR ? 'animate-spin-slow' : ''} />
                                              {isVietQR ? 'Đang chờ xác nhận...' : 'Chờ thanh toán'}
                                            </span>
                                          )}
                                        </div>

                                        {isVietQR && !isPaid && t.pay_txt_code && (
                                          <div
                                            onClick={() => handleCopy(t.pay_txt_code)}
                                            className="flex items-center justify-between max-w-[300px] bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 cursor-pointer hover:border-blue-500/30 hover:bg-black/40 transition-all group/copy"
                                          >
                                            <div className="flex flex-col">
                                              <span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">
                                                Nội dung chuyển khoản
                                              </span>
                                              <span className="text-sm font-mono font-bold text-blue-300 tracking-[0.2em]">
                                                {t.pay_txt_code}
                                              </span>
                                            </div>
                                            <Copy
                                              size={16}
                                              className="text-gray-600 group-hover/copy:text-blue-300 transition-colors"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 md:min-w-[160px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                                      <div className="text-right">
                                        <div className="text-3xl font-black text-white tracking-tighter">
                                          {formatMoney(t.amount)}
                                          <span className="text-sm ml-1 text-gray-400 font-normal">₫</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase opacity-80">
                                          {t.quantity} Vé • {formatMoney(t.ticket_unit_price)}/vé
                                        </div>
                                      </div>

                                      <Button
                                        size="sm"
                                        className="w-full md:w-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 h-10 px-8 rounded-xl font-bold transition-all active:scale-95"
                                        onClick={() => {
                                          setSelectedTx(t);
                                          setIsDetailOpen(true);
                                        }}
                                      >
                                        Xem Vé
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {totalPages > 1 && (
                        <div className="mt-8">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                  className={
                                    currentPage === 1
                                      ? 'pointer-events-none opacity-50 text-gray-500'
                                      : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10'
                                  }
                                />
                              </PaginationItem>

                              {Array.from({ length: totalPages }).map((_, i) => (
                                <PaginationItem key={i}>
                                  <PaginationLink
                                    isActive={currentPage === i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={
                                      currentPage === i + 1
                                        ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 hover:text-white hover:border-blue-400'
                                        : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10 border-transparent'
                                    }
                                  >
                                    {i + 1}
                                  </PaginationLink>
                                </PaginationItem>
                              ))}

                              <PaginationItem>
                                <PaginationNext
                                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                  className={
                                    currentPage === totalPages
                                      ? 'pointer-events-none opacity-50 text-gray-500'
                                      : 'cursor-pointer text-gray-400 hover:text-white hover:bg-white/10'
                                  }
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPwdOpen} onOpenChange={setIsPwdOpen}>
        <DialogContent className="bg-[rgba(11,29,58,0.92)] border border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Thay đổi mật khẩu</DialogTitle>
            <DialogDescription className="sr-only">
              Vui lòng nhập mật khẩu hiện tại và mật khẩu mới để thay đổi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white">Mật khẩu hiện tại</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Mật khẩu mới</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-white">Xác nhận mật khẩu mới</Label>
              <Input
                className="bg-white/10 border-white/20 text-white"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpdatePassword} className="bg-blue-600 hover:bg-blue-700">
                Cập nhật
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-[#0b1426] border border-white/10 text-white w-[95vw] sm:max-w-md rounded-[2.5rem] p-[1px] overflow-hidden max-h-[92vh] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] focus:outline-none duration-500 animate-in fade-in zoom-in-95 slide-in-from-bottom-10">
          <DialogHeader className="sr-only">
            <DialogTitle>Chi tiết vé</DialogTitle>
            <DialogDescription>Chi tiết thông tin vé và mã xác nhận của bạn.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[92vh] custom-scrollbar rounded-[2.5rem]">
            <style
              dangerouslySetInnerHTML={{
                __html: `
    button[data-radix-collection-item] { 
      top: 1.25rem !important; 
      right: 1.25rem !important; 
      opacity: 0.6;
      transition: all 0.2s;
    }
    button[data-radix-collection-item]:hover {
      opacity: 1;
      background: rgba(255,255,255,0.1) !important;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.3);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(59, 130, 246, 0.5);
    }
  `
              }}
            />

            {selectedTx ? (
              <div className="relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none" />

                <div className="p-6 sm:p-8 pb-4 pr-16 sm:pr-20 relative">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter italic uppercase">
                        Cinesphere{' '}
                        <span className="text-blue-500 font-light underline underline-offset-4 decoration-1 opacity-80">
                          Ticket
                        </span>
                      </h2>
                    </div>

                    {selectedTx.payment_status === 'paid' && (
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold tracking-tight ${
                          selectedTx.is_used
                            ? 'border-gray-500/30 text-gray-500 bg-gray-500/5'
                            : selectedTx.isExpired
                              ? 'border-rose-500/30 text-rose-500 bg-rose-500/5'
                              : 'border-green-500/50 text-green-400 bg-green-500/10 animate-pulse'
                        }`}
                      >
                        {selectedTx.is_used ? 'ĐÃ DÙNG' : selectedTx.isExpired ? 'ĐÃ HẾT HẠN' : 'KHẢ DỤNG'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-5 sm:px-8 pb-10 space-y-5 sm:space-y-6">
                  <div className="relative">
                    <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[#0b1426] rounded-full -translate-y-1/2 z-10 border-r border-white/10" />
                    <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[#0b1426] rounded-full -translate-y-1/2 z-10 border-l border-white/10" />

                    <div
                      className={`bg-gradient-to-br from-white/10 to-white/[0.02] rounded-2xl p-4 sm:p-6 border border-white/10 shadow-inner transition-all duration-500 ${selectedTx.is_used ? 'grayscale opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-end mb-6">
                        <div>
                          <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest mb-1 opacity-70">
                            Gói dịch vụ
                          </p>
                          <h3 className="text-lg sm:text-xl font-black text-white">
                            {selectedTx.ticket_package || 'Vé đơn'}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 opacity-70">Số lượng</p>
                          <p className="text-lg sm:text-xl font-black text-white leading-none">
                            × {selectedTx.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Danh sách phim:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {parseData(selectedTx.movie).map((m: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-md text-[11px] text-gray-300 font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-5 px-2 text-sm">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                        Mã đơn hàng
                      </p>
                      <div
                        onClick={() => handleCopy(selectedTx.pay_txt_code)}
                        className="flex items-center gap-2 cursor-pointer group/order"
                        title="Click to copy"
                      >
                        <span className="font-mono text-blue-300 font-bold tracking-tight italic whitespace-nowrap group-hover/order:text-blue-200 transition-colors">
                          {selectedTx.pay_txt_code}
                        </span>
                        <div className="p-1 group-hover/order:bg-white/10 rounded text-gray-500 group-hover/order:text-white transition-colors">
                          <Copy size={12} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                        Phương thức
                      </p>
                      <p className="font-bold text-white uppercase">{selectedTx.method}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                        {selectedTx.payment_status === 'paid' ? 'Ngày thanh toán' : 'Ngày đặt vé'}
                      </p>
                      <p className="text-white font-medium">
                        {formatDateTime(
                          selectedTx.payment_status === 'paid' ? selectedTx.paid_at : selectedTx.created_at
                        )}
                      </p>
                    </div>

                    <div className="space-y-1 text-right">
                      {selectedTx.is_used ? (
                        <>
                          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                            Đã dùng vào lúc
                          </p>
                          <p className="text-blue-300 font-bold italic">{formatDateTime(selectedTx.updated_at)}</p>
                        </>
                      ) : (
                        selectedTx.expiry_date && (
                          <>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter opacity-60">
                              Ngày hết hạn
                            </p>
                            <p className="text-red-400 font-bold">{formatDateTime(selectedTx.expiry_date)}</p>
                          </>
                        )
                      )}
                    </div>

                    <div className="col-span-2 flex justify-between items-center pt-4 mt-2 border-t border-white/5">
                      <span className="text-xs font-bold text-gray-500 uppercase">Tổng thanh toán</span>
                      <span className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                        {formatMoney(selectedTx.amount)}
                        <span className="text-lg ml-0.5">₫</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div
                      className={`rounded-[1.5rem] p-[1px] bg-gradient-to-b ${selectedTx.is_used ? 'from-white/20 to-white/5' : 'from-blue-500/50 to-blue-500/20'}`}
                    >
                      <div className="bg-[#0b1426] rounded-[1.4rem] p-6 text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-4 tracking-[0.3em]">
                          Mã xác nhận tại rạp
                        </p>

                        <div className="flex items-center justify-center gap-4 relative">
                          {selectedTx.is_used && (
                            <div className="absolute rotate-[-12deg] border-4 border-red-500/40 text-red-500/40 px-4 py-1 font-black text-2xl z-20 pointer-events-none rounded-xl">
                              ĐÃ DÙNG
                            </div>
                          )}

                          <span
                            onClick={() => {
                              if (selectedTx.payment_status === 'paid' && !selectedTx.is_used) {
                                handleCopy(getBookingCode(selectedTx));
                              }
                            }}
                            className={`text-2xl sm:text-4xl font-mono font-black tracking-[0.2em] transition-all ${selectedTx.is_used ? 'text-gray-800 line-through blur-[1px]' : 'text-white text-glow-blue cursor-pointer hover:opacity-80'}`}
                            title={selectedTx.payment_status === 'paid' && !selectedTx.is_used ? 'Click to copy' : ''}
                          >
                            {selectedTx.payment_status === 'paid' ? getBookingCode(selectedTx) : '••••••'}
                          </span>

                          {selectedTx.payment_status === 'paid' && !selectedTx.is_used && (
                            <button
                              onClick={() => handleCopy(getBookingCode(selectedTx))}
                              className="p-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl shadow-lg shadow-blue-500/20 active:scale-90 transition-all"
                            >
                              <Copy size={20} />
                            </button>
                          )}
                        </div>

                        <p className="mt-6 text-[10px] text-gray-500 font-medium italic">
                          {selectedTx.is_used
                            ? 'Cảm ơn bạn đã sử dụng dịch vụ!'
                            : 'Vui lòng không chia sẻ mã này với bất kỳ ai.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-32 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm font-bold text-blue-400 animate-pulse uppercase tracking-widest">
                  Loading...
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </UserLayout>
  );
}
