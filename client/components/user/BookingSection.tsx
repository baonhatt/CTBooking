import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getActiveTickets, getTransactions } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
interface BookingSectionProps {
  onBookClick: () => void;
}

export default function BookingSection({ onBookClick }: BookingSectionProps) {
  const navigate = useNavigate();
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const { data: ticketsData } = useQuery({
    queryKey: ["activeTickets"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
  });

  const ticketPackages = (ticketsData?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price || 0),
    features: Array.isArray(t.features) ? t.features : [],
    type: t.type || "",
    display_order: t.display_order || 0,

  }));
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  // Lấy dữ liệu giao dịch đã thanh toán để xác định gói vé bán chạy nhất (theo giá / vé)
  const { data: txData } = useQuery({
    queryKey: ["popularTicket", "paid"],
    queryFn: ({ signal }) =>
      getTransactions({ status: "paid", page: 1, pageSize: 200, sort: "paid_at", dir: "desc", signal }),
    staleTime: 60_000,
  });

  const popularPrice = useMemo(() => {
    const items = txData?.items || [];
    const counter = new Map<number, number>();
    for (const it of items) {
      const per = Math.round(Number(it.totalPrice || 0) / Math.max(1, Number(it.ticketCount || 1)));
      if (!per || !Number.isFinite(per)) continue;
      const inc = Math.max(1, Number(it.ticketCount || 1));
      counter.set(per, (counter.get(per) || 0) + inc);
    }
    let best: number | null = null;
    let max = 0;
    for (const [price, count] of counter.entries()) {
      if (count > max) {
        max = count;
        best = price;
      }
    }
    return best;
  }, [txData]);

  return (
    <>
      <section className="py-24 bg-gradient-section relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Bảng Giá Vé</h2>
              <p className="text-gray-300 mt-2">Chọn gói phù hợp và đặt vé nhanh chóng</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-8">
              {[...ticketPackages].sort((a, b) => a.display_order - b.display_order).map((pkg, i) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                  className="
                    relative rounded-2xl p-6 border border-white/10 bg-black/30 text-white backdrop-blur-sm shadow-lg
                    hover:bg-gradient-to-br hover:from-cyan-900/40 hover:via-cyan-700/20 hover:to-fuchsia-800/40
                    hover:shadow-[0_0_35px_rgba(99,102,241,0.25)]
                    transition-all duration-300 h-full flex flex-col
                  "
                >
                  {popularPrice && Math.round(Number(pkg.price || 0)) === popularPrice && (
                    <span className="absolute top-4 right-4 text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" /> Popular
                    </span>
                  )}
                  <div className="text-xl font-semibold mb-1">{pkg.name}</div>
                  <p className="text-sm text-gray-300 mb-3">Gói vé CineSphere</p>
                  <div className="h-20 text-4xl md:text-4xl font-extrabold text-cyan-400 mb-1">
                    {Number(pkg.price || 0).toLocaleString("vi-VN")}₫<span className="text-base font-medium text-gray-300">/vé</span>
                  </div>

                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6 flex-grow">
                    {(pkg.features?.length
                      ? pkg.features
                      : [
                        "Ghế chuyển động 6D",
                        "Mắt kính 3D active",
                        "Hiệu ứng môi trường",
                      ]
                    ).map((f, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-gray-100"
                      >
                        <Check className="h-4 w-4 text-emerald-400" /> {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => {
                      onBookClick(); // Thông báo cho component cha
                      const authRaw = localStorage.getItem("authUser");
                      if (!authRaw) {
                        toast({ title: "Vui lòng đăng nhập trước!" });
                        window.dispatchEvent(new Event("open-login"));
                        return;
                      }
                      try { localStorage.setItem('selectedTicketPackage', JSON.stringify(pkg)); } catch { }
                      setSelectedPackage(pkg);
                      navigate('/booking');
                    }}
                    className="w-full bg-white text-black hover:bg-white/90 font-semibold mt-auto"
                  >
                    Đặt Ngay
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
