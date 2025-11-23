import { Globe, Zap, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const technologies = [
  {
    icon: Globe,
    title: "Màn hình 4 chiều độ phân giải 10k",
    description: "Bao trùm thị giác, loại bỏ mọi giới hạn không gian, trải nghiệm đắm chìm vào không gian ảo.",
    color: "from-blue-400 to-blue-600",
  },
  {
    icon: Zap,
    title: "Cảm Biến Chuyển Động",
    description: "Ghế rung lắc đa chiều đồng bộ hoàn hảo với từng khung hình.",
    color: "from-orange-400 to-yellow-500",
  },
  {
    icon: Trophy,
    title: "Hiệu Ứng Môi Trường",
    description: "Cảm nhận gió, mưa, mùi hương và nhiệt độ thực tế.",
    color: "from-gray-400 to-gray-600",
  },
];

export default function TechnologyBanner() {
  return (
    <section id="technology" className="py-20 bg-gradient-section relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent mb-4">
            CINESPHERE – Giải trí công nghệ cao
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            CINESPHERE là thương hiệu tiên phong trong lĩnh vực giải trí công nghệ cao tại Việt Nam, nổi bật với mô hình 3D mắt thường đầu tiên – mang đến trải nghiệm hình ảnh sống động, chân thực mà không cần kính hỗ trợ. Đây là bước đột phá giúp khán giả tiếp cận công nghệ thị giác hiện đại một cách tự nhiên và thoải mái.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {technologies.map((tech, index) => {
            const Icon = tech.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-2"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${tech.color} flex items-center justify-center mb-6 mx-auto shadow-lg`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 text-center">
                  {tech.title}
                </h3>
                <p className="text-gray-400 text-center leading-relaxed">{tech.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
