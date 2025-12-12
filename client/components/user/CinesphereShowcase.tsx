import { motion } from "framer-motion";
import { Film, Sparkles, Smartphone, FastForward } from "lucide-react";

const highlights = [
  {
    icon: Sparkles,
    title: "Đắm chìm 360° không giới hạn",
    description:
      "Màn hình bao quanh, ánh sáng và chiều sâu tái hiện vũ trụ, đại dương, thành phố tương lai ngay trước mắt.",
  },
  {
    icon: Film,
    title: "Siêu định dạng 8K + 8K",
    description:
      "Khung hình siêu phân giải nổi khối, màu sắc chuẩn điện ảnh – hoàn toàn không cần đeo kính hỗ trợ.",
  },
  {
    icon: FastForward,
    title: "Xuyên không trong chớp mắt",
    description:
      "Chạm nhẹ để đổi bối cảnh tức thì, mượt mà từ rừng nguyên sinh sang dải ngân hà với cảm giác chân thực.",
  },
  {
    icon: Smartphone,
    title: "Thánh địa check-in nghệ thuật",
    description:
      "Mỗi góc đều là khung phim điện ảnh, sẵn sàng cho vlog, TikTok triệu view và bộ ảnh ảo diệu của bạn.",
  },
];

const gallery = [
  {
    src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    title: "Không gian sci-fi CineSphere",
    description: "Hành lang ánh sáng và màn hình tương tác đa chiều.",
  },
  {
    src: "https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=1600&q=80",
    title: "Khán giả giữa đại dương ánh sáng",
    description: "Đắm chìm trong bối cảnh biển sâu và sinh vật ảo diệu.",
  },
  {
    src: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
    title: "Khủng long sát cạnh",
    description: "Cảnh rừng nguyên sinh, quy mô lớn như chạm tay tới.",
  },
  {
    src: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?auto=format&fit=crop&w=1600&q=80",
    title: "Phòng chiếu toàn cảnh",
    description: "Khán giả ngồi giữa khung hình 8K bao phủ trọn không gian.",
  },
];

export default function CinesphereShowcase() {
  return (
    <section
      id="cinesphere"
      className="relative py-24 bg-gradient-to-b from-[#060915] via-[#0b1426] to-[#0f1d3a] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-72 h-72 bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-0 bottom-10 w-80 h-80 bg-purple-500/20 blur-[130px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <p className="text-sm uppercase tracking-[0.28em] text-cyan-200">
              CineSphere Experience
            </p>
            <h2 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
              Chạm tới Vô Cực cùng Vũ Trụ Đa Chiều 8K
            </h2>
            <p className="text-lg text-gray-200 leading-relaxed">
              Bước vào Huyễn Cảnh Không Gian, bạn đứng giữa những khung hình sống
              động: đại dương phát sáng, rừng khủng long, hành lang tàu điện ngầm hay
              thành phố tương lai. Đây không chỉ là phòng chiếu, mà là “cánh cửa đa
              chiều” mở ra thế giới mà mắt thường chưa từng thấy.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {highlights.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-cyan-300/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-300/30">
                        <Icon className="h-5 w-5 text-cyan-200" />
                      </div>
                      <p className="text-white font-semibold">{item.title}</p>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {item.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="grid sm:grid-cols-2 gap-4"
          >
            {gallery.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group"
              >
                <img
                  src={item.src}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                  <p className="text-white font-semibold">{item.title}</p>
                  <p className="text-sm text-gray-200">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

