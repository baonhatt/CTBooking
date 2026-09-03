'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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
import { useBranch } from '@/hooks/useBranch';
import { useQuery } from '@tanstack/react-query';
import { getActiveTickets } from '@/lib/api/products';
import { cartStore } from '@/store/cartStore';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function PromotionShowcase({ initialCombos = [] }: { initialCombos?: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showBranchConfirmDialog, setShowBranchConfirmDialog] = useState(false);
  const { selectedBranch, dontShowConfirm, toggleDontShowConfirm } = useBranch();

  // Thêm useQuery để tự động refetch khi branch thay đổi
  const { data: ticketsRes } = useQuery({
    queryKey: ['activeTickets', selectedBranch?.id],
    queryFn: () => getActiveTickets(selectedBranch?.id),
    initialData: { items: initialCombos, total: initialCombos.length },
    staleTime: 5 * 60 * 1000 // 5 minutes cache to prevent duplicate client refetch on mount
  });

  const combosData = ticketsRes?.items ?? initialCombos;

  useEffect(() => {
    router.prefetch('/booking');
  }, [router]);

  const combos = combosData
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price || 0),
      type: t.type || '',
      display_order: t.display_order || 0,
      movies: t.movies || []
    }))
    .sort((a: any, b: any) => a.display_order - b.display_order);

  const handleAddToCart = (combo: (typeof combos)[0]) => {
    cartStore.addItem({
      packageId: combo.id,
      type: 'movie',
      name: combo.name,
      price: combo.price,
      movies: combo.movies,
      quantity: 1,
      branchId: selectedBranch?.id
    });

    toast.success('Đã thêm vào giỏ hàng!', {
      description: `${combo.name} • ${combo.price.toLocaleString('vi-VN')}₫`,
      action: {
        label: 'Xem giỏ',
        onClick: () => cartStore.openCart()
      }
    });
  };

  const handleBookCombo = (combo: (typeof combos)[0]) => {
    try {
      sessionStorage.setItem(
        'directBookingItem',
        JSON.stringify({
          packageId: combo.id,
          type: 'movie',
          name: combo.name,
          price: combo.price,
          movies: combo.movies,
          quantity: 1,
          branchId: selectedBranch?.id
        })
      );
    } catch {}

    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    if (selectedBranch?.id && !params.has('branch_id')) {
      params.set('branch_id', String(selectedBranch.id));
    }
    params.set('direct', '1');
    router.push(`/booking${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <section
      id="promotions"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0b1026] to-[#060915] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise pointer-events-none opacity-60" />
      <div className="absolute left-10 top-10 w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.15)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,_rgba(6,182,212,0.16)_0%,_transparent_70%)] pointer-events-none" />

      <div className="container mx-auto px-3 sm:px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-12 space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Ưu Đãi Suất Chiếu</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Chọn gói phù hợp
          </h2>
        </div>

        {combos.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-md max-w-xl mx-auto space-y-3">
            <p className="text-xs sm:text-sm text-slate-400">Chưa có gói vé nào khả dụng tại chi nhánh này.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-6">
              {combos.map((combo: (typeof combos)[0], index: number) => (
                <motion.div
                  key={combo.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.4
                  }}
                  className="h-full"
                >
                  <div className="h-full relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-6 bg-slate-900/80 border border-white/10 backdrop-blur-xl hover:border-amber-400/40 hover:shadow-[0_0_35px_rgba(245,158,11,0.2)] group transition-all duration-300 flex flex-col justify-between">
                    {/* Badge */}
                    <div className="absolute top-0 right-0 px-2 py-0.5 sm:px-3 sm:py-1 bg-amber-500/20 border-b border-l border-amber-500/30 text-amber-300 text-[8px] sm:text-[10px] font-extrabold uppercase tracking-wider rounded-bl-lg sm:rounded-bl-xl">
                      Gói Phim
                    </div>

                    <div className="space-y-2 sm:space-y-4">
                      <div>
                        <span className="text-[9px] sm:text-[11px] uppercase font-bold text-amber-400/80 tracking-wider">
                          CineSphere Combo
                        </span>
                        <h3 className="text-xs sm:text-xl font-black text-white group-hover:text-amber-200 transition-colors mt-0.5 line-clamp-2 min-h-[2rem] sm:min-h-0">
                          {combo.name}
                        </h3>
                      </div>

                      <div className="py-1.5 sm:py-2 border-y border-white/10">
                        <span className="text-[9px] sm:text-[11px] text-slate-400 block">Giá trọn gói</span>
                        <span className="text-base sm:text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-yellow-100">
                          {combo.price.toLocaleString('vi-VN')}₫
                        </span>
                      </div>

                      <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed line-clamp-2 min-h-[1.75rem] sm:min-h-[2.5rem]">
                        Vé trải nghiệm CINESPHERE kèm quà tặng ánh sáng lưu niệm.
                      </p>
                    </div>

                    <div className="pt-3 sm:pt-6 mt-2 sm:mt-4 border-t border-white/10 flex items-center gap-1.5 sm:gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCart(combo)}
                        title="Thêm gói vé vào giỏ hàng"
                        className="h-8 sm:h-10 px-2 sm:px-3 rounded-lg sm:rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-amber-300 hover:text-white border-white/15 transition-all shrink-0"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleBookCombo(combo)}
                        className="flex-1 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-[11px] sm:text-xs shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Đặt ngay
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Branch confirmation dialog */}
      <AlertDialog open={showBranchConfirmDialog} onOpenChange={setShowBranchConfirmDialog}>
        <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-white">Xác nhận chi nhánh</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Bạn đang đặt vé tại chi nhánh <span className="font-bold text-blue-400">{selectedBranch?.name}</span>.
              <br />
              <br />
              Nếu muốn đổi chi nhánh, hãy chọn ở dropdown trên header trước khi đặt vé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col items-stretch gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dont-show-branch-confirm-promo"
                checked={dontShowConfirm}
                onCheckedChange={(checked) => toggleDontShowConfirm(checked as boolean)}
              />
              <label htmlFor="dont-show-branch-confirm-promo" className="text-sm text-gray-300 cursor-pointer">
                Không nhắc lại lần sau
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white flex-1">
                Hủy bỏ
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowBranchConfirmDialog(false);
                  const params = new URLSearchParams(searchParams.toString());
                  router.push(`/booking${params.toString() ? `?${params.toString()}` : ''}`);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                Tiếp tục
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
