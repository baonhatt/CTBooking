'use client';

<<<<<<< HEAD
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export default function PromotionShowcase({ initialCombos = [] }: { initialCombos?: any[] }) {
        const router = useRouter();

        useEffect(() => {
                router.prefetch('/booking');
        }, [router]);

        const combos = initialCombos
                .map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        price: Number(t.price || 0),
                        type: t.type || '',
                        display_order: t.display_order || 0
                }))
                .sort((a, b) => a.display_order - b.display_order);

        const handleBookCombo = (combo: (typeof combos)[0]) => {
                try {
                        const comboPackage = {
                                id: combo.id,
                                name: combo.name,
                                price: combo.price,
                                type: combo.type,
                                display_order: combo.display_order
                        };
                        localStorage.setItem('selectedTicketPackage', JSON.stringify(comboPackage));
                } catch (error) {
                        console.error('Error saving combo:', error);
                }
                router.push('/booking');
        };

        return (
                <section
                        id="promotions"
                        className="relative py-20 bg-gradient-to-b from-[#0e1b3d] via-[#0b1026] to-[#050915] overflow-hidden"
                >
                        <div className="absolute inset-0 neon-noise pointer-events-none opacity-60" />
                        <div className="absolute left-0 top-10 w-80 h-80 bg-cyan-500/15 blur-[110px]" />
                        <div className="absolute right-0 bottom-0 w-[420px] h-[420px] bg-purple-500/12 blur-[130px]" />

                        <div className="container mx-auto px-4 relative z-10">
                                <div className="text-center max-w-3xl mx-auto mb-10">
                                        <p className="text-sm uppercase tracking-[0.22em] text-cyan-200">Ưu đãi suất chiếu</p>
                                        <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Chọn gói phù hợp – ưu đãi kèm quà tặng</h2>
                                        <p className="text-gray-300 mt-3">“Quà tặng hộp đèn kèm hình ảnh” - “Cúp ngàn quang cáo”</p>
                                </div>

                                {combos.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">Chưa có gói vé nào</div>
                                ) : (
                                        <div className="mx-auto max-w-7xl px-10 py-10">
                                                <Carousel
                                                        opts={{
                                                                align: 'start',
                                                                loop: combos.length > 4
                                                        }}
                                                        className="w-full"
                                                >
                                                        <CarouselContent>
                                                                {combos.map((combo, index) => (
                                                                        <CarouselItem
                                                                                key={combo.id}
                                                                                className={cn(
                                                                                        'md:basis-1/2 lg:basis-1/4 py-10 pl-6',
                                                                                        index === 0 && combos.length === 1 && 'md:ml-[25%] lg:ml-[37.5%]',
                                                                                        index === 0 && combos.length === 2 && 'lg:ml-[25%]',
                                                                                        index === 0 && combos.length === 3 && 'lg:ml-[12.5%]'
                                                                                )}
                                                                        >
                                                                                <motion.div
                                                                                        initial={{ opacity: 0, y: 50 }}
                                                                                        whileInView={{ opacity: 1, y: 0 }}
                                                                                        viewport={{ once: true }}
                                                                                        transition={{
                                                                                                delay: index * 0.1,
                                                                                                duration: 0.5,
                                                                                                type: 'spring',
                                                                                                stiffness: 100
                                                                                        }}
                                                                                        className="h-full relative overflow-hidden rounded-3xl p-6 px-4 bg-white/5 border border-cyan-400/20 shadow-[0_10px_50px_rgba(59,130,246,0.15)] group transition-colors duration-300 flex flex-col justify-between"
                                                                                >
                                                                                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-fuchsia-500/12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                                        <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-3xl group-hover:bg-cyan-400/20 transition-colors duration-500" />

                                                                                        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                                                                        <div className="relative z-10 space-y-3">
                                                                                                <p className="text-sm uppercase tracking-[0.16em] text-cyan-200 group-hover:text-cyan-100 transition-colors">
                                                                                                        Combo
                                                                                                </p>
                                                                                                <h3 className="text-xl font-semibold text-white group-hover:text-cyan-50 transition-colors">
                                                                                                        {combo.name}
                                                                                                </h3>
                                                                                                <motion.p
                                                                                                        whileHover={{ scale: 1.1, originX: 0 }}
                                                                                                        className="text-3xl font-extrabold text-cyan-300 drop-shadow group-hover:text-cyan-200 transition-colors"
                                                                                                >
                                                                                                        {combo.price.toLocaleString('vi-VN')}₫
                                                                                                </motion.p>
                                                                                                <p className="text-sm text-gray-200 group-hover:text-white transition-colors">
                                                                                                        Vé trải nghiệm CINESPHERE kèm quà tặng ánh sáng lưu niệm.
                                                                                                </p>
                                                                                                <motion.button
                                                                                                        whileHover={{ scale: 1.05 }}
                                                                                                        whileTap={{ scale: 0.95 }}
                                                                                                        onClick={() => handleBookCombo(combo)}
                                                                                                        className="mt-2 w-full inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-bold hover:from-cyan-300 hover:to-purple-400 transition-all duration-300 shadow-[0_0_25px_rgba(59,130,246,0.35)] group-hover:shadow-[0_0_35px_rgba(6,182,212,0.5)]"
                                                                                                >
                                                                                                        Đặt ngay
                                                                                                </motion.button>
                                                                                        </div>
                                                                                </motion.div>
                                                                        </CarouselItem>
                                                                ))}
                                                        </CarouselContent>
                                                        <div
                                                                className={cn(
                                                                        'hidden',
                                                                        combos.length > 2 ? 'md:block' : 'md:hidden',
                                                                        combos.length <= 4 && 'lg:hidden'
                                                                )}
                                                        >
                                                                <CarouselPrevious className="bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white -left-12" />
                                                                <CarouselNext className="bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white -right-12" />
                                                        </div>

                                                        <div className={cn('flex justify-center gap-4 mt-6 md:hidden', combos.length <= 1 && 'hidden')}>
                                                                <CarouselPrevious className="static translate-y-0 bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white" />
                                                                <CarouselNext className="static translate-y-0 bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white" />
                                                        </div>
                                                </Carousel>
                                        </div>
                                )}
                        </div>
                </section>
        );
