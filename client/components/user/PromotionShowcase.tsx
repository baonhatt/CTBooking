import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getActiveTickets } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

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
    const authRaw = localStorage.getItem("authUser");
    if (!authRaw) {
      toast({ title: "Vui lòng đăng nhập trước!" });
      window.dispatchEvent(new Event("open-login"));
      return;
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {combos.map((combo, index) => (
              <motion.div
                key={combo.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                className="relative overflow-hidden rounded-3xl p-6 bg-white/5 border border-cyan-400/20 shadow-[0_10px_50px_rgba(59,130,246,0.15)] hover:shadow-[0_10px_60px_rgba(236,72,153,0.22)] transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-fuchsia-500/12" />
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10 space-y-3">
                  <p className="text-sm uppercase tracking-[0.16em] text-cyan-200">
                    Combo
                  </p>
                  <h3 className="text-xl font-semibold text-white">{combo.name}</h3>
                  <p className="text-3xl font-extrabold text-cyan-300 drop-shadow">
                    {combo.price.toLocaleString("vi-VN")}₫
                  </p>
                  <p className="text-sm text-gray-200">
                    Vé trải nghiệm CINESPHERE kèm quà tặng ánh sáng lưu niệm.
                  </p>
                  <button 
                    onClick={() => handleBookCombo(combo)}
                    className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-semibold hover:from-fuchsia-500 hover:to-cyan-400 transition-all duration-300 shadow-[0_0_25px_rgba(59,130,246,0.35)]"
                  >
                    Đặt ngay
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

