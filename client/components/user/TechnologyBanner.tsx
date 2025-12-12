import { motion } from "framer-motion";
import { Film, Sparkles, Smartphone, FastForward, Play } from "lucide-react";
import { useState } from "react";

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

// Video previews - có thể thay đổi URL video tại đây
const videoPreviews = [
  {
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Video mẫu - thay bằng video thực tế
    thumbnail: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
    title: "Không gian sci-fi CineSphere",
    description: "Hành lang ánh sáng và màn hình tương tác đa chiều.",
    duration: "2:15",
  },
  {
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=800&q=80",
    title: "Khán giả giữa đại dương ánh sáng",
    description: "Đắm chìm trong bối cảnh biển sâu và sinh vật ảo diệu.",
    duration: "1:45",
  },
  {
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80",
    title: "Khủng long sát cạnh",
    description: "Cảnh rừng nguyên sinh, quy mô lớn như chạm tay tới.",
    duration: "3:20",
  },
  {
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?auto=format&fit=crop&w=800&q=80",
    title: "Phòng chiếu toàn cảnh",
    description: "Khán giả ngồi giữa khung hình 8K bao phủ trọn không gian.",
    duration: "2:50",
  },
];

// Video/Hình ảnh chính bên trái
const mainVisual = {
  type: "video" as const, // "video" hoặc "image"
  videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Thêm URL video YouTube/Vimeo tại đây
  thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=80",
  imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=80",
};

export default function TechnologyBanner() {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  return (
    <section
      id="technology"
      className="relative py-24 bg-gradient-to-b from-[#060915] via-[#0b1426] to-[#0f1d3a] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-72 h-72 bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-0 bottom-10 w-80 h-80 bg-purple-500/20 blur-[130px]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-16 max-w-4xl mx-auto"
        >
          <p className="text-sm uppercase tracking-[0.28em] text-cyan-200 mb-4">
            CINESPHERE EXPERIENCE
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6">
            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Chạm tới Vô Cực
            </span>{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              cùng Vũ Trụ Đa Chiều 8K
            </span>
          </h2>
          <p className="text-lg md:text-xl whitespace-break-spaces text-gray-200 leading-relaxed">
            Chào mừng bạn đến với Huyễn Cảnh Không Gian, nơi những giới hạn về vật lý bị xóa nhòa để nhường chỗ cho những trải nghiệm thị giác đỉnh cao. Không đơn thuần là một phòng chiếu phim, đây là "cánh cửa thần kỳ" đưa bạn bước vào những chiều không gian mà thực tại chưa bao giờ chạm tới.
          </p>
        </motion.div>

        {/* Main Content Section: Video/Image Left + Text Right */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid lg:grid-cols-2 gap-10 mb-16 items-center"
        >
          {/* Left: Main Video/Image */}
          <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border border-white/10 bg-white/5 group shadow-2xl">
            {mainVisual.type === "video" && playingVideo === "main" ? (
              <iframe
                src={`${mainVisual.videoUrl}?autoplay=1&rel=0`}
                className="w-full h-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title="CineSphere Experience"
              />
            ) : (
              <>
                <img
                  src={mainVisual.type === "video" ? mainVisual.thumbnail : mainVisual.imageUrl}
                  alt="CineSphere Experience"
                  className="w-full h-full object-cover"
                />
                {mainVisual.type === "video" && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                    <button
                      onClick={() => setPlayingVideo("main")}
                      className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer"
                      aria-label="Play video"
                    >
                      <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-xl">
                        <Play className="h-10 w-10 text-white ml-1" fill="white" />
                      </div>
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right: Detailed Text Content */}
          <div className="space-y-6">
            <div>
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                ✨ Tại sao bạn không nên bỏ lỡ?
              </h3>
              <p className="text-lg text-gray-300 leading-relaxed mb-4">
                Trải Nghiệm Đắm Chìm Không Giới Hạn: Với hệ thống màn hình đa diện bao quanh, chúng tôi tái tạo những khung cảnh vĩ đại, từ sự tĩnh lặng của vũ trụ bao la đến nhịp sống sôi động của những thành phố tương lai, tất cả gói gọn trong một không gian tinh tế.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
               Siêu Định Dạng 8K+8K: Hãy chuẩn bị để ngỡ ngàng trước những thước phim CG siêu phân giải 8K. Mọi chi tiết đều chân thực đến mức khó tin, cho phép bạn đắm mình vào cảnh vật mà không cần đeo bất kỳ thiết bị hỗ trợ nào.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                Xuyên Không Trong Chớp Mắt: Chỉ một cái chạm, bối cảnh sẽ thay đổi tức thì. Bạn có thể đang dạo bước giữa rừng nguyên sinh rồi ngay lập tức lao vút qua những thiên hà xa xôi với tốc độ và cảm giác chân thực tuyệt đối.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                Thánh Địa "Check-in" Nghệ Thuật: Không chỉ để xem, Huyễn Cảnh Không Gian còn là studio hoàn hảo để bạn sở hữu những thước phim TikTok "triệu view" hay những bức ảnh nghệ thuật đầy ảo diệu, khẳng định phong cách riêng trên mạng xã hội.
              </p>
            </div>

            {/* Feature Cards */}
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
                    className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-cyan-300/50 transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-300/30 flex-shrink-0">
                        <Icon className="h-5 w-5 text-cyan-200" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm mb-1">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Video Preview Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
            Khám phá không gian CineSphere
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {videoPreviews.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="relative aspect-[3/4] min-h-[400px] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group cursor-pointer"
              >
                {playingVideo === `preview-${index}` ? (
                  <iframe
                    src={`${item.videoUrl}?autoplay=1&rel=0`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    title={item.title}
                  />
                ) : (
                  <>
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <button
                      onClick={() => setPlayingVideo(`preview-${index}`)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Play ${item.title}`}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30">
                        <Play className="h-8 w-8 text-white ml-1" fill="white" />
                      </div>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white font-semibold text-sm">{item.title}</p>
                        <span className="text-xs text-gray-300 bg-black/50 px-2 py-1 rounded">
                          {item.duration}
                        </span>
                      </div>
                      <p className="text-xs text-gray-200">{item.description}</p>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