=======
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
    staleTime: 0
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
    // Add to cart and open cart drawer
    cartStore.addItem({
      packageId: combo.id,
      type: 'movie',
      name: combo.name,
      price: combo.price,
      movies: combo.movies,
      quantity: 1,
      branchId: selectedBranch?.id,
      selected: true
    });

    cartStore.openCart();
  };

  return (
    <section
      id="promotions"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0b1026] to-[#060915] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise pointer-events-none opacity-60" />
      <div className="absolute left-10 top-10 w-96 h-96 bg-amber-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-[450px] h-[450px] bg-cyan-500/12 blur-[130px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Ưu Đãi Suất Chiếu</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Chọn gói phù hợp – <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200">ưu đãi kèm quà tặng</span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed italic">
            “Quà tặng hộp đèn kèm hình ảnh” - “Cúp ngàn quang cáo”
          </p>
        </div>

        {combos.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-white/10 backdrop-blur-md max-w-xl mx-auto space-y-3">
            <p className="text-sm text-slate-400">Chưa có gói vé nào khả dụng tại chi nhánh này.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {combos.map((combo: (typeof combos)[0], index: number) => (
                <motion.div
                  key={combo.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.45
                  }}
                  className="h-full"
                >
                  <div className="h-full relative overflow-hidden rounded-2xl p-6 bg-slate-900/70 border border-white/10 backdrop-blur-xl hover:border-amber-400/40 hover:shadow-[0_0_35px_rgba(245,158,11,0.2)] group transition-all duration-300 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/20 border-b border-l border-amber-500/30 text-amber-300 text-[10px] font-extrabold uppercase tracking-widest rounded-bl-xl">
                      Gói Phim
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] uppercase font-bold text-amber-400/80 tracking-wider">CineSphere Combo</span>
                        <h3 className="text-xl font-black text-white group-hover:text-amber-200 transition-colors mt-0.5">
                          {combo.name}
                        </h3>
                      </div>

                      <div className="py-2 border-y border-white/10">
                        <span className="text-[11px] text-slate-400 block">Giá trọn gói</span>
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-yellow-100">
                          {combo.price.toLocaleString('vi-VN')}₫
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed min-h-[2.5rem]">
                        Vé trải nghiệm CINESPHERE kèm quà tặng ánh sáng lưu niệm.
                      </p>
                    </div>

                    <div className="pt-6 mt-4 border-t border-white/10 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCart(combo)}
                        title="Thêm gói vé vào giỏ hàng"
                        className="h-10 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-amber-300 hover:text-white border-white/15 transition-all shrink-0"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleBookCombo(combo)}
                        className="flex-1 h-10 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
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
>>>>>>> preview
}
