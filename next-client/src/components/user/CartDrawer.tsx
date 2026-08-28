'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  Ticket,
  Gamepad2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Film
} from 'lucide-react';
import { useCart, CartItem } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { useBranch } from '@/hooks/useBranch';

export default function CartDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranch } = useBranch();
  const {
    items,
    isOpen,
    closeCart,
    totalItemsCount,
    selectedItems,
    selectedCount,
    selectedSubtotal,
    isAllSelected,
    updateQuantity,
    removeItem,
    toggleSelect,
    selectAll,
    clearAll
  } = useCart();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  const handleProceedToBooking = () => {
    if (selectedItems.length === 0) return;

    // Check if there are movie tickets or VR packages in selected items
    const selectedMovieItem = selectedItems.find((i) => i.type === 'movie');
    const selectedVrItems = selectedItems.filter((i) => i.type === 'vr');

    if (selectedMovieItem) {
      try {
        localStorage.setItem(
          'selectedTicketPackage',
          JSON.stringify({
            id: selectedMovieItem.packageId,
            name: selectedMovieItem.name,
            price: selectedMovieItem.price,
            movies: selectedMovieItem.movies,
            type: 'COMBO'
          })
        );
        localStorage.setItem('selectedTicketCount', String(selectedMovieItem.quantity));
      } catch (e) {
        console.error('Error storing selected ticket', e);
      }
    }

    if (selectedVrItems.length > 0) {
      try {
        const vrQtyMap: Record<number, number> = {};
        selectedVrItems.forEach((it) => {
          vrQtyMap[it.packageId] = it.quantity;
        });
        localStorage.setItem('selectedVrQuantities', JSON.stringify(vrQtyMap));
      } catch (e) {
        console.error('Error storing selected vr items', e);
      }
    }

    closeCart();

    const params = new URLSearchParams(searchParams.toString());
    if (selectedBranch?.id) {
      params.set('branch_id', String(selectedBranch.id));
    }
    if (!selectedMovieItem && selectedVrItems.length > 0) {
      params.set('type', 'vr');
    } else {
      params.set('type', 'movie');
    }

    router.push(`/booking?${params.toString()}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end touch-manipulation">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg bg-[#0a0f1d] border-l border-white/10 text-white shadow-2xl flex flex-col h-full"
          >
            {/* Top Glowing Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-blue-950/50 via-slate-900/60 to-purple-950/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Giỏ hàng của bạn</h2>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {totalItemsCount}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Chọn các dịch vụ để tiến hành đặt vé</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={clearAll}
                    title="Xóa toàn bộ giỏ hàng"
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={closeCart}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Select All Bar (Shopee Style) */}
            {items.length > 0 && (
              <div className="px-4 sm:px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-slate-300 hover:text-white">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => selectAll(Boolean(checked))}
                    className="border-white/30 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                  />
                  <span className="font-semibold">Chọn tất cả ({items.length} gói)</span>
                </label>

                <span className="text-slate-400">
                  Đã chọn: <strong className="text-cyan-300">{selectedCount}</strong> mục
                </span>
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shadow-inner">
                    <ShoppingCart className="w-10 h-10 stroke-[1.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">Giỏ hàng đang trống</h3>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Bạn chưa chọn gói vé nào. Hãy khám phá các suất chiếu 8K và trải nghiệm VR đỉnh cao ngay!
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 w-full max-w-xs">
                    <Button
                      onClick={() => {
                        closeCart();
                        const el = document.getElementById('promotions');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                        else router.push('/#promotions');
                      }}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs h-10 rounded-xl"
                    >
                      <Ticket className="w-3.5 h-3.5 mr-1.5" /> Gói vé chiếu phim
                    </Button>
                    <Button
                      onClick={() => {
                        closeCart();
                        const el = document.getElementById('vr');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                        else router.push('/#vr');
                      }}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs h-10 rounded-xl"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 mr-1.5" /> Trải nghiệm VR
                    </Button>
                  </div>
                </div>
              ) : (
                items.map((item: CartItem) => {
                  const isMovie = item.type === 'movie';
                  const itemTotal = item.price * item.quantity;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`relative rounded-2xl p-3.5 border transition-all duration-200 ${
                        item.selected
                          ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.03] border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                          : 'bg-white/[0.03] border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="pt-2">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="border-white/30 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                          />
                        </div>

                        {/* Thumbnail / Icon Badge */}
                        <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                          {item.cover_image ? (
                            <img
                              src={optimizeCloudinaryUrl(item.cover_image, 160)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className={`w-full h-full flex items-center justify-center ${
                                isMovie
                                  ? 'bg-gradient-to-br from-blue-600/30 to-cyan-600/30 text-cyan-300'
                                  : 'bg-gradient-to-br from-purple-600/30 to-pink-600/30 text-purple-300'
                              }`}
                            >
                              {isMovie ? <Film className="w-6 h-6" /> : <Gamepad2 className="w-6 h-6" />}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 inset-x-0 text-[9px] font-extrabold text-center uppercase tracking-wider py-0.5 ${
                              isMovie ? 'bg-blue-600/90 text-white' : 'bg-purple-600/90 text-white'
                            }`}
                          >
                            {isMovie ? 'Vé 8K' : 'Gói VR'}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm text-white line-clamp-1 group-hover:text-cyan-300">
                              {item.name}
                            </h4>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {isMovie ? (
                              <span className="text-[11px] text-cyan-300 font-medium">Hologram 8K đa chiều</span>
                            ) : (
                              <span className="text-[11px] text-purple-300 font-medium">
                                {item.duration_min ? `${item.duration_min} phút • ` : ''}Thực tế ảo
                              </span>
                            )}
                          </div>

                          {/* Price & Quantity Controls */}
                          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/5">
                            <div>
                              <span className="text-xs text-slate-400">{formatMoney(item.price)}₫</span>
                              <div className="text-sm font-extrabold text-white">{formatMoney(itemTotal)}₫</div>
                            </div>

                            {/* Quantity buttons */}
                            <div className="flex items-center bg-white/10 border border-white/15 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 text-slate-200 hover:text-white transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-white">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-white/15 text-slate-200 hover:text-white transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Shopee-style Sticky Checkout Footer */}
            {items.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-white/10 bg-gradient-to-t from-black via-slate-950 to-slate-900/95 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Cam kết bảo mật &amp; giữ chỗ chuẩn xác</span>
                  </div>
                  <span>{selectedCount} sản phẩm đã chọn</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider block font-medium">
                      Tổng thanh toán:
                    </span>
                    <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {formatMoney(selectedSubtotal)}₫
                    </span>
                  </div>

                  <Button
                    onClick={handleProceedToBooking}
                    disabled={selectedCount === 0}
                    className="h-12 px-6 rounded-xl font-extrabold text-sm sm:text-base bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed group transition-all"
                  >
                    <span>Tiến hành Đặt vé</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
