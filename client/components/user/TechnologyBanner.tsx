import { motion, AnimatePresence } from "framer-motion";
import { Film, Sparkles, Smartphone, FastForward, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Decorative space elements
const spaceElements = [
  { id: 1, size: "w-32 h-32", position: "top-20 left-4", delay: 0, duration: 8 },
  { id: 2, size: "w-24 h-24", position: "top-40 left-8", delay: 1, duration: 10 },
  { id: 3, size: "w-20 h-20", position: "top-60 left-12", delay: 2, duration: 12 },
  { id: 4, size: "w-28 h-28", position: "top-80 left-6", delay: 0.5, duration: 9 },
  { id: 5, size: "w-36 h-36", position: "top-20 right-4", delay: 1.5, duration: 11 },
  { id: 6, size: "w-24 h-24", position: "top-40 right-8", delay: 2.5, duration: 13 },
  { id: 7, size: "w-20 h-20", position: "top-60 right-12", delay: 0.8, duration: 10 },
  { id: 8, size: "w-32 h-32", position: "top-80 right-6", delay: 1.2, duration: 9 },
];

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slidesToShow, setSlidesToShow] = useState(4);
  
  // Responsive slides to show
  useEffect(() => {
    const updateSlidesToShow = () => {
      if (window.innerWidth >= 1024) {
        setSlidesToShow(4); // lg: 4 cards
      } else if (window.innerWidth >= 640) {
        setSlidesToShow(2); // sm: 2 cards
      } else {
        setSlidesToShow(1); // mobile: 1 card
      }
    };
    
    updateSlidesToShow();
    window.addEventListener("resize", updateSlidesToShow);
    return () => window.removeEventListener("resize", updateSlidesToShow);
  }, []);
  
  const maxIndex = Math.max(0, videoPreviews.length - slidesToShow);
  
  const nextSlide = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, maxIndex));
  };
  
  const prevSlide = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <section
      id="technology"
      className="relative py-24 bg-gradient-to-b from-[#060915] via-[#0b1426] to-[#0f1d3a] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-72 h-72 bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-0 bottom-10 w-80 h-80 bg-purple-500/20 blur-[130px]" />

      {/* Decorative Space Elements - Left Side */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        {spaceElements.slice(0, 4).map((element) => (
          <motion.div
            key={`left-${element.id}`}
            className={`absolute ${element.position} ${element.size} opacity-30`}
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0],
              rotate: [0, 180, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: element.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: element.delay,
            }}
          >
            {/* Planet/Celestial Body */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-purple-500/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent)]" />
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/60 rounded-full blur-sm" />
              <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-white/40 rounded-full blur-sm" />
              {/* Rings for some planets */}
              {element.id % 2 === 0 && (
                <div className="absolute inset-0 border-2 border-cyan-300/20 rounded-full" style={{ transform: 'scale(1.2)' }} />
              )}
            </div>
          </motion.div>
        ))}

        {/* Stars/Sparkles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`star-left-${i}`}
            className="absolute w-1 h-1 bg-cyan-300 rounded-full"
            style={{
              left: `${5 + (i % 4) * 3}%`,
              top: `${20 + Math.floor(i / 4) * 25}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Decorative Space Elements - Right Side */}
        {spaceElements.slice(4, 8).map((element) => (
          <motion.div
            key={`right-${element.id}`}
            className={`absolute ${element.position} ${element.size} opacity-30`}
            animate={{
              y: [0, -20, 0],
              x: [0, -10, 0],
              rotate: [0, -180, -360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: element.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: element.delay,
            }}
          >
            {/* Planet/Celestial Body */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-400/40 via-pink-500/30 to-fuchsia-500/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent)]" />
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/60 rounded-full blur-sm" />
              <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-white/40 rounded-full blur-sm" />
              {/* Rings for some planets */}
              {element.id % 2 === 1 && (
                <div className="absolute inset-0 border-2 border-purple-300/20 rounded-full" style={{ transform: 'scale(1.2)' }} />
              )}
            </div>
          </motion.div>
        ))}

        {/* Stars/Sparkles - Right Side */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`star-right-${i}`}
            className="absolute w-1 h-1 bg-purple-300 rounded-full"
            style={{
              right: `${5 + (i % 4) * 3}%`,
              top: `${20 + Math.floor(i / 4) * 25}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Nebula/Cloud Effects */}
        <motion.div
          className="absolute top-1/4 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/3 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

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

        {/* Main Content Section: Video on top, Text below */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto mb-16"
        >
          {/* Main Video/Image */}
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden border border-white/10 bg-white/5 group shadow-2xl mb-10">
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

          {/* Text Content Below Video */}
          <div className="space-y-8">
            <div>
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center">
                ✨ Tại sao bạn không nên bỏ lỡ?
              </h3>
              <div className="space-y-4 max-w-4xl mx-auto">
                <p className="text-lg text-gray-300 leading-relaxed">
                  <strong className="text-white">Trải Nghiệm Đắm Chìm Không Giới Hạn:</strong> Với hệ thống màn hình đa diện bao quanh, chúng tôi tái tạo những khung cảnh vĩ đại, từ sự tĩnh lặng của vũ trụ bao la đến nhịp sống sôi động của những thành phố tương lai, tất cả gói gọn trong một không gian tinh tế.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  <strong className="text-white">Siêu Định Dạng 8K+8K:</strong> Hãy chuẩn bị để ngỡ ngàng trước những thước phim CG siêu phân giải 8K. Mọi chi tiết đều chân thực đến mức khó tin, cho phép bạn đắm mình vào cảnh vật mà không cần đeo bất kỳ thiết bị hỗ trợ nào.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  <strong className="text-white">Xuyên Không Trong Chớp Mắt:</strong> Chỉ một cái chạm, bối cảnh sẽ thay đổi tức thì. Bạn có thể đang dạo bước giữa rừng nguyên sinh rồi ngay lập tức lao vút qua những thiên hà xa xôi với tốc độ và cảm giác chân thực tuyệt đối.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  <strong className="text-white">Thánh Địa "Check-in" Nghệ Thuật:</strong> Không chỉ để xem, Huyễn Cảnh Không Gian còn là studio hoàn hảo để bạn sở hữu những thước phim TikTok "triệu view" hay những bức ảnh nghệ thuật đầy ảo diệu, khẳng định phong cách riêng trên mạng xã hội.
                </p>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {highlights.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md hover:border-cyan-300/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20"
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-300/30">
                        <Icon className="h-6 w-6 text-cyan-200" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm mb-2">
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

        {/* Video Preview Gallery - Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
            Khám phá không gian CineSphere
          </h3>
          
          <div className="relative">
            {/* Carousel Container */}
            <div className="relative overflow-hidden rounded-2xl">
              <motion.div
                className="flex gap-6"
                animate={{
                  x: `-${currentIndex * (100 / slidesToShow)}%`,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
                style={{
                  width: `${videoPreviews.length * (100 / slidesToShow)}%`,
                }}
              >
                {videoPreviews.map((item, index) => (
                  <div
                    key={item.title}
                    className="relative flex-shrink-0"
                    style={{
                      width: `${100 / slidesToShow}%`,
                      paddingRight: index < videoPreviews.length - 1 ? "1.5rem" : "0",
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
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
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Navigation Buttons */}
            {maxIndex > 0 && (
              <>
                <button
                  onClick={prevSlide}
                  disabled={currentIndex === 0}
                  className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 transition-all duration-300 shadow-lg",
                    currentIndex === 0 && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </button>
                <button
                  onClick={nextSlide}
                  disabled={currentIndex >= maxIndex}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 transition-all duration-300 shadow-lg",
                    currentIndex >= maxIndex && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </button>
              </>
            )}

            {/* Dots Indicator */}
            {maxIndex > 0 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      currentIndex === index
                        ? "bg-cyan-400 w-8"
                        : "bg-white/30 hover:bg-white/50"
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

