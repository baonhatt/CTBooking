'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, Headset, X, ChevronUp } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBranch } from '@/hooks/useBranch';
import { useCart } from '@/store/cartStore';

export default function FloatingActions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const pathname = usePathname();
  const { selectedBranch } = useBranch();
  const { isOpen: isCartOpen } = useCart();

  // CHỈ HIỆN Ở TRANG CHỦ THEO YÊU CẦU CỦA USER
  const isHome = pathname === '/';

  // Lắng nghe sự kiện cuộn trang để tính % cuộn & hiện nút Move to Top (kiểu Cloudflare)
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollY / totalHeight) * 100));
        setScrollProgress(progress);
      }
      setShowScrollTop(scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // SVG Progress Ring calculations (Radius: 21, Circumference: 2 * PI * 21 = ~131.95)
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  // Parse branch settings to get specific hotline
  const branchSettings = useMemo(() => {
    try {
      if (!selectedBranch?.settings) return {};
      return JSON.parse(selectedBranch.settings);
    } catch (e) {
      return {};
    }
  }, [selectedBranch]);

  // Nếu không phải trang chủ hoặc đang mở giỏ hàng thì không render
  if (!isHome || isCartOpen) return null;

  const hotline = branchSettings.hotline || selectedBranch?.phone || '0366431179';
  const zaloPhone = hotline.replace(/\./g, '').replace(/\s/g, '');

  const showZalo = branchSettings.show_zalo_button ?? true;
  const showPhone = branchSettings.show_phone_button ?? true;
  const showContactGroup = showZalo || showPhone;

  return (
    <div className="fixed bottom-6 right-5 sm:right-6 z-[40] flex flex-col gap-3 items-end">
      <AnimatePresence>
        {/* 1. NÚT MOVE TO TOP VỚI VÒNG TIẾN TRÌNH TRÒN (Cloudflare Style) */}
        {showScrollTop && (
          <motion.button
            key="scroll-to-top"
            onClick={scrollToTop}
            initial={{ opacity: 0, scale: 0.5, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 15 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={`Về đầu trang (${Math.round(scrollProgress)}%)`}
            title={`Về đầu trang (${Math.round(scrollProgress)}%)`}
            className="relative w-12 h-12 rounded-full bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md text-cyan-400 hover:text-white shadow-[0_4px_25px_rgba(6,182,212,0.4)] flex items-center justify-center transition-all cursor-pointer group"
          >
            {/* SVG Circular Progress Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
              <defs>
                <linearGradient id="cloudflare-progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>

              {/* Background Track Ring */}
              <circle
                cx="24"
                cy="24"
                r={radius}
                className="stroke-white/15"
                strokeWidth="3"
                fill="none"
              />

              {/* Active Progress Ring */}
              <circle
                cx="24"
                cy="24"
                r={radius}
                stroke="url(#cloudflare-progress-grad)"
                strokeWidth="3"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-150 ease-out"
              />
            </svg>

            <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform z-10" />
          </motion.button>
        )}

        {/* 2. CỤM NÚT LIÊN HỆ (Thu gọn/Mở rộng) */}
        {showContactGroup && (
          <div className="relative flex flex-col items-end gap-2.5">
            {/* Các nút con hiện ra khi bấm mở rộng */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  className="flex flex-col gap-2.5 mb-0.5"
                >
                  {/* Nút Zalo */}
                  {showZalo && (
                    <motion.a
                      href={`https://zalo.me/${zaloPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0068ff] text-white flex items-center justify-center shadow-lg border border-white/20"
                      title="Chat Zalo"
                    >
                      <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </motion.a>
                  )}

                  {/* Nút Hotline */}
                  {showPhone && (
                    <motion.a
                      href={`tel:${hotline}`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border border-white/20"
                      title="Gọi Hotline"
                    >
                      <Phone className="w-5 h-5 sm:w-6 sm:h-6" />
                    </motion.a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nút điều khiển (Bấm để hiện Zalo/Hotline) */}
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isExpanded ? 'Đóng liên hệ' : 'Mở liên hệ'}
              className={cn(
                'w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg border border-white/20 transition-colors duration-300 cursor-pointer',
                isExpanded ? 'bg-gray-800 text-white' : 'bg-slate-900/80 backdrop-blur-md text-white hover:bg-slate-800'
              )}
            >
              {isExpanded ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Headset className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />}
            </motion.button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
