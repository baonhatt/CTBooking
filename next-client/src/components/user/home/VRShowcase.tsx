'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Gamepad2,
  Clock,
  Users,
  ShoppingCart,
  Zap,
  Sparkles,
  ShieldAlert,
  Award,
  ChevronRight,
  Plus,
  Minus,
  CheckCircle2,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';
import { useQuery } from '@tanstack/react-query';
import { getVRPackages } from '@/lib/api/vr-packages';
import { cartStore } from '@/store/cartStore';
import { toast } from 'sonner';

const packageHighlights = [
  'Kính thực tế ảo thế hệ mới Ultra HD độ phân giải cao',
  'Bộ rung phản hồi xúc giác Haptic Vest cảm nhận từng va chạm',
  'Hệ thống âm thanh vòm định vị 3D 360 độ siêu thực',
  'Phòng chơi biệt lập chuẩn an toàn, cảm biến không gian thực',
  'Trợ tá hướng dẫn 1-kèm-1 nhiệt tình suốt lượt chơi'
];

const safetyGuidelines = [
  'Không dành cho người có tiền sử động kinh, cao huyết áp hoặc bệnh tim mạch nặng.',
  'Trẻ em dưới 8 tuổi cần có sự giám hộ của phụ huynh.',
  'Hãy báo ngay cho trợ tá nếu bạn cảm thấy chóng mặt, buồn nôn trong quá trình trải nghiệm.',
  'Luôn tuân thủ giới hạn khu vực chơi để tránh va chạm vật lý ngoài đời thực.'
];

