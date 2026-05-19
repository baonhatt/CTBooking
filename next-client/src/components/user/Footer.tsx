'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, MapPin, Phone, Mail, Facebook } from 'lucide-react';

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const setIsScrolled = (v: boolean) => setIsVisible(v);
    const handler = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <footer className="relative bg-gradient-to-b from-[#060915] to-black border-t border-white/10 py-10 md:py-16 overflow-hidden">
      <div className="absolute left-0 top-0 w-96 h-96 bg-purple-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-96 h-96 bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-extrabold mb-4">
              <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                CINESPHERE
              </span>
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">
              Phòng chiếu phim 8K công nghệ cao, mang đến trải nghiệm giải trí đa giác quan chân thực nhất.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/profile.php?id=61584627810337"
                target="_blank"
                rel="noreferrer"
                className="w-12 h-12 rounded-full bg-white/5 border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300"
                aria-label="Theo dõi chúng tôi trên Facebook"
              >
                <Facebook className="h-5 w-5 text-white" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                LIÊN HỆ HỖ TRỢ
              </span>
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-red-400" />
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Vạn Hạnh Mall, số 11 đường Sư Vạn Hạnh, Quận 10, TP.HCM
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-4 w-4 text-cyan-400" />
                </div>
                <a href="tel:0366431179" className="text-gray-300 hover:text-cyan-400 transition-colors text-sm font-medium">
                  036.6431.179
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-purple-400" />
                </div>
                <a href="mailto:cinesphere0629@gmail.com" className="text-gray-300 hover:text-purple-400 transition-colors text-sm break-all">
                  cinesphere0629@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Map */}
          <div>
            <h4 className="text-lg font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                VỊ TRÍ RẠP
              </span>
            </h4>
            <div className="relative w-full h-48 rounded-lg overflow-hidden border border-white/20">
              <iframe
                src="https://www.google.com/maps?q=V%E1%BA%A1n+H%E1%BA%A1nh+Mall%2C+s%E1%BB%91+11+%C4%91%C6%B0%E1%BB%9Dng+S%C6%B0+V%E1%BA%A1n+H%E1%BA%A1nh%2C+Qu%E1%BA%ADn+10%2C+Th%C3%A0nh+ph%E1%BB%91+H%E1%BB%93+Ch%C3%AD+Minh&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Vị trí CINESPHERE"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-gray-400 text-sm">© 2026 CINESPHERE. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>

      {/* Scroll to top */}
      {isVisible && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-center hover:border-cyan-400 transition-colors z-50 shadow-lg"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5 text-cyan-400" />
        </button>
      )}
    </footer>
  );
}
