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
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday, getActiveTickets } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

export default function Index() {
  const navigate = useNavigate();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [movie, setMovie] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [ticketCount, setTicketCount] = useState<number>(1);

  const { data: activeData } = useQuery({
    queryKey: ["activeMovies", "home-modal"],
    queryFn: () => getAllActiveMoviesToday(),
    staleTime: 60000,
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["activeTickets", "home-modal"],
    queryFn: ({ signal }) => getActiveTickets({ signal }),
  });

  const activeMoviesFull = activeData?.activeMovies || [];
  const movies = useMemo(() => (activeMoviesFull || []).map((m: any) => ({ id: m.title, title: m.title })), [activeMoviesFull]);
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

  const handleConfirmQuickBooking = () => {
    const authRaw = localStorage.getItem("authUser");
    if (!authRaw) {
      toast({ title: "Vui lòng đăng nhập", description: "Bạn cần đăng nhập trước khi đặt vé" });
      window.dispatchEvent(new Event("open-login"));
      return;
    }
    try {
      const found = activeMoviesFull.find((m: any) => m.title === movie);
      if (found) {
        localStorage.setItem("selectedFilm", JSON.stringify({
          id: found.id,
          title: found.title,
          poster: found.cover_image,
        }));
      }
      if (selectedPackage) {
        localStorage.setItem("selectedTicketPackage", JSON.stringify(selectedPackage));
      }
      localStorage.setItem("preselectTicketCount", String(ticketCount));
    } catch { }
    setIsBookingModalOpen(false);
    navigate("/booking");
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
