import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import TechnologyBanner from "@/components/TechnologyBanner";
import BookingSection from "@/components/BookingSection";
import ProductSection from "@/components/ProductSection";
import Footer from "@/components/Footer";
// Ant Design v6 uses CSS-in-JS, no CSS import needed
import { ConfigProvider } from "antd";

export default function Index() {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

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

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#00f0ff",
          colorBgBase: "#000000",
          colorText: "#ffffff",
        },
      }}
    >
      <div className="min-h-screen bg-gradient-dark">
        <Header onBookClick={handleBookClick} />
        <main>
          <HeroSection />
          <TechnologyBanner />
          <div id="booking-section">
            <BookingSection onBookClick={handleBookClick} />
          </div>
          <ProductSection />
        </main>
        <Footer />
      </div>
    </ConfigProvider>
  );
}
