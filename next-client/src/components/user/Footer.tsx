'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, MapPin, Phone, Mail, Facebook, Building2 } from 'lucide-react';
import { useBranch } from '@/hooks/useBranch';

export default function Footer() {
        const [isVisible, setIsVisible] = useState(false);
        const [loadMap, setLoadMap] = useState(false);
        const mapContainerRef = useRef<HTMLDivElement>(null);
        const { selectedBranch } = useBranch();

        // Parse branch settings
        const branchSettings = useMemo(() => {
                try {
                        if (!selectedBranch?.settings) return {};
                        return JSON.parse(selectedBranch.settings);
                } catch (e) {
                        return {};
                }
        }, [selectedBranch]);

        // Determine the map src for the iframe
        const mapSrc = useMemo(() => {
                const mapCoords = branchSettings.map_coords?.trim();
                const mapQuery = branchSettings.map_query?.trim();

                // 1. If mapCoords is coordinates "lat,lng" (e.g. "10.7705748, 106.6699228")
                const coordMatch = mapCoords?.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
                if (coordMatch) {
                        return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&hl=vi&z=16&output=embed`;
                }

                // 2. If it's a full Google Maps place/dir URL containing /place/ or !3d / !4d
                if (mapCoords && mapCoords.includes('google.com/maps')) {
                        const placeMatch = mapCoords.match(/\/place\/([^\/\?]+)/);
                        if (placeMatch) {
                                return `https://maps.google.com/maps?q=${placeMatch[1]}&hl=vi&z=16&output=embed`;
                        }
                        const latMatch = mapCoords.match(/!3d(-?\d+\.\d+)/);
                        const lngMatch = mapCoords.match(/!4d(-?\d+\.\d+)/);
                        if (latMatch && lngMatch) {
                                return `https://maps.google.com/maps?q=${latMatch[1]},${lngMatch[1]}&hl=vi&z=16&output=embed`;
                        }
                }

                // 3. If it's already an embed link
                if (mapCoords && (mapCoords.includes('output=embed') || mapCoords.includes('/embed'))) {
                        return mapCoords;
                }

                // 4. If mapQuery is provided and is NOT a URL, use it
                if (mapQuery && !mapQuery.startsWith('http://') && !mapQuery.startsWith('https://')) {
                        return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=vi&z=16&output=embed`;
                }

                // 5. Fallback sequence: Address + Branch Name -> Address -> Branch Name
                const address = selectedBranch?.address?.trim();
                const branchName = selectedBranch?.name?.trim();
                const fallbackQuery = address && branchName
                        ? `${address}, ${branchName}`
                        : (address || branchName || 'Vạn Hạnh Mall, số 11 đường Sư Vạn Hạnh, Quận 10, Thành phố Hồ Chí Minh');

                return `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&hl=vi&z=16&output=embed`;
        }, [branchSettings, selectedBranch]);

        useEffect(() => {
                const setIsScrolled = (v: boolean) => setIsVisible(v);
                const handler = () => setIsScrolled(window.scrollY > 0);
                window.addEventListener('scroll', handler, { passive: true });
                return () => window.removeEventListener('scroll', handler);
        }, []);

        useEffect(() => {
                if (!mapContainerRef.current) return;
                const observer = new IntersectionObserver(
                        (entries) => {
                                if (entries[0]?.isIntersecting) {
                                        setLoadMap(true);
                                        observer.disconnect();
                                }
                        },
                        { rootMargin: '300px' }
                );
                observer.observe(mapContainerRef.current);
                return () => observer.disconnect();
        }, []);

        return (
                <footer className="relative bg-gradient-to-b from-[#060915] to-black border-t border-white/10 py-10 md:py-16 overflow-hidden">
                        <div className="absolute inset-0 neon-noise opacity-30 pointer-events-none" />
                        <div className="hidden sm:block absolute left-0 top-0 w-96 h-96 bg-purple-500/10 blur-[120px]" />
                        <div className="hidden sm:block absolute right-0 bottom-0 w-96 h-96 bg-cyan-500/10 blur-[120px]" />

                        <div className="container mx-auto px-4 relative z-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                                        {/* Brand */}
                                        <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.6 }}
                                        >
                                                <h3 className="text-2xl md:text-3xl font-extrabold mb-4">
                                                        <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                                                                CINESPHERE
                                                        </span>
                                                </h3>
                                                <p className="text-gray-300 mb-6 leading-relaxed text-sm">
                                                        Phòng chiếu phim 8K công nghệ cao, mang đến trải nghiệm giải trí đa giác quan chân thực nhất.
                                                </p>
                                                <div className="flex gap-4">
                                                        <motion.a
                                                                href="https://www.facebook.com/profile.php?id=61584627810337"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                whileHover={{ scale: 1.1, y: -5 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300"
                                                                aria-label="Theo dõi chúng tôi trên Facebook"
                                                        >
                                                                <Facebook className="h-5 w-5 text-white" />
                                                        </motion.a>
                                                        <motion.a
                                                                href="https://www.tiktok.com/@cinesphere.vn"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                whileHover={{ scale: 1.1, y: -5 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300"
                                                                aria-label="Theo dõi chúng tôi trên TikTok"
                                                        >
                                                                <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        width="24"
                                                                        height="24"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        className="h-5 w-5 text-white"
                                                                >
                                                                        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                                                                </svg>
                                                        </motion.a>
                                                </div>
                                        </motion.div>

                                        {/* Contact */}
                                        <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.6, delay: 0.1 }}
                                        >
                                                <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                                                LIÊN HỆ HỖ TRỢ KHÁCH HÀNG
                                                        </span>
                                                </h4>
                                                <div className="space-y-4">
                                                        {(branchSettings.company_name || (!selectedBranch?.settings && selectedBranch?.name)) && (
                                                                <div className="flex items-start gap-4 group">
                                                                        <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/30 transition-colors">
                                                                                <Building2 className="h-5 w-5 text-red-400" />
                                                                        </div>
                                                                        <div className="text-gray-300 text-sm">
                                                                                <p className="font-semibold text-white mb-1 uppercase">
                                                                                        {branchSettings.company_name || 'Công ty TNHH CÔNG NGHỆ VR VIỆT NAM'}
                                                                                </p>
                                                                                <p className="text-xs leading-relaxed">
                                                                                        {branchSettings.company_address || 'Vạn Hạnh Mall, số 11 đường Sư Vạn Hạnh, Quận 10, Thành phố Hồ Chí Minh'}
                                                                                </p>
                                                                        </div>
                                                                </div>
                                                        )}

                                                        {(branchSettings.hotline || selectedBranch?.phone || (!selectedBranch?.settings && selectedBranch?.id)) && (
                                                                <div className="flex items-center gap-4 group">
                                                                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/30 transition-colors">
                                                                                <Phone className="h-5 w-5 text-cyan-400" />
                                                                        </div>
                                                                        <a
                                                                                href={`tel:${branchSettings.hotline || selectedBranch?.phone || '0366431179'}`}
                                                                                className="text-gray-300 hover:text-cyan-400 transition-colors font-medium text-sm"
                                                                        >
                                                                                {branchSettings.hotline || selectedBranch?.phone || '036.6431.179'}
                                                                        </a>
                                                                </div>
                                                        )}

                                                        {(selectedBranch?.email || (!selectedBranch?.settings && selectedBranch?.id)) && (
                                                                <div className="flex items-center gap-4 group">
                                                                        <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                                                                                <Mail className="h-5 w-5 text-purple-400" />
                                                                        </div>
                                                                        <a
                                                                                href={`mailto:${selectedBranch?.email || 'cinesphere0629@gmail.com'}`}
                                                                                className="text-gray-300 hover:text-purple-400 transition-colors font-medium text-sm break-all"
                                                                        >
                                                                                {selectedBranch?.email || 'cinesphere0629@gmail.com'}
                                                                        </a>
                                                                </div>
                                                        )}
                                                </div>
                                        </motion.div>

                                        {/* Map */}
                                        <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.6, delay: 0.2 }}
                                        >
                                                <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                                        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                                                VỊ TRÍ RẠP
                                                        </span>
                                                </h4>
                                                <div ref={mapContainerRef} className="relative w-full h-64 rounded-lg overflow-hidden border border-white/20 shadow-lg bg-white/5">
                                                        {loadMap ? (
                                                                <iframe
                                                                        src={mapSrc}
                                                                        width="100%"
                                                                        height="100%"
                                                                        style={{ border: 0 }}
                                                                        allowFullScreen
                                                                        loading="lazy"
                                                                        referrerPolicy="no-referrer-when-downgrade"
                                                                        className="w-full h-full"
                                                                        title={`Vị trí ${selectedBranch?.name || 'CINESPHERE'}`}
                                                                />
                                                        ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                                                        Đang tải bản đồ...
                                                                </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                                </div>
                                        </motion.div>

                                        {/* Company Info */}
                                        <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 0.6, delay: 0.3 }}
                                        >
                                                <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                                        <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                                                THÔNG TIN CÔNG TY
                                                        </span>
                                                </h4>
                                                <div className="space-y-3 text-gray-300 text-sm">
                                                        {/* Render dynamic extra info if value exists */}
                                                        {branchSettings.extra_info?.filter((info: any) => info.value && info.value.trim() !== '').map((info: any, idx: number) => (
                                                                <div key={idx}>
                                                                        <p className="font-semibold text-white mb-1">{info.label}:</p>
                                                                        <p className="text-xs uppercase">{info.value}</p>
                                                                </div>
                                                        ))}

                                                        {/* Fallback if no dynamic info is provided yet */}
                                                        {(!branchSettings.extra_info || branchSettings.extra_info.filter((info: any) => info.value).length === 0) && !selectedBranch?.settings && (
                                                                <>
                                                                        <div>
                                                                                <p className="font-semibold text-white mb-1">Tên đại diện:</p>
                                                                                <p className="text-xs uppercase">TRẦN THỊ THUỲ DƯƠNG</p>
                                                                        </div>
                                                                        <div>
                                                                                <p className="font-semibold text-white mb-1">Số ĐKKD:</p>
                                                                                <p className="text-xs">0319157654</p>
                                                                        </div>
                                                                        <div>
                                                                                <p className="font-semibold text-white mb-1">Cấp tại:</p>
                                                                                <p className="text-xs">Phòng ĐKKD Sở KH&ĐT Tp. HCM</p>
                                                                        </div>
                                                                </>
                                                        )}
                                                </div>
                                        </motion.div>
                                </div>

                                <div className="border-t border-white/10 pt-8 text-center">
                                        <p className="text-gray-400 text-sm">© {new Date().getFullYear()} {'CINESPHERE'}. Tất cả quyền được bảo lưu.</p>
                                </div>
                        </div>
                </footer>
        );
}
