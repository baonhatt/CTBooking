import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onBookClick: () => void;
}

export default function Header({ onBookClick }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-black/95 backdrop-blur-md border-b border-white/10"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-400">CINESPHERE</h1>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 animate-fade-in delay-200">
          <button
            onClick={() => scrollToSection("hero")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Phim Hot
          </button>
          <button
            onClick={() => scrollToSection("technology")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Công Nghệ
          </button>
          <button
            onClick={() => scrollToSection("products")}
            className="text-white hover:text-blue-400 transition-colors duration-300 font-medium"
          >
            Cửa Hàng
          </button>
        </nav>
        
        <Button
          onClick={onBookClick}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-6 py-2 rounded-lg shadow-lg transition-all duration-300 hover:scale-105 animate-fade-in delay-300"
        >
          <Ticket className="mr-2 h-4 w-4" />
          ĐẶT VÉ NGAY
        </Button>
      </div>
    </header>
  );
}
