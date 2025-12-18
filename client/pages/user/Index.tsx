import { useEffect, useMemo, useState } from "react";
import HeroSection from "@/components/user/HeroSection";
import FilmCarousel from "@/components/user/FilmCarousel";
import PromotionShowcase from "@/components/user/PromotionShowcase";
import ProductSection from "@/components/user/ProductSection";
import TechnologyBanner from "@/components/user/TechnologyBanner";
import UserLayout from "@/user/layouts/UserLayout";
import { ConfigProvider } from "antd";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday, getActiveTickets } from "@/lib/api";

export default function Index() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [movie, setMovie] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);

  const { data: activeData } = useQuery({
    queryKey: ["activeMovies"],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
    staleTime: 60000,
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["activeTickets"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
    staleTime: 60000,
  });

  const activeMoviesFull = activeData?.activeMovies || [];
  const ticketPackages = useMemo(() => (ticketsData?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description || "",
    price: Number(t.price || 0),
    type: t.type || "",
    display_order: t.display_order || 0,
  })), [ticketsData]);

  const handleBookClick = () => {
    setIsBookingModalOpen(true);
  };

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      if (!movie && Array.isArray(activeMoviesFull) && activeMoviesFull.length > 0) {
        setMovie(activeMoviesFull[0].title);
      }
      if (!selectedPackage && Array.isArray(ticketPackages) && ticketPackages.length > 0) {
        const sorted = [...ticketPackages].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        setSelectedPackage(sorted[0] || null);
      }
    } catch { }
  }, [activeMoviesFull, ticketPackages]);

  useEffect(() => {
    try {
      localStorage.removeItem("pendingOrder");
      localStorage.removeItem("lastCheckoutOrder");
      localStorage.removeItem("lastVnpayBookingId");
    } catch { }
  }, []);

  const scrollToTop = () => {
    setShowBackToTop(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#22d3ee",
          colorBgBase: "#0e1b3d",
          colorText: "#ffffff",
        },
        components: {
          DatePicker: {
            colorBgContainer: "#ffffff",
            colorBgElevated: "#ffffff",
            colorText: "#000000",
            colorBorder: "#e5e7eb",
            controlItemBgHover: "#f1f5f9",
            colorTextDisabled: "#94a3b8",
          },
          Steps: {
            colorText: "#ffffff",
            colorTextDescription: "#ffffff",
          },
        },
      }}
    >
      <UserLayout
        headerProps={{ onBookClick: handleBookClick }}
        className="bg-gradient-dark"
      >
        <main>
          <HeroSection />
          <FilmCarousel onSelectFilm={handleBookClick} />
          <PromotionShowcase />
          <TechnologyBanner />
          <ProductSection />
        </main>
        {showBackToTop && (
          <motion.button
            onClick={scrollToTop}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-black border border-white/20 flex items-center justify-center hover:border-blue-400 transition-colors z-50"
          >
            <ArrowUp className="h-5 w-5 text-blue-400" />
          </motion.button>
        )}
      </UserLayout>
    </ConfigProvider>
  );
}
