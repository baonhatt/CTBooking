import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  ArrowUp,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-gradient-to-b from-[#060915] to-black border-t border-white/10 py-16 overflow-hidden">
      <div className="absolute inset-0 neon-noise opacity-30 pointer-events-none" />
      <div className="absolute left-0 top-0 w-96 h-96 bg-purple-500/10 blur-[120px]" />
      <div className="absolute right-0 bottom-0 w-96 h-96 bg-cyan-500/10 blur-[120px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
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
            <p className="text-gray-300 mb-6 leading-relaxed">
              Phòng chiếu phim 6D công nghệ cao, mang đến trải nghiệm giải trí
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
                ĐỊA CHỈ
              </span>
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/30 transition-colors">
                  <MapPin className="h-5 w-5 text-red-400" />
                </div>
                <div className="text-gray-300">
                  <p className="font-semibold text-white mb-1">
                    Gian hàng CINESPHERE
                  </p>
                  <p className="text-sm">Tầng 4, TTMT Vạn Hạnh Mall</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/30 transition-colors">
                  <Phone className="h-5 w-5 text-cyan-400" />
                </div>
                <a
                  href="tel:+84123456789"
                  className="text-gray-300 hover:text-cyan-400 transition-colors font-medium"
                >
                  +84 123 456 789
                </a>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/30 transition-colors">
                  <Mail className="h-5 w-5 text-purple-400" />
                </div>
                <a
                  href="mailto:info@cinesphere.vn"
                  className="text-gray-300 hover:text-purple-400 transition-colors font-medium"
                >
                  info@cinesphere.vn
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
                KẾT NỐI
              </span>
            </h4>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.1, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold hover:border-blue-400 hover:bg-blue-500/20 transition-all duration-300 shadow-lg hover:shadow-blue-500/50"
              >
                FB
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold hover:border-pink-400 hover:bg-pink-500/20 transition-all duration-300 shadow-lg hover:shadow-pink-500/50"
              >
                IG
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold hover:border-red-400 hover:bg-red-500/20 transition-all duration-300 shadow-lg hover:shadow-red-500/50"
              >
                YT
              </motion.button>
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
      <motion.button
        onClick={scrollToTop}
        whileHover={{ scale: 1.1, y: -5 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 transition-colors z-50 shadow-lg"
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5 text-cyan-400" />
      </motion.button>
    </footer>
  );
}