export default function VRShowcase({ initialPackages = [] }: { initialPackages?: any[] }) {
  const { selectedBranch } = useBranch();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedDetailPkg, setSelectedDetailPkg] = useState<any | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);

  // Reactive refetch when branch changes
  const { data: vrRes } = useQuery({
    queryKey: ['vrPackages', selectedBranch?.id],
    queryFn: () => getVRPackages(selectedBranch?.id),
    initialData: { items: initialPackages },
    staleTime: 0
  });

  const packagesData: any[] = vrRes?.items ?? initialPackages;

  const resolveImageUrl = (u: string | undefined | null) => {
    if (!u) return '';
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
    const base = process.env.NEXT_PUBLIC_SERVER_BASE_URL || '';
    return `${base}${u.startsWith('/') ? u : `/${u}`}`;
  };

  const formatMoney = (n: number) => {
    return Number(n || 0).toLocaleString('vi-VN') + '₫';
  };

  // Extract unique genres for filter tabs
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    packagesData.forEach((p) => {
      if (p.vr_genre && String(p.vr_genre).trim()) {
        set.add(String(p.vr_genre).trim());
      }
    });
    return Array.from(set);
  }, [packagesData]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    let list = [...packagesData];
    if (selectedGenre !== 'all') {
      list = list.filter((p) => String(p.vr_genre || '').trim() === selectedGenre);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [packagesData, selectedGenre]);

  const handleAddToCart = (pkg: any, quantity: number = 1) => {
    cartStore.addItem({
      packageId: pkg.id,
      type: 'vr',
      name: pkg.name,
      price: Number(pkg.price || 0),
      quantity: quantity,
      cover_image: pkg.cover_image,
      duration_min: pkg.duration_min,
      vr_genre: pkg.vr_genre,
      features: pkg.features || [],
      branchId: selectedBranch?.id
    });

    toast.success('Đã thêm vào giỏ hàng!', {
      description: `${pkg.name} (${quantity} lượt) • ${formatMoney(Number(pkg.price || 0) * quantity)}`,
      action: {
        label: 'Xem giỏ',
        onClick: () => cartStore.openCart()
      }
    });
  };

  const handleBookNow = (pkg: any, quantity: number = 1) => {
    cartStore.addItem({
      packageId: pkg.id,
      type: 'vr',
      name: pkg.name,
      price: Number(pkg.price || 0),
      quantity: quantity,
      cover_image: pkg.cover_image,
      duration_min: pkg.duration_min,
      vr_genre: pkg.vr_genre,
      features: pkg.features || [],
      branchId: selectedBranch?.id,
      selected: true
    });

    cartStore.openCart();
  };

  const openDetailModal = (pkg: any) => {
    setSelectedDetailPkg(pkg);
    setModalQty(1);
  };

  return (
    <section
      id="vr"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0c0821] to-[#050915] overflow-hidden"
    >
      {/* Background neon glows & ambient lighting */}
      <div className="absolute inset-0 neon-noise pointer-events-none opacity-60" />
      <div className="absolute left-1/4 top-10 w-[500px] h-[500px] bg-purple-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute right-10 bottom-10 w-[450px] h-[450px] bg-fuchsia-600/12 blur-[130px] pointer-events-none" />
      <div className="absolute -left-20 bottom-1/3 w-[350px] h-[350px] bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <Gamepad2 className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>Thực Tế Ảo 8K / 9D Siêu Thực</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Khám Phá <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">Đa Vũ Trụ VR</span> Đỉnh Cao
          </h2>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Đắm chìm trong các tựa game và phim nhập vai tương tác 360°. Trang bị kính thực tế ảo Ultra HD, áo xúc giác Haptic Vest cảm nhận va chạm sống động đến từng miligiây.
          </p>
        </div>

        {/* Genre Filter Pills */}
        {availableGenres.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
            <button
              type="button"
              onClick={() => setSelectedGenre('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 backdrop-blur-md border',
                selectedGenre === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/10 hover:border-purple-500/30'
              )}
            >
              Tất cả ({packagesData.length})
            </button>
            {availableGenres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 backdrop-blur-md border',
                  selectedGenre === genre
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/10 hover:border-purple-500/30'
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredPackages.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-md max-w-xl mx-auto space-y-3">
            <Gamepad2 className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Chưa có gói VR nào khả dụng</h3>
            <p className="text-xs text-slate-400">
              Chi nhánh hiện tại đang cập nhật thêm các tựa game VR mới. Vui lòng chọn chi nhánh khác hoặc quay lại sau!
            </p>
          </div>
        ) : (
          /* VR Package Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredPackages.map((pkg: any) => {
              const imageUrl = resolveImageUrl(pkg.cover_image);
              const hasImage = Boolean(pkg.cover_image);

              return (
                <Card
                  key={pkg.id}
                  className="bg-slate-900/70 border border-white/10 backdrop-blur-md overflow-hidden hover:border-purple-500/50 hover:shadow-[0_0_35px_rgba(168,85,247,0.25)] transition-all duration-300 group flex flex-col h-full rounded-2xl"
                >
                  {/* Package Cover Image Header */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                    {hasImage ? (
                      <img
                        src={imageUrl}
                        alt={pkg.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-950/70 via-slate-900 to-fuchsia-950/70 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                          <Gamepad2 className="w-9 h-9" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          CineSphere VR 9D
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />

                    {/* Genre Tag */}
                    {pkg.vr_genre && (
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-purple-600/90 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md border border-purple-400/30 backdrop-blur-md">
                        {pkg.vr_genre}
                      </span>
                    )}

                    {/* Duration badge */}
                    <span className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-purple-200 font-bold bg-slate-950/85 backdrop-blur-md py-1 px-2.5 rounded-lg border border-purple-500/30 shadow-md">
                      <Clock className="w-3.5 h-3.5 text-purple-400" /> {pkg.duration_min || 30} Phút
                    </span>

                    {/* Player capacity badge */}
                    <span className="absolute bottom-3 left-3 flex items-center gap-1 text-[11px] text-slate-300 font-medium bg-slate-950/80 backdrop-blur-md py-1 px-2 rounded-lg border border-white/10">
                      <Users className="w-3 h-3 text-cyan-400" />{' '}
                      {pkg.min_players === pkg.max_players
                        ? `${pkg.min_players || 1} Người`
                        : `${pkg.min_players || 1}-${pkg.max_players || 1} Người`}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="font-extrabold text-white text-lg sm:text-xl tracking-wide line-clamp-1 group-hover:text-purple-300 transition-colors">
                        {pkg.name}
                      </h3>

                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 min-h-[2.5rem]">
                        {pkg.description || 'Trải nghiệm không gian ảo hóa 3D chân thực cao với trang bị xúc giác tiên tiến bậc nhất.'}
                      </p>

                      {/* Feature Highlights */}
                      <div className="space-y-1.5 pt-1">
                        {Array.isArray(pkg.features) && pkg.features.length > 0 ? (
                          pkg.features.slice(0, 2).map((feat: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="line-clamp-1">{feat}</span>
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span>Kính thực tế ảo Ultra HD + Âm thanh vòm 3D</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span>Áo rung phản hồi xúc giác Haptic Vest</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Price & Action Buttons */}
                    <div className="pt-4 border-t border-white/10 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Giá trọn gói</span>
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-white">
                          {formatMoney(Number(pkg.price || 0))}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openDetailModal(pkg)}
                          className="w-full bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 hover:text-white border-white/15 text-xs font-bold rounded-xl h-10 transition-all"
                        >
                          <Info className="w-3.5 h-3.5 mr-1 text-purple-400" />
                          Chi tiết
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleBookNow(pkg, 1)}
                          className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-pink-600 hover:to-purple-600 text-white text-xs font-bold rounded-xl h-10 shadow-[0_0_20px_rgba(168,85,247,0.35)] hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          <Zap className="w-3.5 h-3.5 mr-1" />
                          Đặt ngay
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddToCart(pkg, 1)}
                        className="w-full text-[11px] text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 h-8 rounded-lg font-semibold"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                        Thêm vào giỏ hàng
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Package Detail Modal */}
      <Dialog open={!!selectedDetailPkg} onOpenChange={(open) => !open && setSelectedDetailPkg(null)}>
        <DialogContent className="max-w-2xl bg-slate-950/95 border border-purple-500/30 text-white rounded-2xl p-0 overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] max-h-[90vh] flex flex-col">
          {selectedDetailPkg && (
            <>
              {/* Modal Image Header */}
              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden shrink-0">
                {selectedDetailPkg.cover_image ? (
                  <img
                    src={resolveImageUrl(selectedDetailPkg.cover_image)}
                    alt={selectedDetailPkg.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-fuchsia-950 flex flex-col items-center justify-center gap-2">
                    <Gamepad2 className="w-12 h-12 text-purple-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">CineSphere VR</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
                  <div className="space-y-1">
                    {selectedDetailPkg.vr_genre && (
                      <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-extrabold uppercase tracking-widest border border-purple-400/40">
                        {selectedDetailPkg.vr_genre}
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-black text-white">{selectedDetailPkg.name}</h2>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Giá 1 lượt</span>
                    <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
                      {formatMoney(Number(selectedDetailPkg.price || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                {/* Key Specs Row */}
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Thời lượng</span>
                    <span className="text-sm font-bold text-purple-300 flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" /> {selectedDetailPkg.duration_min || 30} Phút
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Số người chơi</span>
                    <span className="text-sm font-bold text-cyan-300 flex items-center justify-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />{' '}
                      {selectedDetailPkg.min_players === selectedDetailPkg.max_players
                        ? `${selectedDetailPkg.min_players || 1} Người`
                        : `${selectedDetailPkg.min_players || 1}-${selectedDetailPkg.max_players || 1} Người`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Thiết bị</span>
                    <span className="text-sm font-bold text-fuchsia-300 flex items-center justify-center gap-1 mt-0.5">
                      <Award className="w-3.5 h-3.5 text-fuchsia-400" /> Haptic 9D
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Mô tả trải nghiệm
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedDetailPkg.description ||
                      'Khám phá thế giới thực tế ảo đỉnh cao với công nghệ mô phỏng không gian đa chiều, âm thanh định vị và phản hồi xúc giác rung lực toàn thân.'}
                  </p>
                </div>

                {/* Package Highlights */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Quyền lợi đi kèm
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Array.isArray(selectedDetailPkg.features) && selectedDetailPkg.features.length > 0
                      ? selectedDetailPkg.features
                      : packageHighlights
                    ).map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-white/[0.03] p-2.5 rounded-lg border border-white/5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Safety Guidelines */}
                <div className="space-y-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Lưu ý an toàn sức khỏe
                  </h4>
                  <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                    {safetyGuidelines.map((guide, idx) => (
                      <li key={idx}>{guide}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Modal Footer with Quantity and Actions */}
              <div className="p-4 sm:p-6 bg-slate-900/90 border-t border-white/10 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300">Số lượt chơi:</span>
                  <div className="flex items-center gap-2 bg-slate-950 border border-white/20 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                      disabled={modalQty <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-extrabold text-sm text-purple-300">{modalQty}</span>
                    <button
                      type="button"
                      onClick={() => setModalQty(modalQty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">
                    = <span className="font-bold text-white">{formatMoney(Number(selectedDetailPkg.price || 0) * modalQty)}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      handleAddToCart(selectedDetailPkg, modalQty);
                      setSelectedDetailPkg(null);
                    }}
                    className="flex-1 sm:flex-initial bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border-white/20 text-xs font-bold rounded-xl h-11 px-4"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1.5 text-purple-400" />
                    Thêm giỏ hàng
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      handleBookNow(selectedDetailPkg, modalQty);
                      setSelectedDetailPkg(null);
                    }}
                    className="flex-1 sm:flex-initial bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-pink-600 hover:to-purple-600 text-white text-xs font-bold rounded-xl h-11 px-6 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                  >
                    <Zap className="w-4 h-4 mr-1.5" />
                    Đặt vé ngay
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
