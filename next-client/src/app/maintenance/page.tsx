import { Settings, Wrench } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hệ thống đang bảo trì - CineSphere',
<<<<<<< HEAD
  description: 'Hệ thống đang được nâng cấp và bảo trì',
=======
  description: 'Hệ thống đang được nâng cấp và bảo trì'
>>>>>>> preview
};

const Maintenance = () => {
  return (
    <div className="min-h-screen bg-gradient-dark text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-black/40 border border-white/10 rounded-3xl p-10 text-center shadow-2xl backdrop-blur-md">
          <div className="flex justify-center mb-8 relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Settings className="w-12 h-12 text-blue-400 animate-[spin_4s_linear_infinite]" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-pink-400 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
            Hệ thống đang bảo trì
          </h1>

          <p className="text-lg text-gray-300 leading-relaxed mb-8">
<<<<<<< HEAD
            Chúng tôi đang tiến hành nâng cấp và bảo trì hệ thống để mang đến cho bạn trải nghiệm tốt nhất.
            Quá trình này sẽ diễn ra trong thời gian ngắn. Xin lỗi vì sự bất tiện này!
=======
            Chúng tôi đang tiến hành nâng cấp và bảo trì hệ thống để mang đến cho bạn trải nghiệm tốt nhất. Quá trình
            này sẽ diễn ra trong thời gian ngắn. Xin lỗi vì sự bất tiện này!
>>>>>>> preview
          </p>

          <div className="inline-flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              <span>Đang tiến hành cập nhật...</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Vui lòng quay lại sau.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
