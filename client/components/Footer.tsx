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
    <footer className="bg-black border-t border-white/10 py-12 relative">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-blue-400 mb-4">
              CINESPHERE
            </h3>
            <p className="text-gray-400 mb-4">
              Phòng chiếu phim 6D công nghệ cao, mang đến trải nghiệm giải trí
              đa giác quan chân thực nhất.
            </p>
            <div className="flex gap-4">
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-full bg-black border border-white/20 flex items-center justify-center hover:border-blue-400 transition-colors"
              >
                <Facebook className="h-5 w-5 text-white" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-full bg-black border border-white/20 flex items-center justify-center hover:border-blue-400 transition-colors"
              >
                <Instagram className="h-5 w-5 text-white" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-full bg-black border border-white/20 flex items-center justify-center hover:border-blue-400 transition-colors"
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
            <h4 className="text-xl font-semibold text-white mb-4">ĐỊA CHỈ</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                <div className="text-gray-300">
                  <p className="font-semibold text-white">
                    Gian hàng CINESPHERE
                  </p>
                  <p>Tầng 4, TTMT Vạn Hạnh Mall</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <a
                  href="tel:+84123456789"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  +84 123 456 789
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <a
                  href="mailto:info@cinesphere.vn"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
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
            <h4 className="text-xl font-semibold text-white mb-4">KẾT NỐI</h4>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-black border border-white/20 flex items-center justify-center text-white font-semibold hover:border-blue-400 transition-colors"
              >
                FB
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-black border border-white/20 flex items-center justify-center text-white font-semibold hover:border-blue-400 transition-colors"
              >
                IG
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-black border border-white/20 flex items-center justify-center text-white font-semibold hover:border-blue-400 transition-colors"
              >
                YT
              </motion.button>
            </div>
          </motion.div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 CINESPHERE. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </div>
    </footer>
  );
}
