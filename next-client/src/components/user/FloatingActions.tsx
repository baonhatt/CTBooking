'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, Ticket, Headset, X } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useBranch } from '@/hooks/useBranch';

export default function FloatingActions() {
        const [isExpanded, setIsExpanded] = useState(false);
        const [isOverlayOpen, setIsOverlayOpen] = useState(false);
        const router = useRouter();
        const pathname = usePathname();
        const searchParams = useSearchParams();
        const { selectedBranch } = useBranch();

        // CHỈ HIỆN Ở TRANG CHỦ THEO YÊU CẦU CỦA USER
        const isHome = pathname === '/';

        // Kiểm tra xem có đang mở Modal/Drawer/Menu nào không để ẩn nút nổi
        useEffect(() => {
                if (!isHome) return;

                const checkOverlay = () => {
                        // Radix UI và Vaul Drawer thường thêm style pointer-events: none hoặc overflow: hidden vào body
                        const hasLock = document.body.style.overflow === 'hidden' ||
                                document.body.hasAttribute('data-radix-scroll-lock');
                        setIsOverlayOpen(!!hasLock);
                };

                // Theo dõi sự thay đổi của body attribute
                const observer = new MutationObserver(checkOverlay);
                observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'data-radix-scroll-lock'] });

                return () => observer.disconnect();
        }, [isHome]);

        // Nếu không phải trang chủ hoặc đang mở overlay thì không render
        if (!isHome || isOverlayOpen) return null;

        // Parse branch settings to get specific hotline
        const branchSettings = useMemo(() => {
                try {
                        if (!selectedBranch?.settings) return {};
                        return JSON.parse(selectedBranch.settings);
                } catch (e) {
                        return {};
                }
        }, [selectedBranch]);

        const handleQuickBook = () => {
                const params = new URLSearchParams(searchParams.toString());
                router.push(`/booking${params.toString() ? `?${params.toString()}` : ''}`);
        };

        const hotline = branchSettings.hotline || selectedBranch?.phone || '0366431179';
        const zaloPhone = hotline.replace(/\./g, '').replace(/\s/g, '');

        return (
                <div className="fixed bottom-6 right-6 z-[40] flex flex-col gap-4 items-end">
                        <AnimatePresence>
                                {/* 1. NÚT ĐẶT VÉ (Luôn hiện ở Trang chủ) */}
                                <motion.button
                                        key="book-fab"
                                        onClick={handleQuickBook}
                                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.5, y: 20 }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-[0_8px_30px_rgb(59,130,246,0.5)] border-2 border-white/30 relative overflow-hidden"
                                >
                                        <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="absolute inset-0 bg-white/20"
                                        />
                                        <Ticket className="w-7 h-7 relative z-10" />
                                </motion.button>

                                {/* 2. CỤM NÚT LIÊN HỆ (Thu gọn/Mở rộng) */}
                                <div className="relative flex flex-col items-end gap-3">
                                        {/* Các nút con hiện ra khi bấm mở rộng */}
                                        <AnimatePresence>
                                                {isExpanded && (
                                                        <motion.div
                                                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                                                className="flex flex-col gap-3 mb-1"
                                                        >
                                                                {/* Nút Zalo */}
                                                                <motion.a
                                                                        href={`https://zalo.me/${zaloPhone}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        whileHover={{ scale: 1.1 }}
                                                                        whileTap={{ scale: 0.9 }}
                                                                        className="w-12 h-12 rounded-full bg-[#0068ff] text-white flex items-center justify-center shadow-lg border border-white/20"
                                                                        title="Chat Zalo"
                                                                >
                                                                        <MessageCircle className="w-6 h-6" />
                                                                </motion.a>

                                                                {/* Nút Hotline */}
                                                                <motion.a
                                                                        href={`tel:${hotline}`}
                                                                        whileHover={{ scale: 1.1 }}
                                                                        whileTap={{ scale: 0.9 }}
                                                                        className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border border-white/20"
                                                                        title="Gọi Hotline"
                                                                >
                                                                        <Phone className="w-6 h-6" />
                                                                </motion.a>
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
                                                className={cn(
                                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-white/20 transition-colors duration-300",
                                                        isExpanded ? "bg-gray-800 text-white" : "bg-white/10 backdrop-blur-md text-white"
                                                )}
                                        >
                                                {isExpanded ? <X className="w-6 h-6" /> : <Headset className="w-6 h-6" />}
                                        </motion.button>
                                </div>
                        </AnimatePresence>
                </div>
        );
}
