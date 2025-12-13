import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  ArrowUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 0) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-gradient-to-b from-[#060915] to-black border-t border-white/10 py-16 overflow-hidden">
      <div className="absolute inset-0 neon-noise opacity-30 pointer-events-none" />
      <div className="absolute left-0 top-0 w-96 h-96 bg-purple-500/10 blur-[120px]" />
      <div className="absolute right-0 bottom-0 w-96 h-96 bg-cyan-500/10 blur-[120px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-3xl font-extrabold mb-4">
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                CINESPHERE
              </span>
            </h3>
            <p className="text-gray-300 mb-6 leading-relaxed text-sm">
              Phòng chiếu phim 8K công nghệ cao, mang đến trải nghiệm giải trí
              đa giác quan chân thực nhất.
            </p>
            <div className="flex gap-4">
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300"
              >
                <Facebook className="h-5 w-5 text-white" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-pink-400 hover:bg-pink-500/20 transition-all duration-300"
              >
                <Instagram className="h-5 w-5 text-white" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-red-400 hover:bg-red-500/20 transition-all duration-300"
              >
                <Youtube className="h-5 w-5 text-white" />
              </motion.a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                LIÊN HỆ HỖ TRỢ
              </span>
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/30 transition-colors">
                  <MapPin className="h-5 w-5 text-red-400" />
                </div>
                <div className="text-gray-300 text-sm">
                  <p className="font-semibold text-white mb-1">
                    Công ty TNHH CÔNG NGHỆ VR VIỆT NAM
                  </p>
                  <p className="text-xs leading-relaxed">
                    Số 14/13/58 Thân Nhân Trung, Phường Tân Bình, Thành phố Hồ Chí Minh, Việt Nam
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/30 transition-colors">
                  <Phone className="h-5 w-5 text-cyan-400" />
                </div>
                <a
                  href="tel:0366431179"
                  className="text-gray-300 hover:text-cyan-400 transition-colors font-medium text-sm"
                >
                  036.6431.179
                </a>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <Mail className="h-5 w-5 text-purple-400" />
                </div>
                <a
                  href="mailto:cinesphere0629@gmail.com"
                  className="text-gray-300 hover:text-purple-400 transition-colors font-medium text-sm break-all"
                >
                  cinesphere0629@gmail.com
                </a>
              </div>
            </div>
          </motion.div>

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
            <div className="relative w-full h-64 rounded-lg overflow-hidden border border-white/20 shadow-lg">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  "Số 14/13/58 Thân Nhân Trung, Phường Tân Bình, Thành phố Hồ Chí Minh, Việt Nam"
                )}&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full"
                title="Vị trí CINESPHERE"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </motion.div>

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
              <div>
                <p className="font-semibold text-white mb-1">Tên đại diện:</p>
                <p className="text-xs">TRẦN THỊ THUỲ DƯƠNG</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Số ĐKKD:</p>
                <p className="text-xs">0319157654</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Cấp tại:</p>
                <p className="text-xs">Phòng ĐKKD Sở KH&ĐT Tp. HCM (Thuế cơ sở 16 Thành phố Hồ Chí Minh)</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Đăng ký lần đầu:</p>
                <p className="text-xs">16 tháng 09 năm 2025</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Đăng ký thay đổi lần thứ 1:</p>
                <p className="text-xs">10 tháng 12 năm 2025</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2025 CINESPHERE. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {isVisible && (
          <motion.button
            onClick={scrollToTop}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 transition-colors z-50 shadow-lg"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5 text-cyan-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}
