import { Globe, Zap, Trophy, Film, Rocket } from "lucide-react";
import { motion } from "framer-motion";

const technologies = [
  {
    icon: Globe,
    title: "Hệ Thống Đa Màn Hình Bao Quanh 360°",
    points: [
      "Tái hiện chân thực từ vũ trụ đến thành phố tương lai",
      "Phòng chiếu hình cầu bao phủ toàn cảnh",
      "Âm thanh vòm Dolby Atmos 64 kênh",
    ],
    color: "from-blue-400 to-blue-600",
  },
  {
    icon: Zap,
    title: "Công Nghệ Hiển Thị 8K+ Độc Quyền",
    points: [
      "Độ phân giải gấp 16 lần 4K",
      "Hỗ trợ nội dung CG 8K chất lượng studio",
      "Màu sắc chuẩn DCI-P3, độ sâu 12-bit",
    ],
    color: "from-cyan-400 to-indigo-600",
  },
  {
    icon: Rocket,
    title: "Trải Nghiệm Chuyển Cảnh Tức Thời",
    points: [
      "Chuyển đổi không gian trong 0.5 giây",
      "Hiệu ứng chuyển động mượt 120fps",
      "Cảm biến chuyển động toàn thân",
    ],
    color: "from-orange-400 to-yellow-500",
  },
  {
    icon: Film,
    title: "Studio Nội Dung Sáng Tạo",
    points: [
      "Hệ thống quay phim tích hợp 8K",
      "Chỉnh sửa thời gian thực",
      "Xuất bản trực tiếp TikTok/YouTube",
    ],
    color: "from-gray-400 to-gray-600",
  },
];

export default function TechnologyBanner() {
  return (
    <section
      id="technology"
      className="py-24 bg-gradient-section relative overflow-hidden"
    >
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Chạm tới Vô Cực cùng Vũ Trụ Đa Chiều 8K
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
            Chào mừng đến với Huyễn Cảnh Không Gian – không gian giải trí công nghệ cao đưa bạn du hành qua nhiều chiều không gian với trải nghiệm thị giác đa chiều.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {technologies.map((tech, index) => {
            const Icon = tech.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-black/40 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-white/10 hover:border-white/30 transition-all duration-200 hover:shadow-lg"
              >
                <div
                  className={`w-16 h-16 rounded-full bg-gradient-to-br ${tech.color} flex items-center justify-center mb-6 mx-auto shadow-lg`}
                >
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-3 text-center">
                  {tech.title}
                </h3>
                <ul className="space-y-2 text-gray-300 text-sm md:text-base">
                  {(tech as any).points.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60 mt-2" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
