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
import { setCookie } from '@/lib/cookies';
import { cartStore } from '@/store/cartStore';
import { ShoppingCart } from 'lucide-react';
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
                {combos.map((combo: (typeof combos)[0], index: number) => (
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
                        <div className="flex items-center gap-2 mt-3 pt-2">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAddToCart(combo)}
                            title="Thêm gói vé vào giỏ hàng"
                            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 hover:text-white border border-white/15 transition-all duration-300 shrink-0"
                          >
                            <ShoppingCart className="w-5 h-5" />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleBookCombo(combo)}
                            className="flex-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-bold hover:from-cyan-300 hover:to-purple-400 transition-all duration-300 shadow-[0_0_25px_rgba(59,130,246,0.35)] group-hover:shadow-[0_0_35px_rgba(6,182,212,0.5)]"
                          >
                            Đặt ngay
                          </motion.button>
                        </div>
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
