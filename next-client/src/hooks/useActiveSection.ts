'use client';
import { useState, useEffect } from 'react';
import { SECTION_IDS } from '@/components/constants';

export function useActiveSection(disabled: boolean) {
  const [activeSection, setActiveSection] = useState<string>('hero');

  useEffect(() => {
    if (disabled) return;

    const determineActiveSection = () => {
      // Nếu đang ở gần đầu trang (Hero)
      if (window.scrollY < 120) {
        setActiveSection('hero');
        return;
      }

      // Điểm mốc phát hiện trong viewport (khoảng 35% từ đỉnh màn hình xuống)
      const viewportTarget = window.innerHeight * 0.35;

      let currentActive = 'hero';

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        // Section đang bao phủ điểm mốc viewportTarget
        if (rect.top <= viewportTarget && rect.bottom > viewportTarget) {
          currentActive = id;
          break;
        }
      }

      setActiveSection(currentActive);
    };

    // Kiểm tra ngay khi mount và sau các khoảng trễ để đảm bảo DOM render xong
    determineActiveSection();
    const t1 = setTimeout(determineActiveSection, 150);
    const t2 = setTimeout(determineActiveSection, 500);
    const t3 = setTimeout(determineActiveSection, 1000);

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          determineActiveSection();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', determineActiveSection, { passive: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', determineActiveSection);
    };
  }, [disabled]);

  return activeSection;
}
