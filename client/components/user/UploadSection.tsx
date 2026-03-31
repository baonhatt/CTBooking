import { UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

const UploadCard = ({ title, description }: { title: string; description: string }) => (
  <label className="group relative flex-1 cursor-pointer min-h-[180px] rounded-3xl border border-dashed border-cyan-300/40 bg-white/5 backdrop-blur-lg p-6 transition-all duration-300 hover:border-fuchsia-400 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(236,72,153,0.25)]">
    <input type="file" className="hidden" />
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" />
    <div className="relative z-10 flex flex-col items-start gap-3 text-left">
      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
        <UploadCloud className="h-5 w-5 text-cyan-200" />
      </div>
      <div>
        <p className="text-white font-semibold text-lg">{title}</p>
        <p className="text-sm text-gray-200">{description}</p>
      </div>
      <span className="text-xs text-cyan-200 uppercase tracking-[0.18em]">Click để tải lên</span>
    </div>
  </label>
);

export default function UploadSection() {
  return (
    <section
      id="upload"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0a1224] to-[#0e1b3d] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise pointer-events-none opacity-60" />
      <div className="absolute -left-12 top-10 w-80 h-80 bg-cyan-500/14 blur-[120px]" />
      <div className="absolute right-0 bottom-0 w-96 h-96 bg-fuchsia-500/12 blur-[130px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-200">Cá nhân hoá</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Ghép hình vũ trụ & nhân vật của bạn</h2>
          <p className="text-gray-300 mt-3">
            Tải lên hình nền vũ trụ hoặc hình người để xem trước trong mô hình VR của CINESPHERE.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-10">
          <UploadCard title="Chọn hình ảnh vũ trụ" description="Nebula, hành tinh mờ, photon particles..." />
          <UploadCard
            title="Chèn hình ảnh người ngồi trong mô hình"
            description="Xem trước trải nghiệm nhập vai cùng bạn bè."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((box, index) => (
            <motion.div
              key={box}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="aspect-video rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg flex items-center justify-center text-gray-200 text-sm"
            >
              VR preview {box}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
