import { useEffect, useState } from "react";
import HeroSection from "@/components/user/HeroSection";
import TechnologyBanner from "@/components/user/TechnologyBanner";
import BookingSection from "@/components/user/BookingSection";
import ProductSection from "@/components/user/ProductSection";
import UserLayout from "@/user/layouts/UserLayout";
import { ConfigProvider } from "antd";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

export default function Index() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const handleBookClick = () => {
    setIsBookingModalOpen(true);
    // Scroll to booking section
    setTimeout(() => {
      const bookingSection = document.getElementById("booking-section");
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          <div id="booking-section">
            <BookingSection onBookClick={handleBookClick} />
          </div>
          <ProductSection />
          <TechnologyBanner />
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
