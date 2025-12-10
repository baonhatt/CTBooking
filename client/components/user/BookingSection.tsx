import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getActiveTickets } from "@/lib/api";
interface BookingSectionProps {
  onBookClick: () => void;
}

export default function BookingSection({ onBookClick }: BookingSectionProps) {
  const navigate = useNavigate();

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

  return (
    <>
      <section className="py-20 bg-gradient-section relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-8">
              {ticketPackages.map((pkg, i) => (
                <motion.div
                key={pkg.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                  className="
                    rounded-2xl p-6 border border-white/10 bg-black/30 backdrop-blur-sm
                    hover:bg-gradient-to-br hover:from-cyan-900/40 hover:via-cyan-700/20 hover:to-fuchsia-800/40
                    hover:shadow-[0_0_35px_rgba(99,102,241,0.25)]
                    transition-all duration-300
                    h-full flex flex-col
                  "
                >
                  <div className="text-xl font-semibold text-white mb-1">
                    {pkg.name}
                  </div>

                  <div className="h-20 text-4xl md:text-4xl font-extrabold text-cyan-400 mb-1">
                    {Number(pkg.price || 0).toLocaleString("vi-VN")}₫
                  </div>

                  <ul className="space-y-2 mb-6 flex-grow">
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
                      try { localStorage.setItem('selectedTicketPackage', JSON.stringify(pkg)); } catch {}
                      setSelectedPackage(pkg);
                      navigate('/booking');
                    }}
                    className="bg-white text-black hover:bg-white/90 font-semibold mt-auto"
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
