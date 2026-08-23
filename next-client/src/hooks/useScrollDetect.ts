'use client';
import { useState, useEffect } from 'react';

export function useScrollDetect(threshold: number = 50) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

<<<<<<< HEAD
    window.addEventListener('scroll', handleScroll);
=======
    window.addEventListener('scroll', handleScroll, { passive: true });
>>>>>>> preview
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return isScrolled;
}
<<<<<<< HEAD


=======
>>>>>>> preview
