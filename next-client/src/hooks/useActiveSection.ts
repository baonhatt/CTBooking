'use client';
import { useState, useEffect } from 'react';
import { SECTION_IDS } from '@/components/constants';

export function useActiveSection(disabled: boolean) {
  const [activeSection, setActiveSection] = useState<string>('hero');

  useEffect(() => {
    if (disabled) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px', // Focus on the upper-middle part of the viewport
      threshold: 0
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [disabled]);

  return activeSection;
}


