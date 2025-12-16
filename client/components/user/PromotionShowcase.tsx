import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getActiveTickets } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "../ui/carousel";

export default function PromotionShowcase() {
  const navigate = useNavigate();

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ["activeTickets"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
  });

  const combos = (ticketsData?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price || 0),
    type: t.type || "",
    display_order: t.display_order || 0,
  })).sort((a, b) => a.display_order - b.display_order);

  const handleBookCombo = (combo: typeof combos[0]) => {
    try {
      // Lưu combo được chọn vào localStorage dưới dạng package để tương thích với hệ thống booking
      const comboPackage = {
        id: combo.id,
        name: combo.name,
        price: combo.price,
        type: combo.type,
        display_order: combo.display_order,
      };
      localStorage.setItem('selectedTicketPackage', JSON.stringify(comboPackage));
    } catch (error) {
      console.error('Error saving combo:', error);
    }
    navigate('/booking');
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
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-200">
            Ưu đãi suất chiếu
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
            Chọn gói phù hợp – ưu đãi kèm quà tặng
          </h2>
          <p className="text-gray-300 mt-3">
            “Quà tặng hộp đèn kèm hình ảnh” - “Cúp ngàn quang cáo”
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-300">Đang tải dữ liệu...</span>
          </div>
        ) : combos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Chưa có gói vé nào
          </div>
        ) : (
          <div className="mx-auto max-w-7xl">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full"
            >
              <CarouselContent>
                {combos.map((combo, index) => (
                  <CarouselItem key={combo.id} className="md:basis-1/2 lg:basis-1/4 pl-6">
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      whileHover={{
                        scale: 1.05,
                        boxShadow: "0 20px 60px rgba(6, 182, 212, 0.2)",
                      }}
                      viewport={{ once: true }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 100,
                      }}
                      className="h-full relative overflow-hidden rounded-3xl p-6 bg-white/5 border border-cyan-400/20 shadow-[0_10px_50px_rgba(59,130,246,0.15)] group transition-colors duration-300 flex flex-col justify-between"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-fuchsia-500/12 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-3xl group-hover:bg-cyan-400/20 transition-colors duration-500" />

                      {/* Shine effect */}
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
                          {combo.price.toLocaleString("vi-VN")}₫
                        </motion.p>
                        <p className="text-sm text-gray-200 group-hover:text-white transition-colors">
                          Vé trải nghiệm CINESPHERE kèm quà tặng ánh sáng lưu
                          niệm.
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
              <div className="hidden md:block">
                <CarouselPrevious className="bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white -left-12" />
                <CarouselNext className="bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white -right-12" />
              </div>

              {/* Mobile Navigation */}
              <div className="flex justify-center gap-4 mt-6 md:hidden">
                <CarouselPrevious className="static translate-y-0 bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white" />
                <CarouselNext className="static translate-y-0 bg-white/10 hover:bg-cyan-500 hover:text-white border-none text-white" />
              </div>
            </Carousel>
          </div>
        )}
      </div>
    </section>
  );
}

