import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday } from "@/lib/api";
import { Play, Sparkles, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const { data } = useQuery({
    queryKey: ["heroMovies", "today"],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
  });

  const heroPoster = useMemo(() => {
    const poster = data?.activeMovies?.[0]?.cover_image;
    return (
      poster ||
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80"
    );
  }, [data]);

  const onMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { clientX, clientY, currentTarget } = e;
    const rect = currentTarget.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((clientY - rect.top) / rect.height - 0.5) * 20;
    setPointer({ x, y });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d] text-white"
      onMouseMove={onMove}
    >
      <div className="absolute inset-0">
        <img
          src={heroPoster}
          alt="Cinematic backdrop"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.3),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.24),transparent_28%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.28),transparent_25%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#050915]/90" />
        <div className="absolute inset-0 neon-noise" />
      </div>

      <div className="absolute -left-24 top-10 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div
        className="absolute -right-16 top-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]"
        style={{ transform: `translate(${pointer.x * -0.5}px, ${pointer.y * -0.5}px)` }}
      />

      <div className="container mx-auto px-4 relative z-10 min-h-screen flex flex-col justify-center py-20">
        <div className="max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span className="uppercase tracking-[0.32em] text-xs text-gray-100">
              CINESPHERE
            </span>
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight tracking-tight drop-shadow-[0_10px_40px_rgba(56,189,248,0.35)]">
            CINESPHERE – Không gian điện ảnh cá nhân đa chiều 8K
          </h1>
          <p className="mt-5 text-lg md:text-xl text-gray-200 leading-relaxed max-w-2xl">
            Chạm vào vũ trụ riêng của bạn. Mỗi suất chiếu là một hành trình nhập vai
            với độ phân giải 8K và âm thanh đa tầng bao quanh, mở ra thế giới vô biên ngay
            trong không gian nhỏ.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              className="rounded-2xl px-6 md:px-8 py-3 text-base md:text-lg font-semibold bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-fuchsia-500 hover:to-cyan-400 text-black shadow-[0_0_30px_rgba(59,130,246,0.45)] transition-all duration-300 animate-glow-soft"
              onClick={() => {
                const bookingSection = document.getElementById("films");
                bookingSection?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Đặt vé ngay
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl px-6 md:px-8 py-3 text-base md:text-lg font-semibold border-cyan-300/60 text-white hover:border-fuchsia-400 hover:text-fuchsia-200 backdrop-blur bg-white/5"
              onClick={() => {
                const trailer = document.getElementById("films");
                trailer?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Play className="h-5 w-5 mr-2" />
              Xem trailer trải nghiệm
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {[
              { icon: Waves, title: "Âm thanh đa tầng", desc: "Định vị 360° bao quanh" },
              { icon: Sparkles, title: "Hiệu ứng vũ trụ", desc: "Hào quang, photon, nebula" },
              { icon: Play, title: "Độ phân giải 8K", desc: "Màn hình đa chiều siêu nét" },
            ].map(({ icon: Icon, title, desc }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.45 }}
                className="glass-tile rounded-2xl p-4 border border-white/10 bg-white/5"
                style={{ transform: `translate(${pointer.x * 0.12}px, ${pointer.y * 0.12}px)` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/70 to-fuchsia-500/70 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm text-gray-200/90">{desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
